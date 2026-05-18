(function () {
  let liveEventSource = null;
  let streamReconnectTimer = null;
  let streamHeartbeatTimer = null;
  let activeStreamSymbol = '';
  const liveTradeRows = [];
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
      .streamPanel{background:#08111f;border:1px solid var(--line);border-radius:22px;padding:18px;margin-top:18px}
      .streamHeader{display:flex;justify-content:space-between;align-items:flex-start;gap:14px;flex-wrap:wrap}
      .streamHeader h3{margin:8px 0 4px;font-size:24px;letter-spacing:-.03em}
      .streamHeader p{margin:0;color:#cbd5e1;font-size:14px;line-height:1.6}
      .streamStatus{display:inline-flex;align-items:center;gap:8px;padding:8px 11px;border-radius:999px;border:1px solid rgba(255,255,255,.14);background:rgba(255,255,255,.06);font-size:12px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#cbd5e1}
      .streamStatus.live{color:#86efac;background:rgba(34,197,94,.12);border-color:rgba(34,197,94,.4)}
      .streamStatus.waiting{color:#fde68a;background:rgba(245,158,11,.12);border-color:rgba(245,158,11,.35)}
      .streamStatus.off{color:#fca5a5;background:rgba(239,68,68,.12);border-color:rgba(239,68,68,.35)}
      .streamPulse{width:8px;height:8px;border-radius:50%;background:currentColor;animation:streamPulse 1.6s infinite}
      .streamStatus.off .streamPulse,.streamStatus.waiting .streamPulse{animation:none}
      @keyframes streamPulse{0%{box-shadow:0 0 0 0 rgba(34,197,94,.55)}70%{box-shadow:0 0 0 10px rgba(34,197,94,0)}100%{box-shadow:0 0 0 0 rgba(34,197,94,0)}}
      .streamMetrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:16px}
      .streamMetric{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:18px;padding:14px}
      .streamMetric span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:900}
      .streamMetric b{display:block;font-size:22px;margin-top:8px}
      .streamTape{display:grid;grid-template-columns:1fr;gap:10px;margin-top:16px}
      .streamRow{display:grid;grid-template-columns:140px 1fr 120px 120px 140px;gap:12px;align-items:center;background:rgba(255,255,255,.045);border:1px solid rgba(255,255,255,.08);border-radius:16px;padding:12px 14px;color:#d8e1ef;font-size:14px}
      .streamRow.head{background:#0b1728;color:#94a3b8;text-transform:uppercase;font-size:11px;font-weight:900;letter-spacing:.08em}
      .streamRow .up{color:#86efac;font-weight:900}.streamRow .down{color:#fca5a5;font-weight:900}
      .streamHelper{font-size:12px;color:#94a3b8;margin-top:12px;line-height:1.6}
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
      @media(max-width:1100px){.streamMetrics,.currencySelectorGrid,.currencyCompareGrid{grid-template-columns:1fr 1fr}.streamRow{grid-template-columns:1fr 1fr}.streamRow span:nth-child(n+3){font-size:13px}}
      @media(max-width:720px){.streamMetrics,.currencySelectorGrid,.currencyCompareGrid{grid-template-columns:1fr}.streamRow{grid-template-columns:1fr}.streamRow.head{display:none}}
    `;
    document.head.appendChild(style);
  }

  function ensureLiveStreamingPanel() {
    ensureStyles();
    const terminal = document.getElementById('terminal');
    const shell = terminal && terminal.parentElement;
    if (!shell || document.getElementById('liveStreamingPanel')) return;
    const panel = document.createElement('section');
    panel.id = 'liveStreamingPanel';
    panel.className = 'streamPanel';
    panel.innerHTML = `
      <div class="streamHeader">
        <div>
          <span class="streamStatus waiting" id="marketStreamStatus"><span class="streamPulse"></span><span id="marketStreamStatusText">Waiting for market session</span></span>
          <h3>Live Streaming Screen</h3>
          <p id="marketStreamDescription">The screen activates live quote streaming for the selected asset while the relevant market is open.</p>
        </div>
        <div class="currencyActions">
          <button class="btn light" id="restartLiveStreamBtn" type="button">Restart Stream</button>
          <button class="btn gold" id="openMultiCurrencyBtn" type="button">Multi-Currency View</button>
        </div>
      </div>
      <div class="streamMetrics">
        <div class="streamMetric"><span>Streaming Symbol</span><b id="streamingSymbol">—</b></div>
        <div class="streamMetric"><span>Live Price</span><b id="streamingPrice">—</b></div>
        <div class="streamMetric"><span>Daily Move</span><b id="streamingMove">—</b></div>
        <div class="streamMetric"><span>Last Stream Update</span><b id="streamingUpdated">—</b></div>
      </div>
      <div class="streamTape" id="liveStreamTape">
        <div class="streamRow head"><span>Time</span><span>Symbol</span><span>Price</span><span>Move</span><span>Source</span></div>
        <div class="streamRow"><span>—</span><span>Waiting for stream</span><span>—</span><span>—</span><span>—</span></div>
      </div>
      <div class="streamHelper">Live streaming uses a server-sent quote stream window that reconnects automatically. If the data provider is delayed or a symbol is unsupported, the stream panel falls back gracefully.</div>`;
    shell.appendChild(panel);
    const restart = document.getElementById('restartLiveStreamBtn');
    if (restart) restart.onclick = () => startStreamingForSelected(true);
    const multi = document.getElementById('openMultiCurrencyBtn');
    if (multi) multi.onclick = () => activateCurrencyTabAndScroll();
  }

  function activateCurrencyTabAndScroll() {
    const buttons = document.querySelectorAll('#marketTabs .tabBtn');
    const currencyButton = Array.from(buttons).find((button) => button.textContent && button.textContent.includes('Currency'));
    if (currencyButton && typeof currencyButton.click === 'function') currencyButton.click();
    setTimeout(() => {
      const target = document.getElementById('multiCurrencyPanel') || document.getElementById('currencyTab');
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 140);
  }

  function setStreamStatus(kind, text) {
    const status = document.getElementById('marketStreamStatus');
    const statusText = document.getElementById('marketStreamStatusText');
    if (!status || !statusText) return;
    status.classList.remove('live', 'waiting', 'off');
    status.classList.add(kind);
    statusText.textContent = text;
  }

  function streamQuoteLabel(data) {
    return money(data.price, data.currency);
  }

  function appendStreamRow(data) {
    liveTradeRows.unshift(data);
    liveTradeRows.splice(8);
    const tape = document.getElementById('liveStreamTape');
    if (!tape) return;
    const head = '<div class="streamRow head"><span>Time</span><span>Symbol</span><span>Price</span><span>Move</span><span>Source</span></div>';
    const body = liveTradeRows.map((item) => {
      const move = Number(item.changePercent);
      const cls = Number.isFinite(move) && move < 0 ? 'down' : 'up';
      const when = item.timestamp ? new Date(Number(item.timestamp) * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      return `<div class="streamRow"><span>${esc(when)}</span><span><b>${esc(item.symbol || '')}</b></span><span>${esc(streamQuoteLabel(item))}</span><span class="${cls}">${esc(percent(item.changePercent))}</span><span>${esc(item.source || 'Live stream')}</span></div>`;
    }).join('');
    tape.innerHTML = head + body;
  }

  function updateStreamingMetrics(data) {
    const symbol = document.getElementById('streamingSymbol');
    const price = document.getElementById('streamingPrice');
    const move = document.getElementById('streamingMove');
    const updated = document.getElementById('streamingUpdated');
    if (symbol) symbol.textContent = data.symbol || activeStreamSymbol || '—';
    if (price) price.textContent = streamQuoteLabel(data);
    if (move) {
      move.textContent = percent(data.changePercent);
      move.className = Number(data.changePercent) < 0 ? 'neg' : 'pos';
    }
    if (updated) updated.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
    streamReconnectTimer = setTimeout(() => {
      startStreamingForSelected(false);
    }, 1400);
  }

  function startStreamingForSelected(force) {
    ensureLiveStreamingPanel();
    const asset = selectedAsset();
    const mode = isMarketLiveForSelected();
    const symbol = asset && asset.quoteSymbol ? String(asset.quoteSymbol).trim().toUpperCase() : '';
    const description = document.getElementById('marketStreamDescription');
    if (!symbol) {
      closeStream();
      setStreamStatus('off', 'No symbol selected');
      if (description) description.textContent = 'Select a stock, ETF, or currency pair to activate the live stream screen.';
      return;
    }
    if (!mode.open && !force) {
      closeStream();
      activeStreamSymbol = symbol;
      setStreamStatus('waiting', `${mode.label || 'Market closed'}`);
      if (description) description.textContent = `Streaming is ready for ${symbol}; it activates automatically once the relevant market session is live.`;
      const streamingSymbol = document.getElementById('streamingSymbol');
      if (streamingSymbol) streamingSymbol.textContent = symbol;
      return;
    }
    if (liveEventSource && activeStreamSymbol === symbol && !force) return;
    closeStream();
    activeStreamSymbol = symbol;
    setStreamStatus('live', `${mode.label || 'Streaming live'}`);
    if (description) description.textContent = `Live streaming quote updates are active for ${symbol}. The quote window reconnects automatically to keep the screen moving during market hours.`;
    const streamingSymbol = document.getElementById('streamingSymbol');
    if (streamingSymbol) streamingSymbol.textContent = symbol;
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
          updateStreamingMetrics(data);
          appendStreamRow(data);
          syncLiveQuoteCard(data);
          if (streamHeartbeatTimer) clearTimeout(streamHeartbeatTimer);
          streamHeartbeatTimer = setTimeout(() => setStreamStatus('waiting', 'Reconnecting stream'), 9000);
        } catch (error) {}
      });
      liveEventSource.addEventListener('stream-error', () => {
        setStreamStatus('waiting', 'Stream data retrying');
      });
      liveEventSource.onerror = () => {
        setStreamStatus('waiting', 'Stream reconnecting');
        closeStream();
        scheduleReconnect();
      };
    } catch (error) {
      setStreamStatus('off', 'Streaming unavailable');
      scheduleReconnect();
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

  ensureLiveStreamingPanel();
  ensureMultiCurrencyPanel();
  setTimeout(() => startStreamingForSelected(false), 1100);
  setTimeout(() => loadMultiCurrencyQuotes(), 1300);
  wrapGlobal('selectAsset', () => startStreamingForSelected(true));
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