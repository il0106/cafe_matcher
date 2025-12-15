import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

// Примеры карточек для демонстрации (в реальном приложении можно брать из БД)
const SAMPLE_CARDS = [
  'Итальянская кухня',
  'Японская кухня',
  'Мексиканская кухня',
  'Французская кухня',
  'Грузинская кухня',
  'Индийская кухня',
  'Китайская кухня',
  'Тайская кухня',
  'Американская кухня',
  'Русская кухня',
  'Средиземноморская кухня',
  'Вегетарианское меню',
  'Стейк-хаус',
  'Пиццерия',
  'Суши-бар',
  'Бургерная',
  'Кафе с кофе',
  'Паста-бар',
  'Морепродукты',
  'Домашняя кухня'
];

// Генерация случайного кода сессии
function generateSessionCode() {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// Создание новой сессии
app.post('/api/sessions', (req, res) => {
  const { maxGuests, cards, userId, userName } = req.body;
  
  if (!maxGuests || maxGuests < 1) {
    return res.status(400).json({ error: 'maxGuests обязателен и должен быть >= 1' });
  }

  if (!userId || !userName) {
    return res.status(400).json({ error: 'userId и userName обязательны' });
  }

  const sessionId = uuidv4();
  let sessionCode = generateSessionCode();
  
  // Убеждаемся, что код уникален
  while (Array.from(sessions.values()).some(s => s.code === sessionCode)) {
    sessionCode = generateSessionCode();
  }

  // Используем переданные карточки или дефолтные
  const sessionCards = cards && cards.length > 0 ? cards : [...SAMPLE_CARDS];
  
  // Перемешиваем карточки
  const shuffledCards = [...sessionCards].sort(() => Math.random() - 0.5);

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

  // Проверяем, не присоединился ли уже
  if (session.participants.find(p => p.userId === userId)) {
    return res.json({ 
      sessionId: session.id, 
      sessionCode: session.code,
      isHost: session.participants[0]?.userId === userId
    });
  }

  // Проверяем лимит участников
  if (session.participants.length >= session.maxGuests) {
    return res.status(400).json({ error: 'Сессия заполнена' });
  }

  // Добавляем участника
  session.participants.push({ userId, userName, joinedAt: Date.now() });
  users.set(userId, session.id);

  // Уведомляем всех участников о новом присоединении
  broadcastToSession(session.id, {
    type: 'participant_joined',
    participants: session.participants.map(p => ({ userId: p.userId, userName: p.userName }))
  });

  res.json({ 
    sessionId: session.id, 
    sessionCode: session.code,
    isHost: session.participants[0]?.userId === userId
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
          userId = data.userId;
          sessionId = data.sessionId;
          clients.set(userId, ws);
          
          // Отправляем текущее состояние сессии
          const currentSession = sessions.get(sessionId);
          if (currentSession) {
            ws.send(JSON.stringify({
              type: 'session_state',
              session: {
                id: currentSession.id,
                code: currentSession.code,
                status: currentSession.status,
                cards: currentSession.status === 'playing' ? currentSession.cards : undefined,
                participants: currentSession.participants.map(p => ({ userId: p.userId, userName: p.userName })),
                selections: currentSession.selections
              }
            }));
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
  if (!session) return;

  const messageStr = JSON.stringify(message);
  
  session.participants.forEach(participant => {
    const client = clients.get(participant.userId);
    if (client && client.readyState === 1) { // WebSocket.OPEN
      client.send(messageStr);
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

