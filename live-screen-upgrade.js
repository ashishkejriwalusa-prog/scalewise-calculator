(function () {
  const LIVE_QUOTE_MS = 15000;
  const LIVE_CANDLE_MS = 60000;
  const CLOSED_QUOTE_MS = 120000;
  const CLOSED_CANDLE_MS = 300000;

  let quoteTimer = null;
  let candleTimer = null;
  let badgeReady = false;
  let lastLiveMode = null;

  function text(value) {
    return String(value == null ? '' : value);
  }

  function ensureLiveStyles() {
    if (document.getElementById('liveScreenUpgradeStyles')) return;
    const style = document.createElement('style');
    style.id = 'liveScreenUpgradeStyles';
    style.textContent = `
      .chartLiveMeta{display:flex;align-items:center;justify-content:flex-end;gap:10px;flex-wrap:wrap;text-align:right}
      .liveBadge{display:inline-flex;align-items:center;gap:8px;border-radius:999px;padding:7px 11px;font-size:11px;font-weight:900;letter-spacing:.06em;text-transform:uppercase;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);color:#cbd5e1}
      .liveBadge.is-open{color:#86efac;border-color:rgba(34,197,94,.42);background:rgba(34,197,94,.12)}
      .liveBadge.is-closed{color:#fcd34d;border-color:rgba(245,158,11,.42);background:rgba(245,158,11,.12)}
      .livePulse{width:8px;height:8px;border-radius:50%;background:currentColor;box-shadow:0 0 0 0 rgba(34,197,94,.55);animation:livePulse 1.8s infinite}
      .liveBadge.is-closed .livePulse{animation:none;opacity:.7}
      .chartLivePrice{font-size:16px;font-weight:900;color:#f8fafc;white-space:nowrap}
      .chartLivePrice .pos{color:#86efac}
      .chartLivePrice .neg{color:#fca5a5}
      .chartLiveClock{display:block;font-size:11px;color:#94a3b8;margin-top:4px}
      @keyframes livePulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 10px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
      @media(max-width:760px){.chartHeader{align-items:flex-start;flex-direction:column}.chartLiveMeta{text-align:left;justify-content:flex-start}.chartLivePrice{font-size:15px}}
    `;
    document.head.appendChild(style);
  }

  function ensureLiveHeader() {
    if (badgeReady) return;
    const status = document.getElementById('chartStatus');
    if (!status || !status.parentElement) return;

    const existingParent = status.parentElement;
    const wrapper = document.createElement('div');
    wrapper.className = 'chartLiveMeta';
    wrapper.id = 'chartLiveMeta';

    const badge = document.createElement('span');
    badge.id = 'chartLiveBadge';
    badge.className = 'liveBadge is-closed';
    badge.innerHTML = '<span class="livePulse"></span><span id="chartLiveBadgeText">Market status</span>';

    const priceWrap = document.createElement('div');
    priceWrap.innerHTML = '<div id="chartLivePrice" class="chartLivePrice">Live price loading…</div><span id="chartLiveClock" class="chartLiveClock">Waiting for update</span>';

    status.style.display = 'none';
    wrapper.appendChild(badge);
    wrapper.appendChild(priceWrap);
    existingParent.appendChild(wrapper);
    badgeReady = true;
  }

  function getTimeParts(timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());
    const mapped = {};
    for (const part of parts) mapped[part.type] = part.value;
    return {
      weekday: mapped.weekday,
      hour: Number(mapped.hour || 0),
      minute: Number(mapped.minute || 0),
      second: Number(mapped.second || 0)
    };
  }

  function marketModeForSelected() {
    const asset = typeof selected !== 'undefined' ? selected : null;
    const market = text(asset && asset.market).toLowerCase();
    const symbol = text(asset && asset.quoteSymbol).toUpperCase();

    if (market === 'fx' || ['USDINR', 'EURUSD', 'GBPUSD', 'USDJPY', 'USDCAD', 'AUDUSD', 'NZDUSD', 'USDSGD', 'USDAED', 'USDCNY', 'USDRUB', 'USDKWD'].includes(symbol)) {
      const utc = getTimeParts('UTC');
      const open = utc.weekday !== 'Sat' && utc.weekday !== 'Sun';
      return { open, label: open ? 'FX market active' : 'FX weekend pause', exchange: 'FX', timezone: '24/5' };
    }

    if (market === 'india' || symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
      const india = getTimeParts('Asia/Kolkata');
      const weekdayOpen = !['Sat', 'Sun'].includes(india.weekday);
      const minutes = india.hour * 60 + india.minute;
      const open = weekdayOpen && minutes >= 9 * 60 + 15 && minutes <= 15 * 60 + 30;
      return { open, label: open ? 'NSE/BSE live' : 'NSE/BSE closed', exchange: 'India', timezone: 'IST' };
    }

    const ny = getTimeParts('America/New_York');
    const weekdayOpen = !['Sat', 'Sun'].includes(ny.weekday);
    const minutes = ny.hour * 60 + ny.minute;
    const open = weekdayOpen && minutes >= 9 * 60 + 30 && minutes <= 16 * 60;
    return { open, label: open ? 'U.S. market live' : 'U.S. market closed', exchange: 'U.S.', timezone: 'ET' };
  }

  function formatPrice(value, currency) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'Price unavailable';
    const normalizedCurrency = text(currency || '').toUpperCase();
    const prefix = normalizedCurrency === 'INR' ? '₹' : normalizedCurrency === 'USD' ? '$' : normalizedCurrency ? normalizedCurrency + ' ' : '';
    return prefix + amount.toFixed(amount >= 100 ? 2 : 4);
  }

  function updateHeaderFromQuote(data) {
    const priceNode = document.getElementById('chartLivePrice');
    const clockNode = document.getElementById('chartLiveClock');
    if (!priceNode || !clockNode) return;

    if (!data || !Number.isFinite(Number(data.price))) {
      priceNode.textContent = 'Live price unavailable';
      clockNode.textContent = 'Latest quote could not be loaded';
      return;
    }

    const price = formatPrice(data.price, data.currency);
    const change = Number(data.change || 0);
    const changePercent = Number(data.changePercent || 0);
    const sign = change > 0 ? '+' : '';
    const cls = change > 0 ? 'pos' : change < 0 ? 'neg' : '';
    priceNode.innerHTML = `${price} <span class="${cls}">${sign}${change.toFixed(2)} (${sign}${changePercent.toFixed(2)}%)</span>`;
    const when = data.timestamp ? new Date(Number(data.timestamp) * 1000) : new Date();
    clockNode.textContent = `Quote updated ${when.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;
  }

  function updateBadge() {
    ensureLiveStyles();
    ensureLiveHeader();
    const badge = document.getElementById('chartLiveBadge');
    const textNode = document.getElementById('chartLiveBadgeText');
    if (!badge || !textNode) return marketModeForSelected();

    const mode = marketModeForSelected();
    badge.classList.toggle('is-open', mode.open);
    badge.classList.toggle('is-closed', !mode.open);
    textNode.textContent = mode.label;
    return mode;
  }

  async function fetchLiveQuoteForSelected() {
    const asset = typeof selected !== 'undefined' ? selected : null;
    if (!asset || !asset.quoteSymbol) return;

    try {
      const response = await fetch('/.netlify/functions/finnhub-quote?symbol=' + encodeURIComponent(asset.quoteSymbol));
      const data = await response.json();
      if (!response.ok || data.error || !Number.isFinite(Number(data.price))) {
        throw new Error(data.error || 'Quote unavailable.');
      }

      if (typeof lastQuote !== 'undefined') lastQuote = data;
      updateHeaderFromQuote(data);

      const priceCard = document.getElementById('livePrice');
      if (priceCard) {
        const sign = Number(data.change) >= 0 ? '+' : '';
        priceCard.innerHTML = `${data.currency || ''} ${Number(data.price).toFixed(2)} <span class="${Number(data.change) >= 0 ? 'pos' : 'neg'}" style="font-size:18px">${sign}${Number(data.change || 0).toFixed(2)} (${sign}${Number(data.changePercent || 0).toFixed(2)}%)</span>`;
      }

      const source = document.getElementById('quoteSource');
      if (source) source.textContent = `Source: ${data.source || 'live quote'} · ${new Date().toLocaleString()}`;

      if (typeof renderForecast === 'function') renderForecast();
      if (typeof renderAnalysis === 'function') renderAnalysis();
    } catch (error) {
      updateHeaderFromQuote(null);
    }
  }

  function refreshCandlesForSelected() {
    const mode = marketModeForSelected();
    if (!mode.open) return;
    if (typeof reloadCandles === 'function') reloadCandles();
    else if (typeof loadCandles === 'function' && typeof selected !== 'undefined' && selected && selected.quoteSymbol) loadCandles(selected.quoteSymbol);
  }

  function clearTimers() {
    if (quoteTimer) clearInterval(quoteTimer);
    if (candleTimer) clearInterval(candleTimer);
    quoteTimer = null;
    candleTimer = null;
  }

  function startMarketAwareLiveMode() {
    ensureLiveStyles();
    ensureLiveHeader();
    const mode = updateBadge();
    clearTimers();

    const quoteMs = mode.open ? LIVE_QUOTE_MS : CLOSED_QUOTE_MS;
    const candleMs = mode.open ? LIVE_CANDLE_MS : CLOSED_CANDLE_MS;
    lastLiveMode = mode.open;

    fetchLiveQuoteForSelected();
    if (mode.open) refreshCandlesForSelected();

    quoteTimer = setInterval(() => {
      const currentMode = updateBadge();
      if (currentMode.open !== lastLiveMode) {
        startMarketAwareLiveMode();
        return;
      }
      if (!document.hidden) fetchLiveQuoteForSelected();
    }, quoteMs);

    candleTimer = setInterval(() => {
      const currentMode = updateBadge();
      if (currentMode.open !== lastLiveMode) {
        startMarketAwareLiveMode();
        return;
      }
      if (!document.hidden) refreshCandlesForSelected();
    }, candleMs);
  }

  function wrapFunction(name) {
    const install = () => {
      if (typeof window[name] !== 'function') {
        setTimeout(install, 120);
        return;
      }
      const original = window[name];
      window[name] = function wrapped() {
        const result = original.apply(this, arguments);
        setTimeout(startMarketAwareLiveMode, 220);
        return result;
      };
    };
    install();
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) startMarketAwareLiveMode();
  });

  ensureLiveStyles();
  setTimeout(startMarketAwareLiveMode, 800);
  wrapFunction('selectAsset');
  wrapFunction('loadSelectedSymbol');
  wrapFunction('searchStock');
})();