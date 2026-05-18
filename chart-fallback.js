// ScaleWise Direct chart fallback override
// This script automatically falls back to Yahoo Finance candles when Finnhub candles fail.
(function () {
  function sourceLabel(source) {
    return source === 'Yahoo Finance fallback' ? 'Yahoo candles loaded' : 'Finnhub candles loaded';
  }

  async function loadCandlesWithFallback(symbol) {
    if (!window.candleSeries || !window.volumeSeries || !window.chart) {
      return;
    }

    if (typeof window.setChartState === 'function') {
      window.setChartState('Loading candles for ' + symbol, true);
    }

    const resolutionEl = document.getElementById('resolutionSelect');
    const resolution = resolutionEl ? resolutionEl.value : 'D';
    const days = resolution === 'D' ? 365 : resolution === 'W' ? 1500 : 30;

    async function requestCandles(endpoint) {
      const response = await fetch(endpoint);
      const data = await response.json();
      if (!response.ok || data.error) {
        throw new Error(data.error || 'Candle request failed.');
      }
      if (!data.candles || !data.candles.length) {
        throw new Error(data.message || 'No candle data returned.');
      }
      return data;
    }

    try {
      let data;
      let source = 'Finnhub';

      try {
        data = await requestCandles('/.netlify/functions/finnhub-candles?symbol=' + encodeURIComponent(symbol) + '&resolution=' + encodeURIComponent(resolution) + '&days=' + days);
      } catch (finnhubError) {
        data = await requestCandles('/.netlify/functions/yahoo-candles?symbol=' + encodeURIComponent(symbol) + '&interval=' + encodeURIComponent(resolution));
        source = data.source || 'Yahoo Finance fallback';
      }

      const candles = data.candles.map(function (x) {
        return {
          time: x.time,
          open: x.open,
          high: x.high,
          low: x.low,
          close: x.close
        };
      });

      const volumes = data.candles
        .filter(function (x) { return x.volume !== null && x.volume !== undefined; })
        .map(function (x) {
          return {
            time: x.time,
            value: x.volume,
            color: x.close >= x.open ? 'rgba(34,197,94,.35)' : 'rgba(239,68,68,.35)'
          };
        });

      window.candleSeries.setData(candles);
      window.volumeSeries.setData(volumes);
      window.chart.timeScale().fitContent();

      if (typeof window.setChartState === 'function') {
        window.setChartState(sourceLabel(source) + ' · ' + symbol, true);
      }

      const subtitle = document.getElementById('chartSubTitle');
      if (subtitle) {
        subtitle.textContent = symbol + ' · ' + sourceLabel(source);
      }
    } catch (error) {
      window.candleSeries.setData([]);
      window.volumeSeries.setData([]);
      if (typeof window.setChartState === 'function') {
        window.setChartState(error.message || 'No chart data', false);
      }
    }
  }

  function installOverride() {
    if (typeof window.loadCandles !== 'function') {
      setTimeout(installOverride, 100);
      return;
    }

    window.loadCandles = loadCandlesWithFallback;
    window.reloadCandles = function () {
      if (window.selected && window.selected.quoteSymbol) {
        loadCandlesWithFallback(window.selected.quoteSymbol);
      }
    };

    if (window.selected && window.selected.quoteSymbol) {
      loadCandlesWithFallback(window.selected.quoteSymbol);
    }
  }

  installOverride();
})();
