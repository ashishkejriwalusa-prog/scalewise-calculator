(function () {
  const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[char]));

  function getState() {
    const selectedAsset = typeof selected !== 'undefined' ? selected : null;
    const liveQuote = typeof lastQuote !== 'undefined' ? lastQuote : null;
    return { selectedAsset, liveQuote };
  }

  function ensureAnalysisLayout() {
    const analysisTab = document.getElementById('analysisTab');
    if (!analysisTab || document.getElementById('liveContextPanel')) return;

    const panel = document.createElement('div');
    panel.id = 'liveContextPanel';
    panel.innerHTML = `
      <style>
        .liveContextWrap{margin-top:18px;display:grid;gap:16px}
        .liveContextHero{background:#08111f;border:1px solid #223a59;border-radius:20px;padding:18px}
        .liveContextHero h3{margin:0 0 8px;font-size:22px;letter-spacing:-.02em}
        .liveContextHero p{margin:0;color:#cbd5e1;line-height:1.7}
        .liveContextMeta{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-top:14px}
        .liveContextMetric{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px}
        .liveContextMetric span{display:block;font-size:11px;text-transform:uppercase;letter-spacing:.08em;color:#94a3b8;font-weight:900}
        .liveContextMetric b{display:block;margin-top:7px;font-size:18px}
        .liveContextGrid{display:grid;grid-template-columns:1fr 1fr;gap:16px}
        .liveContextCard{background:#08111f;border:1px solid #223a59;border-radius:20px;padding:18px}
        .liveContextCard h4{margin:0 0 10px;font-size:16px}
        .driverList,.headlineList{margin:0;padding-left:18px;color:#d8e1ef;line-height:1.7}
        .headlineList li{margin-bottom:8px}
        .headlineList a{color:#ffdc8a;text-decoration:none}
        .headlineList small{display:block;color:#94a3b8}
        .liveContextStatus{font-size:12px;color:#94a3b8;margin-top:10px}
        .liveContextAction{display:flex;gap:10px;flex-wrap:wrap;margin-top:12px}
        .contextBadge{display:inline-flex;border-radius:999px;padding:7px 10px;font-size:12px;font-weight:900;background:rgba(232,189,98,.14);color:#ffe7ad;border:1px solid rgba(232,189,98,.32)}
        @media(max-width:1000px){.liveContextMeta,.liveContextGrid{grid-template-columns:1fr}}
      </style>
      <div class="liveContextWrap">
        <div class="liveContextHero">
          <div style="display:flex;justify-content:space-between;gap:12px;align-items:flex-start;flex-wrap:wrap">
            <div>
              <span class="contextBadge">Current Affairs + Sentiment Interpretation</span>
              <h3 id="contextTitle">Loading stock interpretation...</h3>
            </div>
            <button class="btn light" type="button" id="refreshAnalysisContext">Refresh Analysis</button>
          </div>
          <p id="contextInterpretation">Combining price action, current headlines, macro conditions and geopolitical context.</p>
          <div class="liveContextMeta">
            <div class="liveContextMetric"><span>Context Stance</span><b id="contextStance">Loading</b></div>
            <div class="liveContextMetric"><span>News Sentiment</span><b id="contextSentiment">Loading</b></div>
            <div class="liveContextMetric"><span>Geopolitical Risk</span><b id="contextGeo">Loading</b></div>
            <div class="liveContextMetric"><span>Macro Risk</span><b id="contextMacro">Loading</b></div>
          </div>
          <div class="liveContextStatus" id="contextUpdated">Waiting for selected asset...</div>
        </div>
        <div class="liveContextGrid">
          <div class="liveContextCard">
            <h4>Why this interpretation</h4>
            <ul class="driverList" id="contextDrivers"><li>Loading drivers...</li></ul>
          </div>
          <div class="liveContextCard">
            <h4>Current affairs / macro headlines</h4>
            <ul class="headlineList" id="contextMacroNews"><li>Loading recent headlines...</li></ul>
          </div>
        </div>
        <div class="liveContextGrid">
          <div class="liveContextCard">
            <h4>Company / asset headlines</h4>
            <ul class="headlineList" id="contextCompanyNews"><li>Loading recent headlines...</li></ul>
          </div>
          <div class="liveContextCard">
            <h4>Market headlines</h4>
            <ul class="headlineList" id="contextMarketNews"><li>Loading recent headlines...</li></ul>
          </div>
        </div>
      </div>`;

    analysisTab.appendChild(panel);
    const button = document.getElementById('refreshAnalysisContext');
    if (button) button.addEventListener('click', loadLiveContextAnalysis);
  }

  function renderNewsList(targetId, items, fallbackText) {
    const target = document.getElementById(targetId);
    if (!target) return;
    if (!items || !items.length) {
      target.innerHTML = `<li>${escapeHtml(fallbackText)}</li>`;
      return;
    }
    target.innerHTML = items.map((item) => {
      const title = escapeHtml(item.title || 'Untitled headline');
      const source = escapeHtml(item.source || 'Source');
      const date = item.publishedAt ? new Date(item.publishedAt).toLocaleString() : '';
      const link = item.url ? `<a href="${escapeHtml(item.url)}" target="_blank" rel="noopener noreferrer">${title}</a>` : title;
      return `<li>${link}<small>${source}${date ? ' · ' + escapeHtml(date) : ''}</small></li>`;
    }).join('');
  }

  function updateSimpleAnalysisHeader(data) {
    const momentum = document.getElementById('momentumScore');
    const risk = document.getElementById('riskScore');
    const macro = document.getElementById('macroScore');
    if (momentum) momentum.textContent = data.priceBias || 'Neutral';
    if (risk) risk.textContent = data.geopoliticalRisk === 'High' ? 'High headline risk' : data.geopoliticalRisk === 'Medium' ? 'Moderate headline risk' : 'Lower headline risk';
    if (macro) macro.textContent = data.macroRisk || 'Mixed';
  }

  async function loadLiveContextAnalysis() {
    ensureAnalysisLayout();
    const { selectedAsset, liveQuote } = getState();
    if (!selectedAsset) return;

    const symbol = selectedAsset.quoteSymbol || '';
    const name = selectedAsset.name || symbol;
    const market = selectedAsset.market || 'U.S.';
    const sector = selectedAsset.sector || 'Equity';
    const changePercent = liveQuote && Number.isFinite(Number(liveQuote.changePercent)) ? Number(liveQuote.changePercent) : 0;

    const title = document.getElementById('contextTitle');
    const interpretation = document.getElementById('contextInterpretation');
    const updated = document.getElementById('contextUpdated');
    if (title) title.textContent = `Analyzing ${name}...`;
    if (interpretation) interpretation.textContent = 'Reviewing latest price action, current affairs, geopolitical headlines and sampled market news.';
    if (updated) updated.textContent = 'Refreshing live context...';

    try {
      const query = new URLSearchParams({ symbol, name, market, sector, changePercent: String(changePercent) });
      const response = await fetch('/.netlify/functions/market-analysis?' + query.toString());
      const data = await response.json();
      if (!response.ok || data.error) throw new Error(data.error || 'Analysis request failed.');

      if (title) title.textContent = `${data.name} (${data.symbol}) — ${data.stance}`;
      if (interpretation) interpretation.textContent = `${data.interpretation} ${data.contextNote || ''}`;
      const stance = document.getElementById('contextStance');
      const sentiment = document.getElementById('contextSentiment');
      const geo = document.getElementById('contextGeo');
      const macro = document.getElementById('contextMacro');
      if (stance) stance.textContent = data.stance || 'Mixed';
      if (sentiment) sentiment.textContent = data.sentiment || 'Mixed';
      if (geo) geo.textContent = data.geopoliticalRisk || 'Unknown';
      if (macro) macro.textContent = data.macroRisk || 'Unknown';
      if (updated) updated.textContent = `Updated ${new Date(data.updatedAt).toLocaleString()} · ${data.methodology}`;

      const drivers = document.getElementById('contextDrivers');
      if (drivers) drivers.innerHTML = (data.drivers || []).map(item => `<li>${escapeHtml(item)}</li>`).join('') || '<li>No interpretation drivers returned.</li>';

      renderNewsList('contextCompanyNews', data.companyNews, 'No company-specific headlines returned in the latest sample.');
      renderNewsList('contextMarketNews', data.marketNews, 'No broad market headlines returned in the latest sample.');
      renderNewsList('contextMacroNews', data.macroNews, 'No macro/geopolitical headlines returned in the latest sample.');
      updateSimpleAnalysisHeader(data);
    } catch (error) {
      if (title) title.textContent = 'Live interpretation unavailable';
      if (interpretation) interpretation.textContent = 'The analysis context endpoint did not return data. The price-based table will remain available, and this section will refresh again when a new asset is selected.';
      if (updated) updated.textContent = error.message || 'Context analysis unavailable.';
    }
  }

  function wrapGlobalFunction(functionName, callback) {
    const install = () => {
      if (typeof window[functionName] !== 'function') {
        setTimeout(install, 120);
        return;
      }
      const original = window[functionName];
      window[functionName] = function wrappedFunction() {
        const result = original.apply(this, arguments);
        Promise.resolve(result).finally(() => setTimeout(callback, 250));
        return result;
      };
    };
    install();
  }

  ensureAnalysisLayout();
  setTimeout(loadLiveContextAnalysis, 900);
  wrapGlobalFunction('selectAsset', loadLiveContextAnalysis);
  wrapGlobalFunction('fetchFinnhubQuote', loadLiveContextAnalysis);
})();