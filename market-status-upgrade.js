(function () {
  function ensureStyles() {
    if (document.getElementById('marketStatusUpgradeStyles')) return;
    const style = document.createElement('style');
    style.id = 'marketStatusUpgradeStyles';
    style.textContent = `
      .statusGrid.dynamicMarketGrid{grid-template-columns:repeat(2,1fr)}
      .marketStatusDetail{display:block;margin-top:7px;font-size:12px;line-height:1.45;color:#cbd5e1;font-weight:700}
      .marketStatusTime{display:block;margin-top:5px;font-size:11px;line-height:1.45;color:#94a3b8;font-weight:800;text-transform:uppercase;letter-spacing:.05em}
      .status.marketLiveCard{position:relative;overflow:hidden}
      .status.marketLiveCard::after{content:"";position:absolute;inset:auto -22px -26px auto;width:78px;height:78px;border-radius:50%;background:rgba(34,197,94,.09);opacity:0;transition:opacity .25s ease}
      .status.marketLiveCard.is-open::after{opacity:1}
      .status.marketLiveCard b{transition:color .2s ease}
      @media(max-width:1000px){.statusGrid.dynamicMarketGrid{grid-template-columns:1fr}}
    `;
    document.head.appendChild(style);
  }

  function partsInZone(timeZone) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone,
      weekday: 'short',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());
    const mapped = {};
    for (const part of parts) mapped[part.type] = part.value;
    return {
      weekday: mapped.weekday,
      year: Number(mapped.year),
      month: Number(mapped.month),
      day: Number(mapped.day),
      hour: Number(mapped.hour),
      minute: Number(mapped.minute),
      second: Number(mapped.second)
    };
  }

  function minuteOfDay(parts) {
    return parts.hour * 60 + parts.minute;
  }

  function isWeekday(parts) {
    return parts.weekday !== 'Sat' && parts.weekday !== 'Sun';
  }

  function pad(value) {
    return String(value).padStart(2, '0');
  }

  function formatClock(minutes, zoneLabel) {
    const normalized = ((minutes % 1440) + 1440) % 1440;
    const hour24 = Math.floor(normalized / 60);
    const minute = normalized % 60;
    const suffix = hour24 >= 12 ? 'PM' : 'AM';
    const hour12 = hour24 % 12 || 12;
    return `${hour12}:${pad(minute)} ${suffix} ${zoneLabel}`;
  }

  function dayLabel(parts) {
    return `${parts.month}/${parts.day}`;
  }

  function marketStatus({ timeZone, zoneLabel, openMinute, closeMinute, marketName }) {
    const parts = partsInZone(timeZone);
    const nowMinute = minuteOfDay(parts);
    const weekday = isWeekday(parts);
    const open = weekday && nowMinute >= openMinute && nowMinute < closeMinute;
    let detail;
    if (open) {
      detail = `Closes at ${formatClock(closeMinute, zoneLabel)}`;
    } else if (!weekday) {
      detail = `Next regular session: Monday ${formatClock(openMinute, zoneLabel)}`;
    } else if (nowMinute < openMinute) {
      detail = `Opens today at ${formatClock(openMinute, zoneLabel)}`;
    } else {
      detail = `Next regular session: tomorrow ${formatClock(openMinute, zoneLabel)}`;
    }
    const localTime = `${dayLabel(parts)} · ${formatClock(nowMinute, zoneLabel)}`;
    return { open, detail, localTime, marketName };
  }

  function decorateCard(card, idPrefix) {
    if (!card) return;
    card.classList.add('marketLiveCard');
    let detail = card.querySelector(`#${idPrefix}Detail`);
    if (!detail) {
      detail = document.createElement('span');
      detail.id = `${idPrefix}Detail`;
      detail.className = 'marketStatusDetail';
      card.appendChild(detail);
    }
    let time = card.querySelector(`#${idPrefix}LocalTime`);
    if (!time) {
      time = document.createElement('span');
      time.id = `${idPrefix}LocalTime`;
      time.className = 'marketStatusTime';
      card.appendChild(time);
    }
  }

  function removeChartEngineCard() {
    const cards = Array.from(document.querySelectorAll('.heroPanel .statusGrid .status'));
    const chartEngineCard = cards.find((card) => card.textContent && card.textContent.toLowerCase().includes('chart engine'));
    if (chartEngineCard) chartEngineCard.remove();
    const grid = document.querySelector('.heroPanel .statusGrid');
    if (grid) grid.classList.add('dynamicMarketGrid');
  }

  function syncGlobalMarketMode() {
    const us = marketStatus({
      timeZone: 'America/New_York',
      zoneLabel: 'ET',
      openMinute: 9 * 60 + 30,
      closeMinute: 16 * 60,
      marketName: 'U.S.'
    });
    const india = marketStatus({
      timeZone: 'Asia/Kolkata',
      zoneLabel: 'IST',
      openMinute: 9 * 60 + 15,
      closeMinute: 15 * 60 + 30,
      marketName: 'India'
    });

    window.scalewiseMarketStatus = { us, india, updatedAt: new Date().toISOString() };
    window.marketModeForSelected = function marketModeForSelected() {
      const asset = typeof selected !== 'undefined' ? selected : null;
      const market = String(asset && asset.market || '').toLowerCase();
      const symbol = String(asset && asset.quoteSymbol || '').toUpperCase();
      const fxSymbols = ['USDINR','EURUSD','GBPUSD','USDJPY','USDCAD','AUDUSD','NZDUSD','USDSGD','USDAED','USDCNY','USDRUB','USDKWD'];
      if (market === 'fx' || fxSymbols.includes(symbol)) {
        const utcParts = partsInZone('UTC');
        const fxOpen = isWeekday(utcParts);
        return { open: fxOpen, label: fxOpen ? 'FX market active' : 'FX weekend pause', exchange: 'FX', timezone: '24/5' };
      }
      if (market === 'india' || symbol.endsWith('.NS') || symbol.endsWith('.BO')) {
        return { open: india.open, label: india.open ? 'NSE/BSE live' : 'NSE/BSE closed', exchange: 'India', timezone: 'IST' };
      }
      return { open: us.open, label: us.open ? 'U.S. market live' : 'U.S. market closed', exchange: 'U.S.', timezone: 'ET' };
    };
  }

  function renderStatuses() {
    ensureStyles();
    removeChartEngineCard();
    syncGlobalMarketMode();
    const us = window.scalewiseMarketStatus.us;
    const india = window.scalewiseMarketStatus.india;
    const usNode = document.getElementById('usStatus');
    const indiaNode = document.getElementById('indiaStatus');
    const usCard = usNode && usNode.closest('.status');
    const indiaCard = indiaNode && indiaNode.closest('.status');
    decorateCard(usCard, 'usMarket');
    decorateCard(indiaCard, 'indiaMarket');

    if (usNode) {
      usNode.textContent = us.open ? 'Open' : 'Closed';
      usNode.className = us.open ? 'marketOpen' : 'marketClosed';
    }
    if (indiaNode) {
      indiaNode.textContent = india.open ? 'Open' : 'Closed';
      indiaNode.className = india.open ? 'marketOpen' : 'marketClosed';
    }
    if (usCard) usCard.classList.toggle('is-open', us.open);
    if (indiaCard) indiaCard.classList.toggle('is-open', india.open);
    const usDetail = document.getElementById('usMarketDetail');
    const usTime = document.getElementById('usMarketLocalTime');
    const indiaDetail = document.getElementById('indiaMarketDetail');
    const indiaTime = document.getElementById('indiaMarketLocalTime');
    if (usDetail) usDetail.textContent = us.detail;
    if (usTime) usTime.textContent = `Local market time: ${us.localTime}`;
    if (indiaDetail) indiaDetail.textContent = india.detail;
    if (indiaTime) indiaTime.textContent = `Local market time: ${india.localTime}`;
  }

  renderStatuses();
  setInterval(renderStatuses, 30000);
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) renderStatuses();
  });
})();