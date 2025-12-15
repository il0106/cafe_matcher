import { useState } from 'preact/hooks';

export function CreateSession({ onSessionCreated }) {
  const [maxGuests, setMaxGuests] = useState(2);
  const [customCards, setCustomCards] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleCreate = async () => {
    setLoading(true);
    setError(null);

    try {
      // Получаем данные пользователя из Telegram
      const userId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id || 
                     `user_${Date.now()}_${Math.random()}`;
      const userName = window.Telegram?.WebApp?.initDataUnsafe?.user?.first_name || 
                       'Гость';

      const cards = customCards
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0);

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxGuests,
          cards: cards.length > 0 ? cards : undefined,
          userId: userId.toString(),
          userName
        })
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Ошибка создания сессии');
      }

      const data = await response.json();
      onSessionCreated(data.sessionId, data.sessionCode);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2>Создать сессию</h2>
      <p>Создайте комнату и пригласите друзей выбрать место для похода!</p>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      <div className="form-group">
        <label htmlFor="maxGuests">Количество гостей (включая вас):</label>
        <input
          id="maxGuests"
          type="number"
          min="2"
          max="10"
          value={maxGuests}
          onInput={(e) => setMaxGuests(parseInt(e.target.value) || 2)}
          className="input"
        />
      </div>

      <div className="form-group">
        <label htmlFor="customCards">Варианты карточек (по одному на строку, необязательно):</label>
        <textarea
          id="customCards"
          value={customCards}
          onInput={(e) => setCustomCards(e.target.value)}
          placeholder="Итальянская кухня&#10;Японская кухня&#10;Мексиканская кухня&#10;..."
          className="textarea"
          rows="6"
        />
        <small>Если оставить пустым, будут использованы карточки по умолчанию</small>
      </div>

      <button 
        onClick={handleCreate} 
        className="btn" 
        disabled={loading}
      >
        {loading ? 'Создание...' : 'Создать сессию'}
      </button>
    </div>
  );
}

