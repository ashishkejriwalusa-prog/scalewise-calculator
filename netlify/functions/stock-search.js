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
  const query = String(params.q || '').trim();
  const market = String(params.market || '').trim().toLowerCase();

  if (!query) {
    return { statusCode: 400, headers, body: JSON.stringify({ error: 'Missing q query parameter.' }) };
  }

  const explicitAliases = {
    amazon: { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NMS', market: 'U.S.' },
    apple: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NMS', market: 'U.S.' },
    microsoft: { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NMS', market: 'U.S.' },
    nvidia: { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NMS', market: 'U.S.' },
    alphabet: { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NMS', market: 'U.S.' },
    google: { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NMS', market: 'U.S.' },
    meta: { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NMS', market: 'U.S.' },
    tesla: { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NMS', market: 'U.S.' },
    reliance: { symbol: 'RELIANCE.NS', name: 'Reliance Industries Limited', exchange: 'NSI', market: 'India' },
    nhpc: { symbol: 'NHPC.NS', name: 'NHPC Limited', exchange: 'NSI', market: 'India' },
    tcs: { symbol: 'TCS.NS', name: 'Tata Consultancy Services Limited', exchange: 'NSI', market: 'India' },
    infosys: { symbol: 'INFY.NS', name: 'Infosys Limited', exchange: 'NSI', market: 'India' },
    hdfc: { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', exchange: 'NSI', market: 'India' },
    'hdfc bank': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', exchange: 'NSI', market: 'India' },
    icici: { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited', exchange: 'NSI', market: 'India' },
    'icici bank': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited', exchange: 'NSI', market: 'India' },
    airtel: { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Limited', exchange: 'NSI', market: 'India' },
    'bharti airtel': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Limited', exchange: 'NSI', market: 'India' },
    'larsen and toubro': { symbol: 'LT.NS', name: 'Larsen & Toubro Limited', exchange: 'NSI', market: 'India' },
    larsen: { symbol: 'LT.NS', name: 'Larsen & Toubro Limited', exchange: 'NSI', market: 'India' },
    'state bank of india': { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSI', market: 'India' },
    sbi: { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSI', market: 'India' }
  };

  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (explicitAliases[normalized]) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ query, result: explicitAliases[normalized], source: 'resolver-alias' })
    };
  }

  try {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=12&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' }
    });
    const data = await response.json();

    if (!response.ok || !Array.isArray(data.quotes)) {
      throw new Error('Search provider returned no quotes.');
    }

    const quotes = data.quotes
      .filter(item => item && item.symbol && ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX'].includes(String(item.quoteType || '').toUpperCase()))
      .map(item => ({
        symbol: item.symbol,
        name: item.longname || item.shortname || item.symbol,
        exchange: item.exchange || item.exchDisp || '',
        market: String(item.symbol).endsWith('.NS') || String(item.symbol).endsWith('.BO') ? 'India' : 'U.S.',
        quoteType: item.quoteType || '',
        score: 0
      }));

    if (!quotes.length) {
      throw new Error('No tradable stock result matched this search.');
    }

    function score(item) {
      let value = 0;
      const symbol = String(item.symbol || '').toUpperCase();
      const name = String(item.name || '').toLowerCase();
      const q = query.toLowerCase();
      const qUpper = query.toUpperCase();
      if (symbol === qUpper) value += 100;
      if (symbol.replace('.NS', '').replace('.BO', '') === qUpper) value += 80;
      if (name === q) value += 70;
      if (name.startsWith(q)) value += 50;
      if (name.includes(q)) value += 30;
      if (market === 'india' && (symbol.endsWith('.NS') || symbol.endsWith('.BO'))) value += 35;
      if (market === 'us' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO')) value += 20;
      if (String(item.quoteType || '').toUpperCase() === 'EQUITY') value += 10;
      return value;
    }

    quotes.forEach(item => { item.score = score(item); });
    quotes.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ query, result: quotes[0], alternatives: quotes.slice(1, 6), source: 'search-provider' })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ query, error: error.message || 'Stock search could not resolve this company.' })
    };
  }
};
