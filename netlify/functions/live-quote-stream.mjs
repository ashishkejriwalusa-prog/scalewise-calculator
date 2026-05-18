const fxYahooSymbols = {
  USDINR: 'INR=X',
  EURUSD: 'EURUSD=X',
  GBPUSD: 'GBPUSD=X',
  USDJPY: 'JPY=X',
  USDCAD: 'CAD=X',
  AUDUSD: 'AUDUSD=X',
  NZDUSD: 'NZDUSD=X',
  USDSGD: 'SGD=X',
  USDAED: 'AED=X',
  USDCNY: 'CNY=X',
  USDRUB: 'RUB=X',
  USDKWD: 'KWD=X'
};

function finite(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isFx(symbol) {
  return Object.prototype.hasOwnProperty.call(fxYahooSymbols, symbol);
}

async function readJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      'User-Agent': 'Mozilla/5.0 ScaleWiseDirect/1.0',
      ...(options.headers || {})
    }
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Request failed: ${response.status}`);
  return data;
}

async function quoteFromFinnhub(symbol) {
  if (isFx(symbol)) throw new Error('FX routed to Yahoo streaming fallback.');
  const apiKey = process.env.FINNHUB_API_KEY || '';
  if (!apiKey) throw new Error('FINNHUB_API_KEY is not configured.');
  const data = await readJson(`https://finnhub.io/api/v1/quote?symbol=${encodeURIComponent(symbol)}&token=${apiKey}`);
  const price = finite(data.c);
  const previousClose = finite(data.pc);
  if (price === null) throw new Error('Finnhub returned no price.');
  const change = previousClose !== null ? price - previousClose : finite(data.d);
  const changePercent = previousClose ? (change / previousClose) * 100 : finite(data.dp);
  return {
    symbol,
    price,
    previousClose,
    change,
    changePercent,
    high: finite(data.h),
    low: finite(data.l),
    open: finite(data.o),
    timestamp: finite(data.t) || Math.floor(Date.now() / 1000),
    currency: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD',
    source: 'Finnhub live stream'
  };
}

async function quoteFromYahoo(symbol) {
  const providerSymbol = fxYahooSymbols[symbol] || symbol;
  const data = await readJson(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(providerSymbol)}?interval=1m&range=1d`);
  if (!data.chart || data.chart.error) {
    throw new Error(data.chart && data.chart.error ? data.chart.error.description : 'Yahoo stream quote failed.');
  }
  const result = data.chart.result && data.chart.result[0];
  const meta = result && result.meta;
  const quote = result && result.indicators && result.indicators.quote && result.indicators.quote[0];
  if (!meta) throw new Error('Yahoo returned no metadata.');
  const price = finite(meta.regularMarketPrice);
  const previousClose = finite(meta.chartPreviousClose) ?? finite(meta.previousClose);
  if (price === null) throw new Error('Yahoo returned no price.');
  const change = previousClose !== null ? price - previousClose : null;
  const changePercent = previousClose ? (change / previousClose) * 100 : null;
  const opens = quote && Array.isArray(quote.open) ? quote.open.map(finite).filter((value) => value !== null) : [];
  const highs = quote && Array.isArray(quote.high) ? quote.high.map(finite).filter((value) => value !== null) : [];
  const lows = quote && Array.isArray(quote.low) ? quote.low.map(finite).filter((value) => value !== null) : [];
  return {
    symbol,
    providerSymbol,
    price,
    previousClose,
    change,
    changePercent,
    high: finite(meta.regularMarketDayHigh) ?? (highs.length ? Math.max(...highs) : null),
    low: finite(meta.regularMarketDayLow) ?? (lows.length ? Math.min(...lows) : null),
    open: opens.length ? opens[0] : null,
    timestamp: finite(meta.regularMarketTime) || Math.floor(Date.now() / 1000),
    currency: meta.currency || (symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'INR' : 'USD'),
    source: isFx(symbol) ? 'Yahoo FX stream' : 'Yahoo streaming fallback'
  };
}

async function getQuote(symbol) {
  try {
    return await quoteFromFinnhub(symbol);
  } catch (error) {
    const fallback = await quoteFromYahoo(symbol);
    fallback.fallbackReason = error.message;
    return fallback;
  }
}

function sse(event, payload) {
  return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
}

export default async (request) => {
  const url = new URL(request.url);
  const symbol = String(url.searchParams.get('symbol') || '').trim().toUpperCase();
  if (!symbol) {
    return new Response(JSON.stringify({ error: 'Missing symbol query parameter.' }), {
      status: 400,
      headers: { 'content-type': 'application/json' }
    });
  }

  const encoder = new TextEncoder();
  const body = new ReadableStream({
    async start(controller) {
      controller.enqueue(encoder.encode(sse('status', {
        symbol,
        status: 'connected',
        message: 'Live stream opened',
        timestamp: Date.now()
      })));

      let pushes = 0;
      const streamStartedAt = Date.now();
      const timer = setInterval(async () => {
        try {
          const quote = await getQuote(symbol);
          controller.enqueue(encoder.encode(sse('quote', quote)));
        } catch (error) {
          controller.enqueue(encoder.encode(sse('stream-error', {
            symbol,
            error: error.message || 'Live stream quote unavailable.',
            timestamp: Date.now()
          })));
        }
        pushes += 1;
        if (pushes >= 4 || Date.now() - streamStartedAt >= 9000) {
          controller.enqueue(encoder.encode(sse('status', {
            symbol,
            status: 'reconnect',
            message: 'Stream window complete; browser will reconnect.',
            timestamp: Date.now()
          })));
          clearInterval(timer);
          controller.close();
        }
      }, 2000);
    }
  });

  return new Response(body, {
    headers: {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache, no-transform',
      'connection': 'keep-alive',
      'access-control-allow-origin': '*'
    }
  });
};