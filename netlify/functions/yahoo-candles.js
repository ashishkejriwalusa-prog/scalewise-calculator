exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: JSON.stringify({ ok: true }) };
  }

  try {
    const params = event.queryStringParameters || {};
    const symbol = (params.symbol || '').trim().toUpperCase();
    const requestedInterval = (params.interval || '1d').trim();

    if (!symbol) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing symbol query parameter.' }) };
    }

    const intervalMap = {
      '1': '1m',
      '5': '5m',
      '15': '15m',
      '30': '30m',
      '60': '60m',
      'D': '1d',
      'W': '1wk'
    };

    const interval = intervalMap[requestedInterval] || requestedInterval || '1d';
    let range = '1y';
    if (['1m', '5m', '15m', '30m', '60m'].includes(interval)) range = '1mo';
    if (interval === '1wk') range = '5y';

    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${encodeURIComponent(interval)}&range=${encodeURIComponent(range)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0'
      }
    });

    const data = await response.json();

    if (!response.ok || !data.chart || data.chart.error) {
      return {
        statusCode: response.status || 500,
        headers,
        body: JSON.stringify({ error: data.chart && data.chart.error ? data.chart.error.description : 'Yahoo candle request failed.' })
      };
    }

    const result = data.chart.result && data.chart.result[0];
    if (!result || !result.timestamp || !result.indicators || !result.indicators.quote || !result.indicators.quote[0]) {
      return { statusCode: 200, headers, body: JSON.stringify({ symbol, status: 'no_data', candles: [] }) };
    }

    const quote = result.indicators.quote[0];
    const timestamps = result.timestamp;
    const candles = [];

    for (let i = 0; i < timestamps.length; i++) {
      const open = quote.open && quote.open[i];
      const high = quote.high && quote.high[i];
      const low = quote.low && quote.low[i];
      const close = quote.close && quote.close[i];
      const volume = quote.volume && quote.volume[i];

      if ([open, high, low, close].every(v => typeof v === 'number' && Number.isFinite(v))) {
        candles.push({
          time: timestamps[i],
          open,
          high,
          low,
          close,
          volume: typeof volume === 'number' ? volume : null
        });
      }
    }

    const meta = result.meta || {};

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        status: candles.length ? 'ok' : 'no_data',
        interval,
        range,
        currency: meta.currency || '',
        exchangeName: meta.exchangeName || '',
        regularMarketPrice: meta.regularMarketPrice || null,
        candles,
        source: 'Yahoo Finance fallback'
      })
    };
  } catch (error) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: error.message || 'Unexpected Yahoo candle function error.' }) };
  }
};
