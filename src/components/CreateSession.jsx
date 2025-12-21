import { useState } from 'preact/hooks';

export function CreateSession({ onSessionCreated }) {
  const [maxGuests, setMaxGuests] = useState(2);
  const [cuisine, setCuisine] = useState('');
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

      if (!cuisine) {
        setError('Пожалуйста, выберите кухню');
        setLoading(false);
        return;
      }

      const response = await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxGuests,
          cuisine,
          userId: userId.toString(),
          userName
        })
      });

      let data;
      try {
        const responseText = await response.text();
        if (!responseText) {
          throw new Error('Пустой ответ от сервера');
        }
        data = JSON.parse(responseText);
      } catch (e) {
        throw new Error('Ошибка при обработке ответа сервера. Проверьте, что сервер запущен и база данных доступна.');
      }

      if (!response.ok) {
        throw new Error(data.error || 'Ошибка создания сессии');
      }

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
        <label htmlFor="cuisine">Кухня:</label>
        <select
          id="cuisine"
          value={cuisine}
          onChange={(e) => setCuisine(e.target.value)}
          className="input"
        >
          <option value="">Выберите кухню</option>
          <option value="русская">Русская</option>
          <option value="французская">Французская</option>
          <option value="мясная">Мясная</option>
        </select>
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

