exports.handler = async function(event) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers, body: '' };
  }

  const q = event.queryStringParameters || {};
  const from = String(q.from || 'USD').trim().toUpperCase();
  const to = String(q.to || 'INR').trim().toUpperCase();
  const amount = Number(q.amount || 1) > 0 ? Number(q.amount || 1) : 1;

  const fallbackUsdRates = {
    USD: 1,
    INR: 83.2,
    EUR: 0.92,
    GBP: 0.79,
    JPY: 157,
    CNY: 7.24,
    CAD: 1.36,
    AUD: 1.50,
    NZD: 1.63,
    CHF: 0.89,
    SGD: 1.35,
    HKD: 7.81,
    AED: 3.6725,
    SAR: 3.75,
    QAR: 3.64,
    KWD: 0.31,
    BHD: 0.376,
    OMR: 0.385,
    ZAR: 18.2,
    BRL: 5.15,
    MXN: 17.0,
    KRW: 1365,
    THB: 36.6,
    MYR: 4.70,
    IDR: 16200,
    PHP: 58.0,
    VND: 25400,
    TRY: 32.5,
    SEK: 10.6,
    NOK: 10.7,
    DKK: 6.86,
    PLN: 3.95,
    CZK: 22.8,
    HUF: 360,
    ILS: 3.70,
    EGP: 47.8,
    NGN: 1500,
    KES: 129,
    GHS: 15.0,
    PKR: 278,
    BDT: 117,
    LKR: 302,
    NPR: 133,
    RUB: 90
  };

  function fallbackRate(base, target) {
    if (base === target) return 1;
    const basePerUsd = fallbackUsdRates[base];
    const targetPerUsd = fallbackUsdRates[target];
    if (!basePerUsd || !targetPerUsd) return null;
    return targetPerUsd / basePerUsd;
  }

  try {
    if (!/^[A-Z]{3}$/.test(from) || !/^[A-Z]{3}$/.test(to)) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Use valid three-letter currency codes.' }) };
    }

    if (from === to) {
      return { statusCode: 200, headers, body: JSON.stringify({ from, to, amount, rate: 1, converted: amount, source: 'same currency', timestamp: new Date().toISOString() }) };
    }

    const url = `https://open.er-api.com/v6/latest/${encodeURIComponent(from)}`;
    const response = await fetch(url, { headers: { accept: 'application/json' } });
    const data = await response.json();

    if (response.ok && data && data.result === 'success' && data.rates && Number(data.rates[to])) {
      const rate = Number(data.rates[to]);
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          from,
          to,
          amount,
          rate,
          converted: amount * rate,
          source: 'open.er-api.com',
          timestamp: data.time_last_update_utc || new Date().toISOString()
        })
      };
    }

    const fallback = fallbackRate(from, to);
    if (fallback) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ from, to, amount, rate: fallback, converted: amount * fallback, source: 'backup USD cross-rate table', timestamp: new Date().toISOString(), warning: 'Live provider did not return this pair.' })
      };
    }

    return { statusCode: 404, headers, body: JSON.stringify({ error: `Rate unavailable for ${from}/${to}` }) };
  } catch (err) {
    const fallback = fallbackRate(from, to);
    if (fallback) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ from, to, amount, rate: fallback, converted: amount * fallback, source: 'backup USD cross-rate table', timestamp: new Date().toISOString(), warning: 'Live provider failed; fallback used.' })
      };
    }
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message || 'FX conversion failed.' }) };
  }
};
