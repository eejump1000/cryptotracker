const express = require('express');
const cors = require('cors');
const http = require('http'); // 기존 HTTP 모듈
const https = require('https'); // HTTPS 모듈 추가
const fs = require('fs'); // 파일 시스템 모듈 추가

const app = express();
const port = 5001; // 또는 다른 포트 번호로 변경

// ✅ coins 변수는 getCoinPrices 함수보다 먼저 선언 및 초기화되어야 합니다.
const coins = ['BTC', 'ETH', 'XRP', 'SOL', 'DOGE', 'ADA','TRX','SUI','TRUMP','HBAR'];

app.use(cors()); // CORS 미들웨어 사용

app.get('/', (req, res) => {
  res.send('Hello, this is your crypto price tracker backend!');
});

async function getExchangeRate() {
  try {
    const response = await fetch('https://api.frankfurter.dev/v1/latest?base=USD&symbols=KRW'); // fetch API 사용
    if (!response.ok) { // 응답 상태 코드 체크 (2xx 외 에러 처리)
      throw new Error(`HTTP error! status: ${response.status}`); // 에러 발생 시 예외 던지기
    }
    const data = await response.json(); // JSON 응답 파싱
    return data.rates.KRW; // API 응답에서 환율 정보 추출
  } catch (error) {
    console.error('Failed to fetch exchange rate from Frankfurter API:', error);
    return null; // 에러 발생 시 null 반환 (기존 방식 유지)
  }
}

// 지연 함수 추가
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 과거 데이터를 가져오는 함수 추가
async function getHistoricalData(symbol, days) {
  try {
    // 월별 데이터 요청 (12개월)
    const upbitResponse = await fetch(`https://api.upbit.com/v1/candles/days?market=KRW-${symbol}&count=${days}`);
    if (!upbitResponse.ok) {
      throw new Error(`Upbit API error! status: ${upbitResponse.status}`);
    }
    const upbitData = await upbitResponse.json();

    return {
      upbit: upbitData.map(candle => ({
        date: candle.candle_date_time_kst,
        price: candle.trade_price
      }))
    };
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return null;
  }
}

app.get('/api/coins', async (req, res) => {
  try {
    const exchangeRate = await getExchangeRate(); // 환율 정보 가져오기
    if (!exchangeRate) { // 환율 정보를 가져오는데 실패한 경우 에러 처리
      return res.status(500).json({ error: 'Failed to fetch exchange rate' });
    }

    const markets = coins.map(coin => `KRW-${coin}`).join(','); // markets 파라미터 값 생성
    const params = new URLSearchParams({ markets }); // URLSearchParams 객체 생성
    const upbitResponse = await fetch(`https://api.upbit.com/v1/ticker?${params.toString()}`, {
      method: 'GET', // 명시적으로 GET 메서드 지정 (필수는 아니지만 명확성을 위해 추가)
    }); // fetch API 호출 (params 옵션 제거)
    if (!upbitResponse.ok) {
      throw new Error(`Upbit API error! status: ${upbitResponse.status}`);
    }
    const upbitDataJson = await upbitResponse.json();

    const binanceData = await fetch('https://api.binance.com/api/v3/ticker/price');
    if (!binanceData.ok) {
      throw new Error(`Binance API error! status: ${binanceData.status}`);
    }
    const binanceDataJson = await binanceData.json();

    const coinData = [];
    for (const upbitCoin of upbitDataJson) {
      const symbol = upbitCoin.market.split('-')[1];
      const binanceCoin = binanceDataJson.find(bCoin => bCoin.symbol === symbol + 'USDT');
      const binancePriceInKrw = binanceCoin ? binanceCoin.price * exchangeRate : 0; // 바이낸스 가격을 원화로 환산
      const kimchiPremium = binanceCoin ? ((upbitCoin.trade_price - binancePriceInKrw) / binancePriceInKrw) * 100 : 0; // 김치 프리미엄 계산 (백분율)

      // 과거 데이터 가져오기 (지연 추가)
      await delay(1000); // 1초 지연
      const historicalData = await getHistoricalData(symbol, 360);

      coinData.push({
        symbol,
        upbitPrice: upbitCoin.trade_price,
        binancePrice: binanceCoin ? parseFloat(binanceCoin.price) : 0,
        kimchiPremium: kimchiPremium.toFixed(2),
        history: historicalData ? {
          day1: getPriceByDate(historicalData.upbit, 1) || 0,
          day7: getPriceByDate(historicalData.upbit, 7) || 0,
          day30: getPriceByDate(historicalData.upbit, 30) || 0,
          day180: getPriceByDate(historicalData.upbit, 180) || 0,
          day360: getPriceByDate(historicalData.upbit, 365) || 0,
        } : {
          day1: 0,
          day7: 0,
          day30: 0,
          day180: 0,
          day365: 0,
        }
      });
    }

    res.json(coinData);
  } catch (error) {
    console.error('Error fetching coin prices:', error);
    res.status(500).json({ error: 'Failed to fetch coin prices' });
  }
});

// 날짜 기준으로 가격을 찾는 유틸리티 함수 수정
function getPriceByDate(data, daysAgo) {
  if (!data || data.length === 0) return null;

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() - daysAgo);
  const targetDateString = targetDate.toISOString().split('T')[0]; // YYYY-MM-DD 형식

  // 정확한 날짜의 데이터를 찾음
  const found = data.find(item => {
    const itemDate = new Date(item.date).toISOString().split('T')[0];
    return itemDate === targetDateString;
  });

  return found ? found.price : null;
}

const httpsOptions = { // HTTPS 옵션 설정
  key: fs.readFileSync(__dirname + '/localhost-key.pem'), // 개인 키 파일 경로 수정
  cert: fs.readFileSync(__dirname + '/localhost.pem'),     // 인증서 파일 경로 수정
};

const httpsServer = https.createServer(httpsOptions, app); // HTTPS 서버 생성, 기존 HTTP 앱 사용

const HTTP_PORT = 5000; // HTTP 포트 (필요한 경우)
const HTTPS_PORT = 5001; // HTTPS 포트

{{/* app.listen(HTTP_PORT, () => { // 기존 HTTP 서버 시작 (필요한 경우)
  console.log(`HTTP Server listening on port ${HTTP_PORT}`);
}); */}}

httpsServer.listen(HTTPS_PORT, () => { // HTTPS 서버 시작
  console.log(`HTTPS Server listening on port ${HTTPS_PORT}`);
});