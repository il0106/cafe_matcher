import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import Database from 'better-sqlite3';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Подключение к БД
let db;
try {
  const dbPath = path.join(__dirname, '../database.db');
  db = new Database(dbPath);
  console.log('Database connected successfully');
} catch (error) {
  console.error('Error connecting to database:', error);
  // Создаем заглушку, чтобы сервер не падал
  db = null;
}

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

app.use(cors());
app.use(express.json());

// Статические файлы для production
app.use(express.static(path.join(__dirname, '../dist')));

// Хранилище сессий (в продакшене лучше использовать Redis или БД)
const sessions = new Map();
const users = new Map(); // userId -> sessionId

// Функция для получения ресторанов из БД по кухне
function getRestaurantsByCuisine(cuisine) {
  try {
    if (!db) {
      console.error('Database not connected');
      return [];
    }
    
    const query = `
      SELECT address_name, caption, Cusiene, Average_bill, photos, site, Restaurant_name, Brief_description, general_rating
      FROM places
      WHERE Cusiene LIKE ?
      AND general_rating >= 4.8
    `;
    
    const stmt = db.prepare(query);
    const rows = stmt.all(`%${cuisine}%`);
    
    // Преобразуем строки в нужный формат
    return rows.map(row => {
      // Парсим photos из строки в массив URL
      let photos = [];
      try {
        if (row.photos) {
          const photosStr = String(row.photos).trim();
          console.log('Parsing photos string:', photosStr.substring(0, 100));
          
          // Если строка пустая, пропускаем
          if (!photosStr || photosStr === 'null' || photosStr === 'None') {
            photos = [];
          } else if (photosStr.startsWith('[')) {
            // Это список - может быть Python или JSON формат
            // Python использует одинарные кавычки: ['url1', 'url2']
            // JSON использует двойные кавычки: ["url1", "url2"]
            
            // Пробуем сначала как JSON
            try {
              photos = JSON.parse(photosStr);
            } catch (jsonError) {
              // Если не JSON, значит это Python-стиль список
              // Извлекаем URL из строки вида ['url1', 'url2'] или ["url1", "url2"]
              // Удаляем внешние скобки и разбиваем по запятым
              const inner = photosStr.slice(1, -1).trim(); // Убираем [ и ]
              if (inner) {
                // Разбиваем по запятой, учитывая что URL могут быть в кавычках
                const urlPattern = /['"]([^'"]+)['"]/g;
                const matches = inner.matchAll(urlPattern);
                photos = Array.from(matches, m => m[1]);
                
                // Если паттерн не сработал, пробуем просто разбить по запятой
                if (photos.length === 0) {
                  photos = inner.split(',').map(url => url.trim().replace(/^['"]|['"]$/g, ''));
                }
              }
            }
          } else if (photosStr.startsWith('"') && photosStr.endsWith('"')) {
            // Если это JSON строка в кавычках
            photos = JSON.parse(photosStr);
          } else if (photosStr.includes(',')) {
            // Если это список через запятую
            photos = photosStr.split(',').map(url => url.trim().replace(/^['"]|['"]$/g, ''));
          } else {
            // Если это просто строка с URL, создаем массив
            photos = [photosStr];
          }
          // Убеждаемся, что это массив строк и фильтруем пустые значения
          photos = Array.isArray(photos) 
            ? photos
                .filter(url => url && typeof url === 'string' && url.length > 0 && url !== 'null' && url !== 'None')
                .map(url => {
                  // Очищаем URL от лишних пробелов и символов
                  url = url.trim();
                  // Если URL не начинается с http, добавляем https://
                  if (url && !url.startsWith('http://') && !url.startsWith('https://')) {
                    url = 'https://' + url;
                  }
                  return url;
                })
                .filter(url => url && url.length > 0)
            : [];
          
          console.log('Parsed photos:', photos.length, 'URLs');
        }
      } catch (e) {
        // Если не удалось распарсить, оставляем пустой массив
        console.warn('Error parsing photos:', e.message, 'for photos string:', String(row.photos).substring(0, 100));
        photos = [];
      }
      
      return {
        address_name: String(row.address_name || ''),
        caption: String(row.caption || ''),
        Cusiene: String(row.Cusiene || ''),
        Average_bill: String(row.Average_bill || ''),
        photos: photos,
        site: String(row.site || ''),
        Restaurant_name: String(row.Restaurant_name || ''),
        Brief_description: String(row.Brief_description || ''),
        general_rating: String(row.general_rating || '')
      };
    });
  } catch (error) {
    console.error('Error fetching restaurants from DB:', error);
    return [];
  }
}

// Генерация случайного кода сессии
function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Создание новой сессии
app.post('/api/sessions', async (req, res) => {
  try {
    const { maxGuests, cuisine, userId, userName } = req.body;
    
    if (!maxGuests || maxGuests < 1) {
      return res.status(400).json({ error: 'maxGuests обязателен и должен быть >= 1' });
    }

    if (!cuisine) {
      return res.status(400).json({ error: 'cuisine обязательна' });
    }

    if (!userId || !userName) {
      return res.status(400).json({ error: 'userId и userName обязательны' });
    }

    // Получаем рестораны из БД
    const restaurants = getRestaurantsByCuisine(cuisine);
    
    if (restaurants.length === 0) {
      return res.status(400).json({ error: 'Рестораны для выбранной кухни не найдены' });
    }

    const sessionId = uuidv4();
    let sessionCode = generateSessionCode();
    
    // Убеждаемся, что код уникален
    while (Array.from(sessions.values()).some(s => s.code === sessionCode)) {
      sessionCode = generateSessionCode();
    }
    
    // Перемешиваем карточки (рестораны)
    const shuffledCards = [...restaurants].sort(() => Math.random() - 0.5);

    // Создаем сессию с хостом как первым участником
    const session = {
      id: sessionId,
      code: sessionCode,
      maxGuests: maxGuests,
      cards: shuffledCards,
      participants: [{ userId: userId.toString(), userName, joinedAt: Date.now() }],
      selections: {}, // userId -> cardId (выбранная карточка)
      status: 'waiting', // waiting, playing, finished
      createdAt: Date.now()
    };

    sessions.set(sessionId, session);
    users.set(userId.toString(), sessionId);
    
    res.json({ sessionId, sessionCode, maxGuests, cardsCount: shuffledCards.length });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({ error: 'Внутренняя ошибка сервера: ' + error.message });
  }
});

// Присоединение к сессии
app.post('/api/sessions/join', (req, res) => {
  const { code, userId, userName } = req.body;

  if (!code || !userId || !userName) {
    return res.status(400).json({ error: 'code, userId и userName обязательны' });
  }

  // Находим сессию по коду
  const session = Array.from(sessions.values()).find(s => s.code === code.toUpperCase());
  
  if (!session) {
    return res.status(404).json({ error: 'Сессия не найдена' });
  }

  if (session.status !== 'waiting') {
    return res.status(400).json({ error: 'Сессия уже началась или завершена' });
  }

  // Приводим userId к строке для консистентности
  const userIdStr = userId.toString();
  
  // Проверяем, не присоединился ли уже
  if (session.participants.find(p => p.userId === userIdStr)) {
    return res.json({ 
      sessionId: session.id, 
      sessionCode: session.code,
      isHost: session.participants[0]?.userId === userIdStr
    });
  }

  // Проверяем лимит участников
  if (session.participants.length >= session.maxGuests) {
    return res.status(400).json({ error: 'Сессия заполнена' });
  }

  // Добавляем участника
  session.participants.push({ userId: userIdStr, userName, joinedAt: Date.now() });
  users.set(userIdStr, session.id);

  // Уведомляем всех участников о новом присоединении
  broadcastToSession(session.id, {
    type: 'participant_joined',
    participants: session.participants.map(p => ({ userId: p.userId, userName: p.userName }))
  });

  res.json({ 
    sessionId: session.id, 
    sessionCode: session.code,
    isHost: session.participants[0]?.userId === userIdStr
  });
});

// Получение информации о сессии
app.get('/api/sessions/:sessionId', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Сессия не найдена' });
  }

  res.json({
    id: session.id,
    code: session.code,
    maxGuests: session.maxGuests,
    cardsCount: session.cards.length,
    participants: session.participants.map(p => ({ userId: p.userId, userName: p.userName })),
    status: session.status
  });
});

// Начало сессии (вызывается хостом)
app.post('/api/sessions/:sessionId/start', (req, res) => {
  const { sessionId } = req.params;
  const session = sessions.get(sessionId);

  if (!session) {
    return res.status(404).json({ error: 'Сессия не найдена' });
  }

  if (session.status !== 'waiting') {
    return res.status(400).json({ error: 'Сессия уже началась' });
  }

  if (session.participants.length < 1) {
    return res.status(400).json({ error: 'Недостаточно участников' });
  }

  session.status = 'playing';
  
  console.log(`[API] Starting session ${sessionId} with ${session.participants.length} participants`);
  console.log(`[API] Participant userIds: ${session.participants.map(p => p.userId).join(', ')}`);
  console.log(`[API] Connected clients: ${Array.from(clients.keys()).join(', ')}`);
  
  // Уведомляем всех через WebSocket
  broadcastToSession(sessionId, {
    type: 'session_started',
    cards: session.cards,
    participants: session.participants.map(p => ({ userId: p.userId, userName: p.userName }))
  });

  res.json({ success: true, cards: session.cards });
});

// WebSocket соединения
const clients = new Map(); // userId -> ws connection

wss.on('connection', (ws, req) => {
  let userId = null;
  let sessionId = null;

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      
      switch (data.type) {
        case 'register': {
          userId = data.userId.toString();
          sessionId = data.sessionId;
          clients.set(userId, ws);
          console.log(`[WebSocket] User ${userId} registered for session ${sessionId}, total clients: ${clients.size}`);
          
          // Отправляем текущее состояние сессии
          const currentSession = sessions.get(sessionId);
          if (currentSession) {
            // Если сессия уже началась, отправляем session_started вместо session_state
            if (currentSession.status === 'playing') {
              ws.send(JSON.stringify({
                type: 'session_started',
                cards: currentSession.cards,
                participants: currentSession.participants.map(p => ({ userId: p.userId, userName: p.userName }))
              }));
              console.log(`[WebSocket] Sent session_started to ${userId} (session already playing)`);
            } else {
              ws.send(JSON.stringify({
                type: 'session_state',
                session: {
                  id: currentSession.id,
                  code: currentSession.code,
                  status: currentSession.status,
                  cards: undefined,
                  participants: currentSession.participants.map(p => ({ userId: p.userId, userName: p.userName })),
                  selections: currentSession.selections
                }
              }));
              console.log(`[WebSocket] Sent session_state to ${userId} (status: ${currentSession.status})`);
            }
          } else {
            console.log(`[WebSocket] Session ${sessionId} not found for user ${userId}`);
          }
          break;
        }

        case 'card_selected': {
          if (!sessionId || !userId) break;
          const playingSession = sessions.get(sessionId);
          if (!playingSession || playingSession.status !== 'playing') break;

          playingSession.selections[userId] = data.cardIndex;
          
          // Проверяем, все ли выбрали
          const allSelected = playingSession.participants.every(p => playingSession.selections[p.userId] !== undefined);
          
          if (allSelected) {
            // Вычисляем результат
            const results = calculateResults(playingSession);
            playingSession.status = 'finished';
            playingSession.result = results;
            
            // Отправляем результаты вместе с карточками для удобства
            broadcastToSession(sessionId, {
              type: 'session_finished',
              results: results,
              cards: playingSession.cards
            });
          } else {
            // Уведомляем всех о прогрессе
            broadcastToSession(sessionId, {
              type: 'selection_update',
              selections: playingSession.selections
            });
          }
          break;
        }

        case 'finished_swiping': {
          if (!sessionId || !userId) break;
          const sessionData = sessions.get(sessionId);
          if (!sessionData) break;

          // Помечаем, что пользователь закончил просмотр
          const participant = sessionData.participants.find(p => p.userId === userId);
          if (participant) {
            participant.finishedSwiping = true;
            
            // Проверяем, все ли закончили
            const allFinished = sessionData.participants.every(p => p.finishedSwiping);
            
            if (allFinished && sessionData.status === 'playing') {
              // Если все закончили, завершаем сессию с результатами
              // Если есть выборы - показываем результаты, иначе - нет совпадений
              const results = calculateResults(sessionData);
              sessionData.status = 'finished';
              sessionData.result = results;
              
              broadcastToSession(sessionId, {
                type: 'session_finished',
                results: results,
                cards: sessionData.cards
              });
            }
          }
          break;
        }
      }
    } catch (error) {
      console.error('WebSocket message error:', error);
    }
  });

  ws.on('close', () => {
    if (userId) {
      clients.delete(userId);
    }
  });

  ws.on('error', (error) => {
    console.error('WebSocket error:', error);
  });
});

// Отправка сообщения всем участникам сессии
function broadcastToSession(sessionId, message) {
  const session = sessions.get(sessionId);
  if (!session) {
    console.log(`[broadcastToSession] Session ${sessionId} not found`);
    return;
  }

  const messageStr = JSON.stringify(message);
  console.log(`[broadcastToSession] Broadcasting to session ${sessionId}, message type: ${message.type}, participants: ${session.participants.length}`);
  
  session.participants.forEach(participant => {
    const client = clients.get(participant.userId);
    console.log(`[broadcastToSession] Participant ${participant.userId} (${participant.userName}): client found=${!!client}, readyState=${client?.readyState}`);
    if (client && client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
      console.log(`[broadcastToSession] Message sent to ${participant.userId}`);
    } else {
      console.log(`[broadcastToSession] Failed to send to ${participant.userId}: client=${!!client}, readyState=${client?.readyState}`);
    }
  });
}

// Вычисление результатов
function calculateResults(session) {
  const selections = session.selections;
  
  if (Object.keys(selections).length === 0) {
    return {
      match: null,
      majority: null,
      allSelections: {}
    };
  }

  // Подсчет голосов за каждую карточку
  const votes = {};
  Object.values(selections).forEach(cardIndex => {
    votes[cardIndex] = (votes[cardIndex] || 0) + 1;
  });

  // Проверка на полное совпадение (все выбрали одно)
  const totalParticipants = session.participants.length;
  const perfectMatch = Object.entries(votes).find(([_, count]) => count === totalParticipants);
  
  if (perfectMatch) {
    return {
      match: parseInt(perfectMatch[0]),
      card: session.cards[parseInt(perfectMatch[0])],
      majority: null,
      allSelections: selections
    };
  }

  // Поиск большинства
  const sortedVotes = Object.entries(votes)
    .map(([cardIndex, count]) => ({ cardIndex: parseInt(cardIndex), count }))
    .sort((a, b) => b.count - a.count);

  const majority = sortedVotes[0];

  return {
    match: null,
    majority: {
      cardIndex: majority.cardIndex,
      card: session.cards[majority.cardIndex],
      votes: majority.count,
      total: totalParticipants
    },
    allSelections: selections,
    allVotes: votes
  };
}

// Очистка старых сессий (каждый час)
setInterval(() => {
  const now = Date.now();
  const maxAge = 24 * 60 * 60 * 1000; // 24 часа
  
  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.createdAt > maxAge) {
      sessions.delete(sessionId);
    }
  }
}, 60 * 60 * 1000);

const PORT = process.env.PORT || 3333;

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

