import { useState, useEffect, useRef } from 'preact/hooks';

export function CardSwipe({ cards, onCardSelected, onFinished }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [startPos, setStartPos] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const cardRef = useRef(null);

  const currentCard = cards[currentIndex];

  useEffect(() => {
    if (!cardRef.current) return;

    const handleTouchStart = (e) => {
      const touch = e.touches[0];
      setStartPos({ x: touch.clientX, y: touch.clientY });
      setIsDragging(true);
    };

    const handleTouchMove = (e) => {
      if (!isDragging || !startPos) return;
      e.preventDefault();
      const touch = e.touches[0];
      setOffset({
        x: touch.clientX - startPos.x,
        y: touch.clientY - startPos.y
      });
    };

    const handleTouchEnd = () => {
      if (!isDragging) return;
      
      const swipeThreshold = 100;
      if (Math.abs(offset.x) > swipeThreshold) {
        if (offset.x > 0) {
          // Свайп вправо - лайк
          handleLike();
        } else {
          // Свайп влево - пропуск
          handleSkip();
        }
      } else {
        // Возвращаем карточку на место
        setOffset({ x: 0, y: 0 });
      }
      
      setIsDragging(false);
      setStartPos(null);
    };

    const card = cardRef.current;
    card.addEventListener('touchstart', handleTouchStart);
    card.addEventListener('touchmove', handleTouchMove);
    card.addEventListener('touchend', handleTouchEnd);

    return () => {
      card.removeEventListener('touchstart', handleTouchStart);
      card.removeEventListener('touchmove', handleTouchMove);
      card.removeEventListener('touchend', handleTouchEnd);
    };
  }, [isDragging, startPos, offset]);

  const handleLike = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('medium');
    }
    
    onCardSelected(currentIndex);
    
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setOffset({ x: 0, y: 0 });
    } else {
      onFinished();
    }
  };

  const handleSkip = () => {
    if (window.Telegram?.WebApp) {
      window.Telegram.WebApp.HapticFeedback.impactOccurred('light');
    }
    
    if (currentIndex < cards.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setOffset({ x: 0, y: 0 });
    } else {
      onFinished();
    }
  };

  const rotate = offset.x * 0.1;
  const opacity = 1 - Math.abs(offset.x) / 300;

  if (currentIndex >= cards.length) {
    return (
      <div className="card">
        <h2>Вы просмотрели все карточки!</h2>
        <p>Ожидаем остальных участников...</p>
      </div>
    );
  }

  return (
    <div className="swipe-container">
      <div className="swipe-progress">
        Карточка {currentIndex + 1} из {cards.length}
      </div>
      
      <div className="card-stack">
        <div
          ref={cardRef}
          className="swipe-card"
          style={{
            transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`,
            opacity: Math.max(opacity, 0.5)
          }}
        >
          <div className="swipe-card-content">
            <h2>{currentCard}</h2>
          </div>
          {offset.x > 50 && (
            <div className="swipe-indicator swipe-like">✓ Лайк</div>
          )}
          {offset.x < -50 && (
            <div className="swipe-indicator swipe-skip">✕ Пропустить</div>
          )}
        </div>
      </div>

      <div className="swipe-actions">
        <button onClick={handleSkip} className="btn btn-skip">
          ✕ Пропустить
        </button>
        <button onClick={handleLike} className="btn btn-like">
          ✓ Лайк
        </button>
      </div>
    </div>
  );
}

