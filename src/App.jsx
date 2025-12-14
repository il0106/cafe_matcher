import { useState, useEffect } from 'preact/hooks';

export function App() {
  const [user, setUser] = useState(null);
  const [count, setCount] = useState(0);

  useEffect(() => {
    // Получаем данные пользователя из Telegram
    if (window.Telegram?.WebApp) {
      const tg = window.Telegram.WebApp;
      setUser(tg.initDataUnsafe?.user || null);
    }
  }, []);

  const handleButtonClick = () => {
    setCount(count + 1);
    
    // Показываем haptic feedback
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
  };

  return (
    <div className="app">
      <header className="header">
        <h1>🍽️ Cafe Matcher</h1>
        {user && (
          <div className="user-info">
            <p>Привет, {user.first_name}!</p>
          </div>
        )}
      </header>
      
      <main className="main">
        <div className="card">
          <h2>Добро пожаловать!</h2>
          <p>Это простое приложение на Preact для Telegram Mini App.</p>
          
          <div className="counter">
            <p>Счетчик: <strong>{count}</strong></p>
            <button onClick={handleButtonClick} className="btn">
              Нажми меня
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

