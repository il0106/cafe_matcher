import { useState } from 'preact/hooks';

export function JoinSession({ onSessionJoined }) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleJoin = async () => {
    if (!code.trim()) {
      setError('Введите код сессии');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Получаем данные пользователя из Telegram
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 
                     `user_${Date.now()}_${Math.random()}`;
      const userName = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 
                       'Гость';

      const response = await fetch('/api/sessions/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: code.toUpperCase().trim(),
          userId: userId.toString(),
          userName
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка присоединения к сессии');
      }

      const data = await response.json();
      onSessionJoined(data.sessionId, data.isHost);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Присоединиться к сессии</h2>
      <p>Введите код сессии, который вам дал друг</p>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="sessionCode">Код сессии:</label>
        <input
          id="sessionCode"
          type="text"
          value={code}
          onInput={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="ВВЕДИТЕ КОД"
          className="input input-large"
          maxLength="6"
          style={{ textTransform: 'uppercase', letterSpacing: '0.5em', textAlign: 'center', fontSize: '1.5rem', fontWeight: 'bold' }}
        />
      </div>

      <button 
        onClick={handleJoin} 
        className="btn" 
        disabled={loading}
      >
        {loading ? 'Присоединение...' : 'Присоединиться'}
      </button>
    </div>
  );
}

