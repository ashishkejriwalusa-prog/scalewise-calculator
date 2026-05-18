(function () {
  const storageKey = 'scalewise-direct-client-watchlist-v1';
  let activeIdeaTab = 'buy';
  let cachedIdeas = null;

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
    const symbol = currency === 'INR' ? '₹' : currency === 'USD' ? '$' : currency ? currency + ' ' : '';
    return symbol + parsed.toFixed(parsed >= 100 ? 2 : 4);
  }

  function percent(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed)) return '—';
    return `${parsed >= 0 ? '+' : ''}${parsed.toFixed(2)}%`;
  }

  function state() {
    return {
      asset: typeof selected !== 'undefined' ? selected : null,
      quote: typeof lastQuote !== 'undefined' ? lastQuote : null
    };
  }

  function injectStyles() {
    if (document.getElementById('investorTabsUpgradeStyles')) return;
    const style = document.createElement('style');
    style.id = 'investorTabsUpgradeStyles';
    style.textContent = `
      .extensionTabBtn{border:1px solid var(--line);background:#08111f;color:#cbd5e1;border-radius:999px;padding:11px 16px;font-weight:900;cursor:pointer}
      .extensionTabBtn.active{background:linear-gradient(135deg,var(--gold2),var(--gold));color:#08111f;border-color:transparent}
      .levelsGrid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin:18px 0}
      .levelCard,.ideasCard,.watchlistForm,.watchlistCard{background:#08111f;border:1px solid var(--line);border-radius:18px;padding:16px}
      .levelCard span,.ideaMeta span,.watchlistCard small{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:900}
      .levelCard b{display:block;font-size:24px;margin-top:8px}
      .levelCard em{display:block;font-style:normal;color:#cbd5e1;font-size:13px;margin-top:8px}
      .levelsSummary{background:linear-gradient(135deg,rgba(232,189,98,.12),rgba(56,189,248,.08));border:1px solid rgba(232,189,98,.24);border-radius:20px;padding:18px;margin-top:16px;color:#d8e1ef;line-height:1.7}
      .ideasControlRow{display:flex;justify-content:space-between;align-items:center;gap:14px;flex-wrap:wrap;margin:14px 0}
      .ideasToggle{display:flex;gap:10px;flex-wrap:wrap}
      .ideasGrid{display:grid;grid-template-columns:repeat(2,1fr);gap:14px;margin-top:16px}
      .ideasCard h4{margin:8px 0 8px;font-size:18px}
      .ideaTop{display:flex;justify-content:space-between;gap:12px;align-items:start;flex-wrap:wrap}
      .ideaPrice{font-size:24px;font-weight:900;color:#f8fafc}
      .ideaMove.pos{color:#86efac}.ideaMove.neg{color:#fca5a5}
      .ideaReason{color:#cbd5e1;line-height:1.65;margin:12px 0 0}
      .ideaMeta{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-top:12px}
      .ideaMeta b{display:block;font-size:14px;margin-top:5px;color:#f8fafc}
      .watchlistTools{display:grid;grid-template-columns:1fr auto;gap:10px;margin-top:12px}
      .watchlistGrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:16px}
      .watchlistCard b{display:block;font-size:18px;margin-top:6px}
      .watchlistCard p{margin:8px 0 12px;color:#cbd5e1;font-size:14px;line-height:1.5}
      .watchActions{display:flex;gap:8px;flex-wrap:wrap}
      .microBtn{border:1px solid var(--line);background:rgba(255,255,255,.06);color:#fff;border-radius:999px;padding:8px 11px;font-size:12px;font-weight:900;cursor:pointer}
      .microBtn.gold{background:linear-gradient(135deg,var(--gold2),var(--gold));color:#08111f;border-color:transparent}
      .subtleInfo{font-size:12px;color:#94a3b8;line-height:1.6;margin-top:10px}
      @media(max-width:1000px){.levelsGrid,.ideasGrid,.watchlistGrid,.ideaMeta{grid-template-columns:1fr}.watchlistTools{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function ensureTabs() {
    injectStyles();
    const tabs = document.querySelector('#marketTabs .tabs');
    const panel = document.querySelector('#marketTabs .panel');
    if (!tabs || !panel || document.getElementById('levelsTab')) return;

    const levelsBtn = document.createElement('button');
    levelsBtn.className = 'extensionTabBtn';
    levelsBtn.type = 'button';
    levelsBtn.textContent = 'Price Levels';
    levelsBtn.onclick = () => showExtensionTab('levelsTab', levelsBtn, loadAssetMetrics);

    const ideasBtn = document.createElement('button');
    ideasBtn.className = 'extensionTabBtn';
    ideasBtn.type = 'button';
    ideasBtn.textContent = 'Top 5 Ideas';
    ideasBtn.onclick = () => showExtensionTab('ideasTab', ideasBtn, loadMarketIdeas);

    const clientWatchBtn = document.createElement('button');
    clientWatchBtn.className = 'extensionTabBtn';
    clientWatchBtn.type = 'button';
    clientWatchBtn.textContent = 'My Watchlist';
    clientWatchBtn.onclick = () => showExtensionTab('clientWatchlistTab', clientWatchBtn, renderClientWatchlist);

    tabs.appendChild(levelsBtn);
    tabs.appendChild(ideasBtn);
    tabs.appendChild(clientWatchBtn);

    const levels = document.createElement('div');
    levels.id = 'levelsTab';
    levels.className = 'tabPane';
    levels.innerHTML = `
      <h3>Selected Asset Price Levels</h3>
      <p>Day range and 52-week range for the currently selected stock, currency, or ETF where provider data is available.</p>
      <div class="levelsGrid">
        <div class="levelCard"><span>Day High</span><b id="metricDayHigh">Loading</b><em id="metricDayHighNote">Latest session range</em></div>
        <div class="levelCard"><span>Day Low</span><b id="metricDayLow">Loading</b><em id="metricDayLowNote">Latest session range</em></div>
        <div class="levelCard"><span>52-Week High</span><b id="metric52High">Loading</b><em id="metric52HighNote">Distance from high</em></div>
        <div class="levelCard"><span>52-Week Low</span><b id="metric52Low">Loading</b><em id="metric52LowNote">Distance above low</em></div>
      </div>
      <div class="levelsSummary" id="metricLevelsSummary">Loading selected-asset range interpretation...</div>`;

    const ideas = document.createElement('div');
    ideas.id = 'ideasTab';
    ideas.className = 'tabPane';
    ideas.innerHTML = `
      <h3>Top 5 Buy / Sell / Hold Ideas — India & U.S.</h3>
      <p>Current-situation screen using live/delayed price movement, 52-week range positioning, and sector-cycle heuristics. Educational only.</p>
      <div class="ideasControlRow">
        <div class="ideasToggle">
          <button class="microBtn gold" id="ideaBuyBtn" type="button">Top 5 Buy</button>
          <button class="microBtn" id="ideaSellBtn" type="button">Top 5 Sell / Avoid</button>
          <button class="microBtn" id="ideaHoldBtn" type="button">Top 5 Hold</button>
        </div>
        <button class="btn light" id="refreshIdeasBtn" type="button">Refresh Ideas</button>
      </div>
      <div class="subtleInfo" id="ideasMethodology">Loading current market screen...</div>
      <div class="ideasGrid" id="ideasGrid"><div class="ideasCard">Loading ideas...</div></div>`;

    const watchlist = document.createElement('div');
    watchlist.id = 'clientWatchlistTab';
    watchlist.className = 'tabPane';
    watchlist.innerHTML = `
      <h3>My Watchlist</h3>
      <p>Clients can add the selected asset directly or type their own ticker. This watchlist is saved locally in the browser until a member database is connected.</p>
      <div class="watchlistForm">
        <button class="btn gold" id="addSelectedToWatchlistBtn" type="button">Add Selected Asset to My Watchlist</button>
        <div class="watchlistTools">
          <input id="customWatchlistSymbol" placeholder="Add ticker, e.g., VBL.NS, NVDA, USDINR">
          <button class="btn light" id="addCustomWatchlistSymbolBtn" type="button">Add</button>
        </div>
        <div class="subtleInfo" id="watchlistStatus">No action taken yet.</div>
      </div>
      <div class="watchlistGrid" id="clientWatchlistGrid"></div>`;

    panel.appendChild(levels);
    panel.appendChild(ideas);
    panel.appendChild(watchlist);

    document.getElementById('ideaBuyBtn').onclick = () => setIdeaBucket('buy');
    document.getElementById('ideaSellBtn').onclick = () => setIdeaBucket('sell');
    document.getElementById('ideaHoldBtn').onclick = () => setIdeaBucket('hold');
    document.getElementById('refreshIdeasBtn').onclick = () => loadMarketIdeas(true);
    document.getElementById('addSelectedToWatchlistBtn').onclick = addSelectedToWatchlist;
    document.getElementById('addCustomWatchlistSymbolBtn').onclick = addCustomWatchlistSymbol;
    document.getElementById('customWatchlistSymbol').addEventListener('keydown', (event) => {
      if (event.key === 'Enter') addCustomWatchlistSymbol();
    });
  }

  function showExtensionTab(id, button, loader) {
    document.querySelectorAll('#marketTabs .tabPane').forEach((pane) => pane.classList.remove('active'));
    document.querySelectorAll('#marketTabs .tabBtn, #marketTabs .extensionTabBtn').forEach((tab) => tab.classList.remove('active'));
    const pane = document.getElementById(id);
    if (pane) pane.classList.add('active');
    if (button) button.classList.add('active');
    if (typeof loader === 'function') loader();
  }

  async function loadAssetMetrics() {
    const { asset } = state();
    if (!asset || !asset.quoteSymbol) return;
    const summary = document.getElementById('metricLevelsSummary');
    if (summary) summary.textContent = `Loading day and 52-week levels for ${asset.name || asset.quoteSymbol}...`;
    try {
      const response = await fetch('/.netlify/functions/asset-metrics?symbol=' + encodeURIComponent(asset.quoteSymbol));
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Price levels unavailable.');
      const currency = data.currency || (asset.market === 'India' ? 'INR' : 'USD');
      setText('metricDayHigh', money(data.dayHigh, currency));
      setText('metricDayLow', money(data.dayLow, currency));
      setText('metric52High', money(data.fiftyTwoWeekHigh, currency));
      setText('metric52Low', money(data.fiftyTwoWeekLow, currency));
      setText('metricDayHighNote', `Current price ${money(data.price, currency)}`);
      setText('metricDayLowNote', `${percent(data.changePercent)} today`);
      setText('metric52HighNote', `${percent(data.distanceFrom52WeekHighPercent)} vs 52W high`);
      setText('metric52LowNote', `${percent(data.distanceAbove52WeekLowPercent)} above 52W low`);
      const rangePosition = Number(data.fiftyTwoWeekRangePosition);
      let rangeMessage = '52-week positioning is unavailable.';
      if (Number.isFinite(rangePosition)) {
        rangeMessage = rangePosition >= 80
          ? 'The asset is trading in the upper band of its 52-week range, which often reflects strong momentum but can also mean less valuation cushion.'
          : rangePosition <= 30
            ? 'The asset is trading in the lower band of its 52-week range, which may signal stress, recovery potential, or both depending on fundamentals.'
            : 'The asset sits in the middle of its 52-week range, suggesting neither a clear breakout nor a deep washed-out setup.';
      }
      if (summary) summary.textContent = `${asset.name || asset.quoteSymbol}: day range ${money(data.dayLow, currency)} to ${money(data.dayHigh, currency)}. ${rangeMessage}`;
    } catch (error) {
      if (summary) summary.textContent = error.message || 'Price levels unavailable.';
      ['metricDayHigh', 'metricDayLow', 'metric52High', 'metric52Low'].forEach((id) => setText(id, '—'));
    }
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) node.textContent = value;
  }

  async function loadMarketIdeas(force = false) {
    const method = document.getElementById('ideasMethodology');
    const grid = document.getElementById('ideasGrid');
    if (!grid) return;
    if (cachedIdeas && !force) {
      renderIdeas();
      return;
    }
    if (method) method.textContent = 'Refreshing India and U.S. current-situation screens...';
    grid.innerHTML = '<div class="ideasCard">Loading market ideas...</div>';
    try {
      const response = await fetch('/.netlify/functions/market-ideas?market=both');
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Market ideas unavailable.');
      cachedIdeas = data;
      if (method) method.textContent = `${data.methodology || ''} Updated ${new Date(data.updatedAt).toLocaleString()}.`;
      renderIdeas();
    } catch (error) {
      if (method) method.textContent = error.message || 'Market ideas unavailable.';
      grid.innerHTML = '<div class="ideasCard">Top ideas could not be loaded.</div>';
    }
  }

  function setIdeaBucket(bucket) {
    activeIdeaTab = bucket;
    ['ideaBuyBtn', 'ideaSellBtn', 'ideaHoldBtn'].forEach((id) => {
      const button = document.getElementById(id);
      if (button) button.classList.remove('gold');
    });
    const activeId = bucket === 'buy' ? 'ideaBuyBtn' : bucket === 'sell' ? 'ideaSellBtn' : 'ideaHoldBtn';
    const activeButton = document.getElementById(activeId);
    if (activeButton) activeButton.classList.add('gold');
    renderIdeas();
  }

  function renderIdeas() {
    const grid = document.getElementById('ideasGrid');
    if (!grid || !cachedIdeas) return;
    const list = cachedIdeas[activeIdeaTab] || [];
    if (!list.length) {
      grid.innerHTML = '<div class="ideasCard">No ideas met the current screen for this bucket.</div>';
      return;
    }
    grid.innerHTML = list.map((item) => {
      const moveClass = Number(item.changePercent) >= 0 ? 'pos' : 'neg';
      return `
        <article class="ideasCard">
          <div class="ideaTop">
            <div>
              <span class="tag ${activeIdeaTab === 'buy' ? 'buy' : activeIdeaTab === 'sell' ? 'sell' : 'hold'}">${esc(item.bucket)}</span>
              <h4>${esc(item.name)}</h4>
              <div class="ideaMeta"><span>${esc(item.market)}</span><b>${esc(item.symbol)}</b></div>
            </div>
            <div style="text-align:right">
              <div class="ideaPrice">${money(item.price, item.currency)}</div>
              <div class="ideaMove ${moveClass}">${percent(item.changePercent)}</div>
            </div>
          </div>
          <p class="ideaReason">${esc(item.reason)}</p>
          <div class="ideaMeta">
            <div><span>Day High</span><b>${money(item.dayHigh, item.currency)}</b></div>
            <div><span>Day Low</span><b>${money(item.dayLow, item.currency)}</b></div>
            <div><span>52W Range Pos.</span><b>${Number.isFinite(Number(item.rangePosition)) ? number(item.rangePosition, 0) + '%' : '—'}</b></div>
          </div>
          <div class="watchActions" style="margin-top:14px">
            <button class="microBtn gold" type="button" data-symbol="${esc(item.symbol)}" data-name="${esc(item.name)}" data-market="${esc(item.market)}" data-sector="${esc(item.sector)}">Add to My Watchlist</button>
            <button class="microBtn" type="button" data-load-symbol="${esc(item.symbol)}">Open</button>
          </div>
        </article>`;
    }).join('');

    grid.querySelectorAll('[data-symbol]').forEach((button) => {
      button.onclick = () => addWatchlistItem({
        symbol: button.dataset.symbol,
        name: button.dataset.name,
        market: button.dataset.market,
        sector: button.dataset.sector
      });
    });
    grid.querySelectorAll('[data-load-symbol]').forEach((button) => {
      button.onclick = () => openSymbol(button.dataset.loadSymbol);
    });
  }

  function readWatchlist() {
    try {
      return JSON.parse(localStorage.getItem(storageKey) || '[]');
    } catch (error) {
      return [];
    }
  }

  function writeWatchlist(items) {
    localStorage.setItem(storageKey, JSON.stringify(items));
  }

  function addSelectedToWatchlist() {
    const { asset } = state();
    if (!asset || !asset.quoteSymbol) return;
    addWatchlistItem({
      symbol: asset.quoteSymbol,
      name: asset.name || asset.quoteSymbol,
      market: asset.market || '',
      sector: asset.sector || ''
    });
  }

  function addCustomWatchlistSymbol() {
    const input = document.getElementById('customWatchlistSymbol');
    const symbol = input && input.value ? input.value.trim().toUpperCase() : '';
    if (!symbol) {
      setWatchlistStatus('Enter a ticker first.');
      return;
    }
    addWatchlistItem({ symbol, name: symbol, market: symbol.endsWith('.NS') || symbol.endsWith('.BO') ? 'India' : 'U.S. / FX', sector: '' });
    if (input) input.value = '';
  }

  function addWatchlistItem(item) {
    const symbol = String(item.symbol || '').trim().toUpperCase();
    if (!symbol) return;
    const items = readWatchlist();
    if (items.some((existing) => existing.symbol === symbol)) {
      setWatchlistStatus(`${symbol} is already in the client watchlist.`);
      renderClientWatchlist();
      return;
    }
    items.unshift({
      symbol,
      name: item.name || symbol,
      market: item.market || '',
      sector: item.sector || '',
      addedAt: new Date().toISOString()
    });
    writeWatchlist(items.slice(0, 40));
    setWatchlistStatus(`${symbol} added to My Watchlist.`);
    renderClientWatchlist();
  }

  function setWatchlistStatus(message) {
    const node = document.getElementById('watchlistStatus');
    if (node) node.textContent = message;
  }

  function renderClientWatchlist() {
    const grid = document.getElementById('clientWatchlistGrid');
    if (!grid) return;
    const items = readWatchlist();
    if (!items.length) {
      grid.innerHTML = '<div class="watchlistCard">No client watchlist items yet. Use the add button above or add directly from the Top 5 Ideas cards.</div>';
      return;
    }
    grid.innerHTML = items.map((item) => `
      <article class="watchlistCard">
        <small>${esc(item.market || 'Watchlist')}</small>
        <b>${esc(item.name || item.symbol)}</b>
        <p>${esc(item.symbol)}${item.sector ? ' · ' + esc(item.sector) : ''}</p>
        <div class="watchActions">
          <button class="microBtn gold" type="button" data-open-watch="${esc(item.symbol)}">Open</button>
          <button class="microBtn" type="button" data-remove-watch="${esc(item.symbol)}">Remove</button>
        </div>
      </article>`).join('');
    grid.querySelectorAll('[data-open-watch]').forEach((button) => {
      button.onclick = () => openSymbol(button.dataset.openWatch);
    });
    grid.querySelectorAll('[data-remove-watch]').forEach((button) => {
      button.onclick = () => removeWatchlistItem(button.dataset.removeWatch);
    });
  }

  function removeWatchlistItem(symbol) {
    const updated = readWatchlist().filter((item) => item.symbol !== symbol);
    writeWatchlist(updated);
    setWatchlistStatus(`${symbol} removed from My Watchlist.`);
    renderClientWatchlist();
  }

  function openSymbol(symbol) {
    if (typeof searchDirectSymbol === 'function') searchDirectSymbol(symbol);
    else if (typeof searchStock === 'function') {
      const input = document.getElementById('stockSearch');
      if (input) input.value = symbol;
      searchStock();
    }
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

  ensureTabs();
  renderClientWatchlist();
  wrapGlobal('selectAsset', loadAssetMetrics);
})();