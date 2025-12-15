export function Results({ results, cards }) {
  const { match, majority, allSelections } = results;

  return (
    <div className="card">
      <h2>Результаты!</h2>
      
      {match !== null ? (
        <div className="results-perfect-match">
          <div className="result-icon">🎉</div>
          <h3>Полное совпадение!</h3>
          <p className="result-card-name">{cards[match]}</p>
          <p className="result-description">Все участники выбрали это место!</p>
        </div>
      ) : majority ? (
        <div className="results-majority">
          <div className="result-icon">👍</div>
          <h3>Выбор большинства</h3>
          <p className="result-card-name">{majority.card}</p>
          <p className="result-description">
            {majority.votes} из {majority.total} участников выбрали это место
          </p>
        </div>
      ) : (
        <div className="results-no-match">
          <div className="result-icon">🤷</div>
          <h3>Совпадений не найдено</h3>
          <p>Никто не выбрал одинаковые карточки</p>
        </div>
      )}

      {allSelections && Object.keys(allSelections).length > 0 && (
        <div className="results-details">
          <h4>Все выборы:</h4>
          <ul className="selections-list">
            {Object.entries(allSelections).map(([userId, cardIndex]) => (
              <li key={userId}>
                Карточка {cardIndex + 1}: {cards[cardIndex]}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

