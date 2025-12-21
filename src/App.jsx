import { useState, useEffect } from 'preact/hooks';
import { CreateSession } from './components/CreateSession';
import { JoinSession } from './components/JoinSession';
import { WaitingRoom } from './components/WaitingRoom';
import { CardSwipe } from './components/CardSwipe';
import { Results } from './components/Results';
import { SessionWebSocket } from './utils/websocket';

const VIEWS = {
  HOME: 'home',
  CREATE: 'create',
  JOIN: 'join',
  WAITING: 'waiting',
  PLAYING: 'playing',
  RESULTS: 'results'
};

export function App() {
  const [view, setView] = useState(VIEWS.HOME);
  const [user, setUser] = useState(null);
  const [currentUserId, setCurrentUserId] = useState(null); // userId текущего пользователя
  const [sessionId, setSessionId] = useState(null);
  const [sessionCode, setSessionCode] = useState(null);
  const [isHost, setIsHost] = useState(false);
  const [maxGuests, setMaxGuests] = useState(2);
  const [participants, setParticipants] = useState([]);
  const [cards, setCards] = useState([]);
  const [ws, setWs] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedCard, setSelectedCard] = useState(null);
  const [finishedSwiping, setFinishedSwiping] = useState(false);

  useEffect(() => {
    // Получаем данные пользователя из Telegram
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      const userData = tg.initDataUnsafe?.user;
      if (userData) {
        setUser({
          id: userData.id.toString(),
          name: userData.first_name || 'Гость'
        });
      }
    }
  }, []);

  // Функция для получения userId (из Telegram или генерация)
  const getUserId = () => {
    if (user?.id) return user.id;
    if (currentUserId) return currentUserId;
    return window.Telegram?.WebApp?.initDataUnsafe?.user?.id?.toString() || 
           `user_${Date.now()}_${Math.random()}`;
  };

  const handleSessionCreated = async (newSessionId, newSessionCode) => {
    setSessionId(newSessionId);
    setSessionCode(newSessionCode);
    setIsHost(true);
    setView(VIEWS.WAITING);
    
    // Получаем информацию о сессии для получения начального списка участников и userId
    let actualUserId = user?.id || currentUserId || getUserId();
    try {
      const response = await fetch(`/api/sessions/${newSessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        setParticipants(sessionData.participants || []);
        setMaxGuests(sessionData.maxGuests || 2);
        // Для хоста userId - это первый участник
        if (sessionData.participants && sessionData.participants.length > 0) {
          actualUserId = sessionData.participants[0].userId;
          if (!currentUserId && !user?.id) {
            setCurrentUserId(actualUserId);
          }
        }
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
    
    // Подключаемся к WebSocket
    console.log('[App] Creating WebSocket with userId:', actualUserId, 'sessionId:', newSessionId);
    const websocket = new SessionWebSocket(newSessionId, actualUserId, {
        onSessionState: (session) => {
          setParticipants(session.participants || []);
          setMaxGuests(session.maxGuests || 2);
          if (session.status === 'playing') {
            setCards(session.cards);
            setView(VIEWS.PLAYING);
          } else if (session.status === 'finished') {
            setResults(session.result);
            setView(VIEWS.RESULTS);
          }
        },
        onParticipantJoined: (newParticipants) => {
          setParticipants(newParticipants);
        },
        onSelectionUpdate: (selections) => {
          // Можно показывать прогресс другим участникам
          console.log('Selection update:', selections);
        },
        onSessionFinished: (resultsData, sessionCards) => {
          setResults(resultsData);
          if (sessionCards) {
            setCards(sessionCards);
          }
          setView(VIEWS.RESULTS);
        }
      });
      websocket.connect();
      setWs(websocket);
  };

  const handleSessionJoined = async (newSessionId, newIsHost) => {
    setSessionId(newSessionId);
    setIsHost(newIsHost);
    setView(VIEWS.WAITING);
    
    // Получаем информацию о сессии и определяем userId из участников
    let actualUserId = user?.id || currentUserId || getUserId();
    try {
      const response = await fetch(`/api/sessions/${newSessionId}`);
      if (response.ok) {
        const sessionData = await response.json();
        setSessionCode(sessionData.code);
        setMaxGuests(sessionData.maxGuests || 2);
        setParticipants(sessionData.participants || []);
        // Находим userId текущего пользователя среди участников (последний добавленный для присоединившегося)
        if (sessionData.participants && sessionData.participants.length > 0) {
          // Для присоединившегося пользователя - это последний участник (который не хост)
          const myParticipant = sessionData.participants.find(p => p.userId !== sessionData.participants[0].userId) || 
                                sessionData.participants[sessionData.participants.length - 1];
          if (myParticipant) {
            actualUserId = myParticipant.userId;
            if (!currentUserId && !user?.id) {
              setCurrentUserId(actualUserId);
            }
          }
        }
      }
    } catch (error) {
      console.error('Error fetching session data:', error);
    }
    
    // Подключаемся к WebSocket
    console.log('[App] Creating WebSocket with userId:', actualUserId, 'sessionId:', newSessionId);
    const websocket = new SessionWebSocket(newSessionId, actualUserId, {
        onSessionState: (session) => {
          setSessionCode(session.code);
          setMaxGuests(session.maxGuests || 2);
          setParticipants(session.participants || []);
          
          if (session.status === 'playing') {
            setCards(session.cards);
            setView(VIEWS.PLAYING);
          } else if (session.status === 'finished') {
            setResults(session.result);
            setView(VIEWS.RESULTS);
          }
        },
        onParticipantJoined: (newParticipants) => {
          setParticipants(newParticipants);
        },
        onSessionStarted: (sessionCards, sessionParticipants) => {
          setCards(sessionCards);
          setParticipants(sessionParticipants);
          setView(VIEWS.PLAYING);
        },
        onSelectionUpdate: (selections) => {
          console.log('Selection update:', selections);
        },
        onSessionFinished: (resultsData, sessionCards) => {
          setResults(resultsData);
          if (sessionCards) {
            setCards(sessionCards);
          }
          setView(VIEWS.RESULTS);
        }
      });
      websocket.connect();
      setWs(websocket);
  };

  const handleStartSession = async () => {
    try {
      const response = await fetch(`/api/sessions/${sessionId}/start`, {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error('Ошибка начала сессии');
      }

      const data = await response.json();
      setCards(data.cards);
      setView(VIEWS.PLAYING);
    } catch (error) {
      alert(error.message);
    }
  };

  const handleCardSelected = (cardIndex) => {
    setSelectedCard(cardIndex);
    if (ws) {
      ws.sendCardSelection(cardIndex);
    }
  };

  const handleFinishedSwiping = () => {
    setFinishedSwiping(true);
    if (ws) {
      ws.sendFinishedSwiping();
    }
  };

  const handleNewSession = () => {
    // Очищаем состояние
    if (ws) {
      ws.disconnect();
      setWs(null);
    }
    setSessionId(null);
    setSessionCode(null);
    setIsHost(false);
    setParticipants([]);
    setCards([]);
    setResults(null);
    setSelectedCard(null);
    setFinishedSwiping(false);
    setView(VIEWS.HOME);
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🍽️ Cafe Matcher</h1>
        {user && (
          <div className="user-info">
            <p>Привет, {user.name}!</p>
          </div>
        )}
      </header>
      
      <main className="main">
        {view === VIEWS.HOME && (
          <div className="card">
            <h2>Добро пожаловать!</h2>
            <p>Выберите действие:</p>
            <div className="home-actions">
              <button 
                onClick={() => setView(VIEWS.CREATE)} 
                className="btn btn-primary"
              >
                Создать сессию
              </button>
              <button 
                onClick={() => setView(VIEWS.JOIN)} 
                className="btn"
              >
                Присоединиться к сессии
              </button>
            </div>
          </div>
        )}

        {view === VIEWS.CREATE && (
          <CreateSession onSessionCreated={handleSessionCreated} />
        )}

        {view === VIEWS.JOIN && (
          <JoinSession onSessionJoined={handleSessionJoined} />
        )}

        {view === VIEWS.WAITING && sessionCode && (
          <WaitingRoom
            sessionCode={sessionCode}
            participants={participants}
            maxGuests={maxGuests}
            isHost={isHost}
            onStart={handleStartSession}
          />
        )}

        {view === VIEWS.PLAYING && cards.length > 0 && (
          <CardSwipe
            cards={cards}
            onCardSelected={handleCardSelected}
            onFinished={handleFinishedSwiping}
          />
        )}

        {view === VIEWS.RESULTS && results && cards.length > 0 && (
          <Results results={results} cards={cards} />
        )}

        {view === VIEWS.RESULTS && (
          <div style={{ marginTop: '1rem', textAlign: 'center' }}>
            <button onClick={handleNewSession} className="btn">
              Новая сессия
            </button>
          </div>
        )}
      </main>
    </div>
  );
}
