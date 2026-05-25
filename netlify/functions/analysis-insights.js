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

  const isIndia = symbol.endsWith('.NS') || symbol.endsWith('.BO');
  const cleanSymbol = symbol.replace(/\.NS$|\.BO$/i, '');
  const finnhubKey = process.env.FINNHUB_API_KEY || '';
  const polygonKey = process.env.POLYGON_API_KEY || process.env.MASSIVE_API_KEY || '';
  const fmpKey = process.env.FMP_API_KEY || process.env.FINANCIAL_MODELING_PREP_API_KEY || '';

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const from = fromDate.toISOString().slice(0, 10);

  async function fetchJson(url, options = {}) {
    const response = await fetch(url, options);
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || data.message || `Request failed: ${response.status}`);
    return data;
  }

  function uniqueNews(items) {
    const seen = new Set();
    return items
      .filter(item => item && item.headline)
      .map(item => ({
        headline: String(item.headline || '').trim(),
        summary: String(item.summary || '').trim(),
        source: String(item.source || '').trim(),
        datetime: item.datetime || item.published_utc || item.publishedDate || null,
        url: item.url || item.article_url || ''
      }))
      .filter(item => {
        const key = item.headline.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, 10);
  }

  async function getFinnhubInsights() {
    if (!finnhubKey) return { recommendation: null, news: [], source: null };
    const recommendationUrl = `https://finnhub.io/api/v1/stock/recommendation?symbol=${encodeURIComponent(symbol)}&token=${encodeURIComponent(finnhubKey)}`;
    const newsUrl = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(symbol)}&from=${from}&to=${to}&token=${encodeURIComponent(finnhubKey)}`;
    const [recommendationData, newsData] = await Promise.all([
      fetchJson(recommendationUrl).catch(() => []),
      fetchJson(newsUrl).catch(() => [])
    ]);
    return {
      recommendation: Array.isArray(recommendationData) && recommendationData.length ? recommendationData[0] : null,
      news: uniqueNews(Array.isArray(newsData) ? newsData : []),
      source: 'Finnhub recommendation + company news'
    };
  }

  async function getPolygonNews() {
    if (!polygonKey || isIndia) return [];
    const url = `https://api.polygon.io/v2/reference/news?ticker=${encodeURIComponent(cleanSymbol)}&order=desc&limit=10&sort=published_utc&apiKey=${encodeURIComponent(polygonKey)}`;
    const data = await fetchJson(url).catch(() => ({}));
    const results = Array.isArray(data.results) ? data.results : [];
    return uniqueNews(results.map(item => ({
      headline: item.title,
      summary: item.description || '',
      source: item.publisher && item.publisher.name ? item.publisher.name : 'Polygon/Massive',
      published_utc: item.published_utc,
      article_url: item.article_url
    })));
  }

  async function getFmpNews() {
    if (!fmpKey) return [];
    const ticker = isIndia ? symbol : cleanSymbol;
    const url = `https://financialmodelingprep.com/api/v3/stock_news?tickers=${encodeURIComponent(ticker)}&limit=10&apikey=${encodeURIComponent(fmpKey)}`;
    const data = await fetchJson(url).catch(() => []);
    return uniqueNews(Array.isArray(data) ? data.map(item => ({
      headline: item.title,
      summary: item.text || '',
      source: item.site || 'Financial Modeling Prep',
      publishedDate: item.publishedDate,
      url: item.url
    })) : []);
  }

  async function getInsiderActivity() {
    if (!fmpKey || isIndia) return [];
    const url = `https://financialmodelingprep.com/api/v4/insider-trading?symbol=${encodeURIComponent(cleanSymbol)}&page=0&apikey=${encodeURIComponent(fmpKey)}`;
    const data = await fetchJson(url).catch(() => []);
    return Array.isArray(data) ? data.slice(0, 8).map(item => ({
      owner: item.reportingName || item.name || 'Insider',
      type: item.transactionType || item.typeOfOwner || 'Transaction',
      securities: item.securitiesTransacted || item.transactionShares || item.securitiesOwned || null,
      price: item.price || item.transactionPrice || null,
      date: item.transactionDate || item.filingDate || item.acceptedDate || null,
      source: 'Financial Modeling Prep insider trading'
    })) : [];
  }

  try {
    const [finnhub, polygonNews, fmpNews, insiderActivity] = await Promise.all([
      getFinnhubInsights().catch(() => ({ recommendation: null, news: [], source: null })),
      getPolygonNews().catch(() => []),
      getFmpNews().catch(() => []),
      getInsiderActivity().catch(() => [])
    ]);

    const news = uniqueNews([...(polygonNews || []), ...(fmpNews || []), ...(finnhub.news || [])]);
    const sources = [
      polygonNews && polygonNews.length ? 'Polygon/Massive real-world company news' : null,
      fmpNews && fmpNews.length ? 'Financial Modeling Prep market news' : null,
      finnhub.source,
      insiderActivity && insiderActivity.length ? 'Financial Modeling Prep insider activity' : null
    ].filter(Boolean);

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        cleanSymbol,
        market: isIndia ? 'India' : 'U.S.',
        recommendation: finnhub.recommendation,
        news,
        insiderActivity,
        source: sources.length ? sources.join(' + ') : 'No live news/insider provider configured or returned data',
        from,
        to,
        message: news.length || insiderActivity.length ? 'Live market intelligence returned.' : 'Add POLYGON_API_KEY for U.S. news and FMP_API_KEY for insider/news expansion. India news availability depends on the provider plan.'
      })
    };
  } catch (error) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        symbol,
        recommendation: null,
        news: [],
        insiderActivity: [],
        source: 'Real-time analysis intelligence',
        error: error.message || 'Analysis insights unavailable.'
      })
    };
  }
};
