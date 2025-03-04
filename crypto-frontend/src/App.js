import React, { useState, useEffect } from 'react';
import './App.css';
import axios from 'axios';

// 새로운 유틸리티 함수 추가
const formatPrice = (price, currency) => {
  if (currency === 'KRW') {
    return new Intl.NumberFormat('ko-KR', { style: 'decimal' }).format(price);
  }
  return new Intl.NumberFormat('en-US', { style: 'decimal' }).format(price);
};

const calculateChange = (current, previous) => {
  if (!previous || previous === 0) return { percentage: 0 };

  const currentPrice = typeof current === 'string' ? parseFloat(current.replace(/,/g, '')) : current;
  const previousPrice = typeof previous === 'string' ? parseFloat(previous.replace(/,/g, '')) : previous;

  const percentage = ((currentPrice - previousPrice) / previousPrice * 100).toFixed(2);
  return { percentage: parseFloat(percentage) };
};

const CoinRow = React.memo(({ coin }) => {
  console.log(`CoinRow 컴포넌트 리렌더링: ${coin.symbol}`);
  console.log('History Data:', coin.history); // history 데이터 로깅

  return (
    <tr>
      <td>{coin.symbol}</td>
      <td>{formatPrice(coin.upbitPrice, 'KRW')}</td>
      <td>{formatPrice(coin.binancePrice, 'USD')}</td>
      <td>{coin.kimchiPremium}%</td>
      <td className={`price-change ${calculateChange(coin.upbitPrice, coin.history?.day1).percentage < 0 ? 'price-down' : 'price-up'}`}>
        {coin.history?.day1 ? `${calculateChange(coin.upbitPrice, coin.history.day1).percentage.toFixed(2)}%` : 'N/A'}
      </td>
      <td className={`price-change ${calculateChange(coin.upbitPrice, coin.history?.day7).percentage < 0 ? 'price-down' : 'price-up'}`}>
        {coin.history?.day7 ? `${calculateChange(coin.upbitPrice, coin.history.day7).percentage.toFixed(2)}%` : 'N/A'}
      </td>
      <td className={`price-change ${calculateChange(coin.upbitPrice, coin.history?.day30).percentage < 0 ? 'price-down' : 'price-up'}`}>
        {coin.history?.day30 ? `${calculateChange(coin.upbitPrice, coin.history.day30).percentage.toFixed(2)}%` : 'N/A'}
      </td>
      <td className={`price-change ${calculateChange(coin.upbitPrice, coin.history?.day180).percentage < 0 ? 'price-down' : 'price-up'}`}>
        {coin.history?.day180 ? `${calculateChange(coin.upbitPrice, coin.history.day180).percentage.toFixed(2)}%` : 'N/A'}
      </td>
      <td className={`price-change ${calculateChange(coin.upbitPrice, coin.history?.day360).percentage < 0 ? 'price-down' : 'price-up'}`}>
        {coin.history?.day360 ? `${calculateChange(coin.upbitPrice, coin.history.day360).percentage.toFixed(2)}%` : 'N/A'}
      </td>
    </tr>
  );
});

function App() {
  const [coinPrices, setCoinPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refresh, setRefresh] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await axios.get('http://localhost:5001/api/coins');
        setCoinPrices(prevPrices => {
          const newPrices = response.data;
          if (JSON.stringify(prevPrices) !== JSON.stringify(newPrices)) {
            return newPrices;
          }
          return prevPrices;
        });
      } catch (error) {
        console.error('API 호출 에러:', error);
        setError('시세 정보를 불러오는 중 오류가 발생했습니다.');
      } finally {
        if (loading) {
          setLoading(false);
        }
      }
    };

    fetchData();

    const intervalId = setInterval(fetchData, 15000);

    return () => clearInterval(intervalId);
  }, [loading]);

  if (loading) {
    return <p>Loading...</p>;
  }

  if (error) {
    return <p>Error: {error.message}</p>;
  }

  return (
    <div className="App">
      <header className="App-header">
        <img
          src="/Images/header-background-small.jpg"
          srcSet="/Images/header-background-small.jpg 600w, /Images/header-background-large.jpg 1200w"
          alt="Header Background"
          className="header-image"
        />
      </header>
      <main>
        <div className="table-container">
          <table className="responsive-table">
            <thead>
              <tr>
                <th>Symbol</th>
                <th>Upbit (KRW)</th>
                <th>Binance (USD)</th>
                <th>김프</th>
                <th>1D</th>
                <th>7D</th>
                <th>30D</th>
                <th>180D</th>
                <th>360D</th>
              </tr>
            </thead>
            <tbody>
              {coinPrices.map(coin => (
                <CoinRow key={coin.symbol} coin={coin} />
              ))}
            </tbody>
          </table>
        </div>
      </main>
      <footer>
        <p>&copy; 2024 Crypto Price Tracker</p>
      </footer>
    </div>
  );
}

export default App;