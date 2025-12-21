export function Results({ results, cards }) {
  const { match, majority, allSelections } = results;

  return (
    <div className="card">
      <h2>Результаты!</h2>
      
      {match !== null ? (
        <div className="results-perfect-match">
          <div className="result-icon">🎉</div>
          <h3>Полное совпадение!</h3>
          {cards[match] && typeof cards[match] === 'object' ? (
            <>
              <p className="result-card-name">{cards[match].Restaurant_name || 'Ресторан'}</p>
              {cards[match].address_name && (
                <p className="result-description">Адрес: {cards[match].address_name}</p>
              )}
              {cards[match].site && (
                <p className="result-description">
                  <a href={cards[match].site} target="_blank" rel="noopener noreferrer">
                    {cards[match].site}
                  </a>
                </p>
              )}
            </>
          ) : (
            <p className="result-card-name">{cards[match]}</p>
          )}
          <p className="result-description">Все участники выбрали это место!</p>
        </div>
      ) : majority ? (
        <div className="results-majority">
          <div className="result-icon">👍</div>
          <h3>Выбор большинства</h3>
          {majority.card && typeof majority.card === 'object' ? (
            <>
              <p className="result-card-name">{majority.card.Restaurant_name || 'Ресторан'}</p>
              {majority.card.address_name && (
                <p className="result-description">Адрес: {majority.card.address_name}</p>
              )}
              {majority.card.site && (
                <p className="result-description">
                  <a href={majority.card.site} target="_blank" rel="noopener noreferrer">
                    {majority.card.site}
                  </a>
                </p>
              )}
            </>
          ) : (
            <p className="result-card-name">{majority.card}</p>
          )}
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
            {Object.entries(allSelections).map(([userId, cardIndex]) => {
              const card = cards[cardIndex];
              const cardName = card && typeof card === 'object' 
                ? (card.Restaurant_name || 'Ресторан')
                : card;
              return (
                <li key={userId}>
                  Карточка {cardIndex + 1}: {cardName}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}

