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
    amazon: { symbol: 'AMZN', name: 'Amazon.com, Inc.', exchange: 'NASDAQ', market: 'U.S.' },
    apple: { symbol: 'AAPL', name: 'Apple Inc.', exchange: 'NASDAQ', market: 'U.S.' },
    microsoft: { symbol: 'MSFT', name: 'Microsoft Corporation', exchange: 'NASDAQ', market: 'U.S.' },
    nvidia: { symbol: 'NVDA', name: 'NVIDIA Corporation', exchange: 'NASDAQ', market: 'U.S.' },
    alphabet: { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', market: 'U.S.' },
    google: { symbol: 'GOOGL', name: 'Alphabet Inc.', exchange: 'NASDAQ', market: 'U.S.' },
    meta: { symbol: 'META', name: 'Meta Platforms, Inc.', exchange: 'NASDAQ', market: 'U.S.' },
    tesla: { symbol: 'TSLA', name: 'Tesla, Inc.', exchange: 'NASDAQ', market: 'U.S.' },
    reliance: { symbol: 'RELIANCE.NS', name: 'Reliance Industries Limited', exchange: 'NSE', market: 'India' },
    nhpc: { symbol: 'NHPC.NS', name: 'NHPC Limited', exchange: 'NSE', market: 'India' },
    tcs: { symbol: 'TCS.NS', name: 'Tata Consultancy Services Limited', exchange: 'NSE', market: 'India' },
    infosys: { symbol: 'INFY.NS', name: 'Infosys Limited', exchange: 'NSE', market: 'India' },
    hdfc: { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', exchange: 'NSE', market: 'India' },
    'hdfc bank': { symbol: 'HDFCBANK.NS', name: 'HDFC Bank Limited', exchange: 'NSE', market: 'India' },
    icici: { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited', exchange: 'NSE', market: 'India' },
    'icici bank': { symbol: 'ICICIBANK.NS', name: 'ICICI Bank Limited', exchange: 'NSE', market: 'India' },
    airtel: { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Limited', exchange: 'NSE', market: 'India' },
    'bharti airtel': { symbol: 'BHARTIARTL.NS', name: 'Bharti Airtel Limited', exchange: 'NSE', market: 'India' },
    'larsen and toubro': { symbol: 'LT.NS', name: 'Larsen & Toubro Limited', exchange: 'NSE', market: 'India' },
    larsen: { symbol: 'LT.NS', name: 'Larsen & Toubro Limited', exchange: 'NSE', market: 'India' },
    'state bank of india': { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSE', market: 'India' },
    sbi: { symbol: 'SBIN.NS', name: 'State Bank of India', exchange: 'NSE', market: 'India' }
  };

  const normalized = query.toLowerCase().replace(/\s+/g, ' ').trim();
  if (explicitAliases[normalized]) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ query, result: explicitAliases[normalized], source: 'resolver-alias' })
    };
  }

  function toScaleWiseSymbol(item) {
    const rawSymbol = String(item.symbol || '').toUpperCase();
    const exchange = String(item.exchange || item.exchange_short_name || item.exchDisp || '').toUpperCase();
    if (!rawSymbol) return '';
    if (rawSymbol.includes('.')) return rawSymbol;
    if (exchange === 'NSE' || exchange === 'NSI') return rawSymbol + '.NS';
    if (exchange === 'BSE' || exchange === 'BOM') return rawSymbol + '.BO';
    return rawSymbol;
  }

  function classifyMarket(symbol, exchange) {
    const sym = String(symbol || '').toUpperCase();
    const ex = String(exchange || '').toUpperCase();
    if (sym.endsWith('.NS') || sym.endsWith('.BO') || ex === 'NSE' || ex === 'BSE' || ex === 'NSI' || ex === 'BOM') return 'India';
    if (ex === 'LSE') return 'UK';
    if (ex === 'TSX' || ex === 'TSXV') return 'Canada';
    return 'U.S.';
  }

  function score(item) {
    let value = 0;
    const symbol = String(item.symbol || '').toUpperCase();
    const cleanSymbol = symbol.replace('.NS', '').replace('.BO', '');
    const name = String(item.name || '').toLowerCase();
    const q = query.toLowerCase();
    const qUpper = query.toUpperCase();
    if (symbol === qUpper) value += 120;
    if (cleanSymbol === qUpper) value += 95;
    if (name === q) value += 80;
    if (name.startsWith(q)) value += 55;
    if (name.includes(q)) value += 35;
    if (market === 'india' && (symbol.endsWith('.NS') || symbol.endsWith('.BO'))) value += 45;
    if (market === 'us' && !symbol.endsWith('.NS') && !symbol.endsWith('.BO')) value += 25;
    if (String(item.quoteType || '').toUpperCase() === 'EQUITY') value += 10;
    return value;
  }

  async function tryTwelveDataSearch() {
    const key = process.env.TWELVE_DATA_API_KEY;
    if (!key) throw new Error('TWELVE_DATA_API_KEY not configured.');
    const url = `https://api.twelvedata.com/symbol_search?symbol=${encodeURIComponent(query)}&apikey=${encodeURIComponent(key)}&outputsize=20`;
    const response = await fetch(url);
    const data = await response.json();
    if (!response.ok || data.status === 'error' || !Array.isArray(data.data)) {
      throw new Error(data.message || 'Twelve Data search returned no result.');
    }
    const quotes = data.data
      .filter(item => item && item.symbol && /Common Stock|Equity|ETF|Index|Depositary/i.test(String(item.instrument_name || item.instrument_type || 'Common Stock')))
      .map(item => {
        const symbol = toScaleWiseSymbol(item);
        return {
          symbol,
          name: item.instrument_name || item.name || symbol,
          exchange: item.exchange || '',
          market: classifyMarket(symbol, item.exchange),
          quoteType: item.instrument_type || 'EQUITY',
          providerSymbol: item.symbol,
          provider: 'twelvedata',
          score: 0
        };
      });
    if (!quotes.length) throw new Error('No tradable Twelve Data stock result matched this search.');
    quotes.forEach(item => { item.score = score(item); });
    quotes.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return { query, result: quotes[0], alternatives: quotes.slice(1, 8), source: 'twelve-data-symbol-search' };
  }

  async function tryYahooSearch() {
    const url = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(query)}&quotesCount=15&newsCount=0&enableFuzzyQuery=true&quotesQueryId=tss_match_phrase_query`;
    const response = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0' } });
    const data = await response.json();
    if (!response.ok || !Array.isArray(data.quotes)) throw new Error('Search provider returned no quotes.');
    const quotes = data.quotes
      .filter(item => item && item.symbol && ['EQUITY', 'ETF', 'MUTUALFUND', 'INDEX'].includes(String(item.quoteType || '').toUpperCase()))
      .map(item => ({
        symbol: item.symbol,
        name: item.longname || item.shortname || item.symbol,
        exchange: item.exchange || item.exchDisp || '',
        market: classifyMarket(item.symbol, item.exchange || item.exchDisp),
        quoteType: item.quoteType || '',
        provider: 'yahoo',
        score: 0
      }));
    if (!quotes.length) throw new Error('No tradable stock result matched this search.');
    quotes.forEach(item => { item.score = score(item); });
    quotes.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name));
    return { query, result: quotes[0], alternatives: quotes.slice(1, 8), source: 'yahoo-symbol-search' };
  }

  try {
    try {
      const payload = await tryTwelveDataSearch();
      return { statusCode: 200, headers, body: JSON.stringify(payload) };
    } catch (primaryError) {
      const payload = await tryYahooSearch();
      payload.fallbackReason = primaryError.message;
      return { statusCode: 200, headers, body: JSON.stringify(payload) };
    }
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ query, error: error.message || 'Stock search could not resolve this company.' })
    };
  }
};
