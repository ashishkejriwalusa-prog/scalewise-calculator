(function () {
  let liveEventSource = null;
  let streamReconnectTimer = null;
  let streamHeartbeatTimer = null;
  let activeStreamSymbol = '';
  let activeLiveCandle = null;
  let lastStreamQuote = null;
  let latestVisualPriceLine = null;
  const selectedCurrencyPairsKey = 'scalewise-direct-multi-currency-v1';
  const availableCurrencyPairs = [
    { symbol: 'USDINR', label: 'USD/INR', note: 'Dollar vs Indian Rupee' },
    { symbol: 'EURUSD', label: 'EUR/USD', note: 'Euro vs Dollar' },
    { symbol: 'GBPUSD', label: 'GBP/USD', note: 'Pound vs Dollar' },
    { symbol: 'USDJPY', label: 'USD/JPY', note: 'Dollar vs Yen' },
    { symbol: 'USDCAD', label: 'USD/CAD', note: 'Dollar vs Canadian Dollar' },
    { symbol: 'AUDUSD', label: 'AUD/USD', note: 'Australian Dollar vs Dollar' },
    { symbol: 'NZDUSD', label: 'NZD/USD', note: 'New Zealand Dollar vs Dollar' },
    { symbol: 'USDSGD', label: 'USD/SGD', note: 'Dollar vs Singapore Dollar' },
    { symbol: 'USDAED', label: 'USD/AED', note: 'Dollar vs UAE Dirham' },
    { symbol: 'USDCNY', label: 'USD/CNY', note: 'Dollar vs Chinese Yuan' },
    { symbol: 'USDRUB', label: 'USD/RUB', note: 'Dollar vs Russian Ruble' },
    { symbol: 'USDKWD', label: 'USD/KWD', note: 'Dollar vs Kuwaiti Dinar' }
  ];

  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, (char) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[char]));
  }

  function number(value, digits = 2) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed.toFixed(digits) : '—';
  }

  function money(value, currency) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    const prefix = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency ? currency + ' ' : '';
    return prefix + parsed.toFixed(parsed >= 100 ? 2 : 4);
  }

  function percent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    return `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%`;
  }

  function selectedAsset() {
    return typeof selected !== 'undefined' ? selected : null;
  }

  function selectedResolution() {
    const resolution = document.getElementById('resolutionSelect');
    return resolution ? resolution.value : 'D';
  }

  function isMarketLiveForSelected() {
    if (typeof marketModeForSelected === 'function') return marketModeForSelected();
    const asset = selectedAsset();
    const market = String(asset && asset.market || '').toLowerCase();
    if (market === 'fx') return { open: true, label: 'FX active', exchange: 'FX' };
    return { open: true, label: 'Live mode', exchange: market || 'Market' };
  }

  function ensureStyles() {
    if (document.getElementById('streamingCurrencyUpgradeStyles')) return;
    const style = document.createElement('style');
    style.id = 'streamingCurrencyUpgradeStyles';
    style.textContent = `
      .liveChartStreamOverlay{position:absolute;left:18px;top:76px;z-index:12;display:flex;align-items:center;gap:10px;flex-wrap:wrap;pointer-events:none}
      .liveChartStreamBadge{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;border:1px solid rgba(34,197,94,.44);background:rgba(5,11,20,.88);backdrop-filter:blur(10px);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#86efac;box-shadow:0 18px 40px rgba(0,0,0,.28)}
      .liveChartStreamBadge.waiting{color:#fde68a;border-color:rgba(245,158,11,.42)}
      .liveChartStreamBadge.off{color:#fca5a5;border-color:rgba(239,68,68,.42)}
      .liveChartStreamPulse{width:9px;height:9px;border-radius:50%;background:currentColor;animation:streamPulse 1.45s infinite}
      .liveChartStreamBadge.waiting .liveChartStreamPulse,.liveChartStreamBadge.off .liveChartStreamPulse{animation:none}
      .liveChartMicroPrice{display:inline-flex;align-items:center;gap:8px;padding:9px 12px;border-radius:999px;border:1px solid rgba(255,255,255,.12);background:rgba(5,11,20,.88);backdrop-filter:blur(10px);font-size:13px;font-weight:900;color:#f8fafc;box-shadow:0 18px 40px rgba(0,0,0,.28)}
      .liveChartMicroPrice .pos{color:#86efac}.liveChartMicroPrice .neg{color:#fca5a5}
      .liveChartStreamFlash{animation:chartQuoteFlash .7s ease-out}
      @keyframes streamPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.58)}70%{box-shadow:0 0 0 12px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
      @keyframes chartQuoteFlash{0%{filter:brightness(1.55)}100%{filter:brightness(1)}}
      .streamPanel{background:#08111f;border:1px solid var(--line);border-radius:22px;padding:18px;margin-top:18px}
      .streamHeader{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
      .streamHeader h3{margin:8px 0 4px;font-size:24px;letter-spacing:-.03em}
      .streamHeader p{margin:0;color:#cbd5e1;font-size:14px;line-height:1.6}
      .streamStatus{display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#cbd5e1}
      .streamStatus.live{color:#86efac;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.4)}
      .streamPulse{width:8px;height:8px;border-radius:50%;background:currentColor;animation:streamPulse 1.6s infinite}
      .multiCurrencyWrap{display:grid;gap:16px}
      .currencySelectorGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}
      .currencyChoice{display:flex;align-items:flex-start;gap:10px;background:#08111f;border:1px solid var(--line);border-radius:16px;padding:13px;cursor:pointer}
      .currencyChoice input{width:auto;margin-top:3px}
      .currencyChoice b{display:block;font-size:15px}.currencyChoice span{display:block;font-size:12px;color:#94a3b8;margin-top:4px;line-height:1.45}
      .currencyActions{display:flex;gap:10px;flex-wrap:wrap;align-items:center}
      .currencyCompareGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:14px}
      .currencyCard{background:#08111f;border:1px solid var(--line);border-radius:18px;padding:16px}
      .currencyCard h4{margin:8px 0;font-size:19px}.currencyCard .pairPrice{font-size:26px;font-weight:900}.currencyCard .pairMove{font-size:14px;font-weight:900;margin-top:6px}.currencyCard .pairMove.pos{color:#86efac}.currencyCard .pairMove.neg{color:#fca5a5}
      .currencyCardMeta{display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-top:14px}.currencyCardMeta span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:900}.currencyCardMeta b{display:block;margin-top:5px;font-size:14px}
      .currencyStatusLine{font-size:12px;color:#94a3b8;margin-top:8px}
      @media(max-width:1100px){.currencySelectorGrid,.currencyCompareGrid{grid-template-columns:1fr 1fr}}
      @media(max-width:720px){.liveChartStreamOverlay{left:12px;right:12px;top:76px}.liveChartStreamBadge,.liveChartMicroPrice{font-size:11px;padding:8px 10px}.currencySelectorGrid,.currencyCompareGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureLiveChartOverlay() {
    ensureStyles();
    const terminal = document.getElementById('terminal');
    if (!terminal || document.getElementById('liveChartStreamOverlay')) return;
    const overlay = document.createElement('div');
    overlay.id = 'liveChartStreamOverlay';
    overlay.className = 'liveChartStreamOverlay';
    overlay.innerHTML = `
      <span class="liveChartStreamBadge waiting" id="liveChartStreamBadge"><span class="liveChartStreamPulse"></span><span id="liveChartStreamText">Streaming ready</span></span>
      <span class="liveChartMicroPrice" id="liveChartMicroPrice">Waiting for live quote</span>`;
    terminal.appendChild(overlay);
  }

  function setChartStreamStatus(kind, text) {
    ensureLiveChartOverlay();
    const badge = document.getElementById('liveChartStreamBadge');
    const textNode = document.getElementById('liveChartStreamText');
    if (!badge || !textNode) return;
    badge.classList.remove('waiting', 'off');
    if (kind === 'waiting' || kind === 'off') badge.classList.add(kind);
    textNode.textContent = text;
  }

  function updateChartMicroPrice(data) {
    const price = document.getElementById('liveChartMicroPrice');
    if (!price) return;
    const sign = Number(data.changePercent) >= 0 ? '+' : '';
    const cls = Number(data.changePercent) < 0 ? 'neg' : 'pos';
    price.innerHTML = `${esc(money(data.price, data.currency))} <span class="${cls}">${sign}${esc(number(data.changePercent))}%</span>`;
    price.classList.remove('liveChartStreamFlash');
    void price.offsetWidth;
    price.classList.add('liveChartStreamFlash');
  }

  function closeStream() {
    if (liveEventSource) liveEventSource.close();
    liveEventSource = null;
    if (streamReconnectTimer) clearTimeout(streamReconnectTimer);
    streamReconnectTimer = null;
    if (streamHeartbeatTimer) clearTimeout(streamHeartbeatTimer);
    streamHeartbeatTimer = null;
  }

  function scheduleReconnect() {
    if (streamReconnectTimer) clearTimeout(streamReconnectTimer);
    streamReconnectTimer = setTimeout(() => startStreamingForSelected(false), 1200);
  }

  function secondsForResolution(resolution) {
    if (resolution === '5') return 5 * 60;
    if (resolution === '15') return 15 * 60;
    if (resolution === '30') return 30 * 60;
    if (resolution === '60') return 60 * 60;
    if (resolution === 'W') return 7 * 24 * 60 * 60;
    return 24 * 60 * 60;
  }

  function bucketTimeForQuote(timestamp, resolution) {
    const seconds = secondsForResolution(resolution);
    const safeTimestamp = Number.isFinite(Number(timestamp)) ? Number(timestamp) : Math.floor(Date.now() / 1000);
    return Math.floor(safeTimestamp / seconds) * seconds;
  }

  async function seedActiveLiveCandle(symbol) {
    try {
      const resolution = selectedResolution();
      const days = resolution === 'D' ? 365 : resolution === 'W' ? 1500 : 30;
      const response = await fetch('/.netlify/functions/finnhub-candles?symbol=' + encodeURIComponent(symbol) + '&resolution=' + encodeURIComponent(resolution) + '&days=' + days);
      const data = await response.json();
      if (!response.ok || data.error || !data.candles || !data.candles.length) throw new Error(data.error || 'No seed candles returned.');
      const latest = data.candles[data.candles.length - 1];
      activeLiveCandle = {
        time: latest.time,
        open: Number(latest.open),
        high: Number(latest.high),
        low: Number(latest.low),
        close: Number(latest.close)
      };
    } catch (error) {
      activeLiveCandle = null;
    }
  }

  function liveCandleFromQuote(data) {
    const price = Number(data.price);
    if (!Number.isFinite(price)) return null;
    const resolution = selectedResolution();
    const candidateTime = bucketTimeForQuote(data.timestamp, resolution);
    if (!activeLiveCandle) {
      const quoteOpen = Number(data.open);
      const quoteHigh = Number(data.high);
      const quoteLow = Number(data.low);
      activeLiveCandle = {
        time: candidateTime,
        open: Number.isFinite(quoteOpen) ? quoteOpen : price,
        high: Number.isFinite(quoteHigh) ? quoteHigh : price,
        low: Number.isFinite(quoteLow) ? quoteLow : price,
        close: price
      };
      return activeLiveCandle;
    }
    const sameBucket = Number(activeLiveCandle.time) === Number(candidateTime) || resolution === 'D' || resolution === 'W';
    if (!sameBucket) {
      activeLiveCandle = {
        time: candidateTime,
        open: price,
        high: price,
        low: price,
        close: price
      };
      return activeLiveCandle;
    }
    activeLiveCandle = {
      time: activeLiveCandle.time,
      open: activeLiveCandle.open,
      high: Math.max(Number(activeLiveCandle.high), price),
      low: Math.min(Number(activeLiveCandle.low), price),
      close: price
    };
    return activeLiveCandle;
  }

  function updateChartVisualsFromQuote(data) {
    lastStreamQuote = data;
    updateChartMicroPrice(data);
    const candle = liveCandleFromQuote(data);
    if (candle && typeof candleSeries !== 'undefined' && candleSeries && typeof candleSeries.update === 'function') {
      candleSeries.update(candle);
    }
    if (typeof candleSeries !== 'undefined' && candleSeries && typeof candleSeries.createPriceLine === 'function') {
      if (latestVisualPriceLine && typeof candleSeries.removePriceLine === 'function') {
        try { candleSeries.removePriceLine(latestVisualPriceLine); } catch (error) {}
      }
      latestVisualPriceLine = candleSeries.createPriceLine({
        price: Number(data.price),
        color: Number(data.changePercent) < 0 ? '#ef4444' : '#22c55e',
        lineWidth: 1,
        lineStyle: 2,
        axisLabelVisible: true,
        title: 'LIVE'
      });
    }
  }

  function syncLiveQuoteCard(data) {
    if (typeof lastQuote !== 'undefined') lastQuote = data;
    const livePrice = document.getElementById('livePrice');
    if (livePrice) {
      const sign = Number(data.change) >= 0 ? '+' : '';
      livePrice.innerHTML = `${esc(data.currency || '')} ${number(data.price)} <span class="${Number(data.change) >= 0 ? 'pos' : 'neg'}" style="font-size:18px">${sign}${number(data.change)} (${sign}${number(data.changePercent)}%)</span>`;
    }
    const forecastPrice = document.getElementById('forecastLivePrice');
    if (forecastPrice) forecastPrice.textContent = money(data.price, data.currency);
    if (typeof renderForecast === 'function') renderForecast();
    if (typeof renderAnalysis === 'function') renderAnalysis();
  }

  async function startStreamingForSelected(force) {
    ensureLiveChartOverlay();
    const asset = selectedAsset();
    const mode = isMarketLiveForSelected();
    const symbol = asset && asset.quoteSymbol ? String(asset.quoteSymbol).trim().toUpperCase() : '';
    if (!symbol) {
      closeStream();
      setChartStreamStatus('off', 'No symbol selected');
      return;
    }
    if (!mode.open) {
      closeStream();
      activeStreamSymbol = symbol;
      setChartStreamStatus('waiting', `${mode.label || 'Market closed'} — live chart ready`);
      return;
    }
    if (liveEventSource && activeStreamSymbol === symbol && !force) return;
    closeStream();
    activeStreamSymbol = symbol;
    activeLiveCandle = null;
    await seedActiveLiveCandle(symbol);
    setChartStreamStatus('live', `${mode.label || 'Streaming live'} — chart moving`);
    try {
      liveEventSource = new EventSource('/.netlify/functions/live-quote-stream?symbol=' + encodeURIComponent(symbol));
      liveEventSource.addEventListener('status', (event) => {
        try {
          const payload = JSON.parse(event.data || '{}');
          if (payload.status === 'reconnect') scheduleReconnect();
        } catch (error) {}
      });
      liveEventSource.addEventListener('quote', (event) => {
        try {
          const data = JSON.parse(event.data || '{}');
          updateChartVisualsFromQuote(data);
          syncLiveQuoteCard(data);
          if (streamHeartbeatTimer) clearTimeout(streamHeartbeatTimer);
          streamHeartbeatTimer = setTimeout(() => setChartStreamStatus('waiting', 'Stream reconnecting'), 9000);
        } catch (error) {}
      });
      liveEventSource.addEventListener('stream-error', () => setChartStreamStatus('waiting', 'Live chart retrying'));
      liveEventSource.onerror = () => {
        setChartStreamStatus('waiting', 'Live chart reconnecting');
        closeStream();
        scheduleReconnect();
      };
    } catch (error) {
      setChartStreamStatus('off', 'Live chart stream unavailable');
      scheduleReconnect();
    }
  }

  function readSelectedCurrencyPairs() {
    try {
      const stored = JSON.parse(localStorage.getItem(selectedCurrencyPairsKey) || '[]');
      return Array.isArray(stored) && stored.length ? stored : ['USDINR', 'EURUSD', 'GBPUSD', 'USDJPY'];
    } catch (error) {
      return ['USDINR', 'EURUSD', 'GBPUSD', 'USDJPY'];
    }
  }

  function writeSelectedCurrencyPairs(symbols) {
    localStorage.setItem(selectedCurrencyPairsKey, JSON.stringify(symbols));
  }

  function ensureMultiCurrencyPanel() {
    ensureStyles();
    const currencyTab = document.getElementById('currencyTab');
    if (!currencyTab || document.getElementById('multiCurrencyPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'multiCurrencyPanel';
    panel.className = 'streamPanel';
    panel.innerHTML = `
      <div class="streamHeader">
        <div>
          <span class="streamStatus live"><span class="streamPulse"></span><span>Multi-Currency Monitor</span></span>
          <h3>Compare Multiple Currencies</h3>
          <p>Select several currency pairs and view them together with current price, daily move, day high, and day low.</p>
        </div>
        <div class="currencyActions">
          <button class="btn light" id="refreshCurrencyCompareBtn" type="button">Refresh Currency View</button>
          <button class="btn gold" id="selectDefaultCurrenciesBtn" type="button">Reset Defaults</button>
        </div>
      </div>
      <div class="currencySelectorGrid" id="currencySelectorGrid"></div>
      <div class="currencyStatusLine" id="currencyCompareStatus">Choose currency pairs to compare.</div>
      <div class="currencyCompareGrid" id="currencyCompareGrid"></div>`;
    currencyTab.appendChild(panel);
    renderCurrencySelector();
    const refresh = document.getElementById('refreshCurrencyCompareBtn');
    if (refresh) refresh.onclick = () => loadMultiCurrencyQuotes();
    const reset = document.getElementById('selectDefaultCurrenciesBtn');
    if (reset) reset.onclick = () => {
      writeSelectedCurrencyPairs(['USDINR', 'EURUSD', 'GBPUSD', 'USDJPY']);
      renderCurrencySelector();
      loadMultiCurrencyQuotes();
    };
  }

  function renderCurrencySelector() {
    const grid = document.getElementById('currencySelectorGrid');
    if (!grid) return;
    const selectedPairs = new Set(readSelectedCurrencyPairs());
    grid.innerHTML = availableCurrencyPairs.map((pair) => `
      <label class="currencyChoice">
        <input type="checkbox" data-currency-pair="${esc(pair.symbol)}" ${selectedPairs.has(pair.symbol) ? 'checked' : ''}>
        <span><b>${esc(pair.label)}</b><span>${esc(pair.note)}</span></span>
      </label>`).join('');
    grid.querySelectorAll('[data-currency-pair]').forEach((checkbox) => {
      checkbox.addEventListener('change', () => {
        const symbols = Array.from(grid.querySelectorAll('[data-currency-pair]:checked')).map((node) => node.dataset.currencyPair);
        writeSelectedCurrencyPairs(symbols);
        loadMultiCurrencyQuotes();
      });
    });
  }

  async function loadMultiCurrencyQuotes() {
    ensureMultiCurrencyPanel();
    const grid = document.getElementById('currencyCompareGrid');
    const status = document.getElementById('currencyCompareStatus');
    if (!grid || !status) return;
    const symbols = readSelectedCurrencyPairs();
    if (!symbols.length) {
      status.textContent = 'Select at least one currency pair.';
      grid.innerHTML = '';
      return;
    }
    status.textContent = `Refreshing ${symbols.length} currency pair${symbols.length === 1 ? '' : 's'}...`;
    grid.innerHTML = symbols.map((symbol) => `<article class="currencyCard"><h4>${esc(symbol)}</h4><div class="pairPrice">Loading...</div></article>`).join('');
    const results = await Promise.all(symbols.map(async (symbol) => {
      try {
        const response = await fetch('/.netlify/functions/finnhub-quote?symbol=' + encodeURIComponent(symbol));
        const data = await response.json();
        if (!response.ok || data.error || !Number.isFinite(Number(data.price))) throw new Error(data.error || 'Quote unavailable.');
        return { ok: true, data };
      } catch (error) {
        return { ok: false, symbol, error: error.message || 'Unavailable' };
      }
    }));
    grid.innerHTML = results.map((result) => {
      if (!result.ok) {
        return `<article class="currencyCard"><span class="tag sell">Unavailable</span><h4>${esc(result.symbol)}</h4><p>${esc(result.error)}</p></article>`;
      }
      const data = result.data;
      const moveClass = Number(data.changePercent) < 0 ? 'neg' : 'pos';
      return `<article class="currencyCard">
        <span class="tag hold">FX</span>
        <h4>${esc(data.name || data.symbol)}</h4>
        <div class="pairPrice">${money(data.price, data.currency)}</div>
        <div class="pairMove ${moveClass}">${percent(data.changePercent)}</div>
        <div class="currencyCardMeta">
          <div><span>Day High</span><b>${money(data.high, data.currency)}</b></div>
          <div><span>Day Low</span><b>${money(data.low, data.currency)}</b></div>
        </div>
        <div class="currencyActions" style="margin-top:14px">
          <button class="microBtn gold" type="button" data-open-currency="${esc(data.symbol)}">Open Chart</button>
        </div>
      </article>`;
    }).join('');
    grid.querySelectorAll('[data-open-currency]').forEach((button) => {
      button.onclick = () => {
        if (typeof loadCurrency === 'function') loadCurrency(button.dataset.openCurrency);
      };
    });
    status.textContent = `Updated ${new Date().toLocaleString()} · ${symbols.length} pair${symbols.length === 1 ? '' : 's'} displayed.`;
  }

  function wrapGlobal(name, callback) {
    const install = () => {
      if (typeof window[name] !== 'function') {
        setTimeout(install, 120);
        return;
      }
      const original = window[name];
      window[name] = function wrappedFunction() {
        const result = original.apply(this, arguments);
        setTimeout(callback, 350);
        return result;
      };
    };
    install();
  }

  ensureLiveChartOverlay();
  ensureMultiCurrencyPanel();
  setTimeout(() => startStreamingForSelected(false), 1100);
  setTimeout(() => loadMultiCurrencyQuotes(), 1300);
  wrapGlobal('selectAsset', () => startStreamingForSelected(false));
  wrapGlobal('reloadCandles', async () => {
    activeLiveCandle = null;
    const asset = selectedAsset();
    if (asset && asset.quoteSymbol) await seedActiveLiveCandle(asset.quoteSymbol);
    if (lastStreamQuote) updateChartVisualsFromQuote(lastStreamQuote);
  });
  wrapGlobal('showTab', () => {
    const currencyTab = document.getElementById('currencyTab');
    if (currencyTab && currencyTab.classList.contains('active')) loadMultiCurrencyQuotes();
  });
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      startStreamingForSelected(false);
      const currencyTab = document.getElementById('currencyTab');
      if (currencyTab && currencyTab.classList.contains('active')) loadMultiCurrencyQuotes();
    }
  });
})();