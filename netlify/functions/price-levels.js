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

  const params = event.queryStringParameters || {};
  const symbol = (params.symbol || '').trim().toUpperCase();
  if (!symbol) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing symbol query parameter.' }) };
  }

  try {
    const quoteUrl = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(symbol)}`;
    const response = await fetch(quoteUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' }
    });
    const data = await response.json();
    const result = data && data.quoteResponse && data.quoteResponse.result && data.quoteResponse.result[0];

    if (!response.ok || !result) {
      throw new Error('No Yahoo price-level data returned.');
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        providerSymbol: result.symbol || symbol,
        currency: result.currency || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD'),
        price: result.regularMarketPrice || null,
        dayHigh: result.regularMarketDayHigh || null,
        dayLow: result.regularMarketDayLow || null,
        fiftyTwoWeekHigh: result.fiftyTwoWeekHigh || null,
        fiftyTwoWeekLow: result.fiftyTwoWeekLow || null,
        previousClose: result.regularMarketPreviousClose || null,
        source: 'Yahoo Finance quote data',
        timestamp: result.regularMarketTime || null
      })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        error: error.message || 'Price level data unavailable.'
      })
    };
  }
};
