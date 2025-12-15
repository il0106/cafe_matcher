import { useEffect } from 'preact/hooks';

export function WaitingRoom({ sessionCode, participants, maxGuests, isHost, onStart }) {
  const handleStart = () => {
    if (participants.length < 1) {
      alert('Должен быть хотя бы один участник');
      return;
    }
    onStart();
  };

  return (
    <div className="card">
      <h2>Комната ожидания</h2>
      
      <div className="session-code-display">
        <p className="session-code-label">Код сессии:</p>
        <div className="session-code">{sessionCode}</div>
        <small>Поделитесь этим кодом с друзьями</small>
      </div>

      <div className="participants-list">
        <h3>Участники ({participants.length}/{maxGuests}):</h3>
        <ul className="participants">
          {participants.map((p, idx) => (
            <li key={p.userId} className="participant-item">
              {idx === 0 && <span className="host-badge">👑 Хост</span>}
              {p.userName}
            </li>
          ))}
        </ul>
      </div>

      {isHost && (
        <button 
          onClick={handleStart} 
          className="btn btn-primary"
          disabled={participants.length < 1}
        >
          Начать сессию
        </button>
      )}

      {!isHost && (
        <p className="waiting-message">Ожидаем начала сессии от хоста...</p>
      )}
    </div>
  );
}

