export default async function handler(request, context) {
  const res = await context.next();
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return res;

  let page = await res.text();

  const oldLabel = ['Founder', 'digital asset investment and advisory firm'].join(', ');
  const newLabel = ['Founder', 'web3 company'].join(', ');
  page = page.split(oldLabel).join(newLabel);

  const dropdown = '<span class="sw-nav-drop"><a href="sw-insights.html" class="sw-insights-link">SW Insights <span class="sw-caret">▾</span></a><span class="sw-mega"><span class="sw-mega-inner"><span><b>Explore SW Insights →</b><small>GO DEEPER</small><a href="sw-insights.html#articles">Articles</a><a href="sw-insights.html#case-studies">Case Studies</a></span><span><b>Publish</b><small>SCALEWISE LIBRARY</small><a href="sw-insights.html#publish">Post an article</a><a href="sw-insights.html#publish">Post a case study</a></span></span></span></span>';
  const fixedNav = '<a href="#assistant" data-open-scalewise-ai="true">Ask ScaleWise</a>' + dropdown + '<a href="#contact">Contact</a>';

  page = page
    .replace('<a href="#assistant">Ask ScaleWise</a><a href="#contact">Contact</a>', fixedNav)
    .replace(/<a href="#assistant"[^>]*>Ask ScaleWise<\/a><span class="sw-nav-drop">[\s\S]*?<\/span><a href="#contact">Contact<\/a>/, fixedNav)
    .replace(/<a href="#assistant"[^>]*>Ask ScaleWise<\/a>/g, '<a href="#assistant" data-open-scalewise-ai="true">Ask ScaleWise</a>')
    .replace(/SW Insights\s*⌃/g, 'SW Insights <span class="sw-caret">▾</span>')
    .replace(/<span class="arrow">⌃<\/span>/g, '<span class="arrow sw-caret">▾</span>');

  const css = `
<style id="scale-form-height-fix">
:root{--sw-safe-top:env(safe-area-inset-top,0px);--sw-safe-bottom:env(safe-area-inset-bottom,0px)}
.nav{padding-top:var(--sw-safe-top)!important}
.engagementFrame{height:1320px!important}
@media(max-width:960px){.engagementFrame{height:1500px!important}}
@media(max-width:620px){.engagementFrame{height:1760px!important}}
.sw-nav-drop,.navDrop{display:inline-flex!important;align-items:center!important;position:relative!important;height:76px!important}
.sw-insights-link,.insightsBtn{color:rgba(255,255,255,.84)!important;text-decoration:none!important;font-weight:800!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;line-height:1!important;height:76px!important;padding:0!important;white-space:nowrap!important}
.sw-caret,.arrow{display:inline-flex!important;align-items:center!important;justify-content:center!important;font-size:13px!important;line-height:1!important;transform:translateY(1px)!important;color:#1594ff!important}
.sw-mega,.mega{display:none;position:fixed!important;left:0!important;right:0!important;top:calc(76px + var(--sw-safe-top))!important;background:#fff!important;color:#111827!important;border-bottom:1px solid #e6ebf2!important;box-shadow:0 28px 70px rgba(6,26,51,.18)!important;padding:34px 0!important;z-index:9999!important;pointer-events:auto!important}
.sw-nav-drop:hover .sw-mega,.sw-nav-drop:focus-within .sw-mega,.sw-nav-drop.open .sw-mega,.sw-mega:hover,.navDrop:hover .mega,.navDrop:focus-within .mega,.navDrop.open .mega,.mega:hover{display:block!important}
.sw-mega-inner,.megaGrid{width:min(1180px,calc(100% - 40px))!important;margin:auto!important;display:grid!important;grid-template-columns:1fr 1fr!important;gap:54px!important}
.sw-mega b,.mega b,.mega h3{display:block!important;font-size:22px!important;margin-bottom:18px!important;color:#111827!important}
.sw-mega small,.mega small,.megaLabel{display:block!important;font-size:13px!important;letter-spacing:.12em!important;text-transform:uppercase!important;font-weight:900!important;margin-bottom:10px!important;color:#111827!important}
.sw-mega a,.mega a{display:block!important;color:#1f2937!important;text-decoration:none!important;font-weight:700!important;padding:10px 0!important;height:auto!important;line-height:1.35!important}
.sw-mega a:hover,.mega a:hover{color:#075ee8!important}
@media(max-width:960px){.navin{height:76px!important}.links{top:calc(76px + var(--sw-safe-top))!important;max-height:calc(100dvh - 76px - var(--sw-safe-top) - var(--sw-safe-bottom))!important;overflow-y:auto!important;-webkit-overflow-scrolling:touch!important;overscroll-behavior:contain!important;touch-action:pan-y!important;padding-bottom:calc(22px + var(--sw-safe-bottom))!important}.backdrop{inset:calc(76px + var(--sw-safe-top)) 0 0!important}.sw-nav-drop,.navDrop{display:block!important;height:auto!important}.sw-insights-link,.insightsBtn{justify-content:flex-start!important;height:auto!important;padding:15px 14px!important}.sw-mega,.mega{position:static!important;display:block!important;background:rgba(255,255,255,.06)!important;box-shadow:none!important;border:0!important;border-radius:18px!important;padding:14px!important;margin:0 0 10px!important}.sw-mega-inner,.megaGrid{width:auto!important;display:grid!important;grid-template-columns:1fr!important;gap:14px!important}.sw-mega b,.sw-mega small,.mega b,.mega h3,.mega small,.megaLabel{color:#fff!important}.sw-mega a,.mega a{color:rgba(255,255,255,.86)!important}}
@media(max-width:620px){.navin{height:68px!important}.links{top:calc(68px + var(--sw-safe-top))!important;max-height:calc(100dvh - 68px - var(--sw-safe-top) - var(--sw-safe-bottom))!important}.backdrop{inset:calc(68px + var(--sw-safe-top)) 0 0!important}.menuBtn{touch-action:manipulation!important}}
</style>`;

  page = page.replace(/<style id="scale-form-height-fix">[\s\S]*?<\/style>/g, '');
  page = page.replace('</head>', css + '</head>');

  const script = `
<script id="ask-scalewise-nav-fix">
(function(){
  function closeMobileMenu(){
    var menu=document.getElementById('mobileMenu');
    var bd=document.getElementById('backdrop');
    var mb=document.getElementById('menuBtn');
    if(menu) menu.classList.remove('open');
    if(bd) bd.classList.remove('show');
    if(mb){ mb.setAttribute('aria-expanded','false'); mb.textContent='☰'; }
  }
  function getChat(){return document.getElementById('chat')||document.querySelector('.chat');}
  function hideChat(){
    var chat=getChat();
    if(!chat) return;
    chat.classList.remove('open');
    chat.style.display='none';
  }
  function openChat(){
    closeMobileMenu();
    var chat=getChat();
    var launcher=document.getElementById('launcher')||document.querySelector('.launcher');
    var hero=document.getElementById('heroAi');
    if(launcher && !launcher.dataset.swOpening){ launcher.dataset.swOpening='1'; launcher.click(); setTimeout(function(){delete launcher.dataset.swOpening;},150); }
    else if(hero && !hero.dataset.swOpening){ hero.dataset.swOpening='1'; hero.click(); setTimeout(function(){delete hero.dataset.swOpening;},150); }
    setTimeout(function(){
      chat=getChat();
      if(chat){
        chat.style.display='flex';
        chat.classList.add('open');
        var input=chat.querySelector('input,textarea');
        if(input) input.focus();
      }
    },80);
  }
  function safeParse(v){try{return JSON.parse(v||'[]')}catch(e){return[]}}
  function esc(v){return String(v||'').replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]})}
  function getCookie(name){var m=document.cookie.match(new RegExp('(?:^|; )'+name.replace(/[.*+?^\${}()|[\\]\\\\]/g,'\\\\$&')+'=([^;]*)'));return m?decodeURIComponent(m[1]):''}
  function setCookie(name,value){document.cookie=name+'='+encodeURIComponent(value)+'; Max-Age=31536000; Path=/; SameSite=Lax'}
  function trimForCookie(posts){return (posts||[]).slice(0,12).map(function(p){return {type:p.type||'Article',poster:p.poster||'',title:p.title||'',summary:p.summary||'',date:p.date||'',fileName:p.fileName||'',fileData:''}})}
  function syncInsightsLibrary(){
    if(!/sw-insights\.html|\/sw-insights\/?$/.test(location.pathname)) return;
    var key='swInsightsLibrary', cookieName='swInsightsLibrarySync', feed=document.getElementById('feed');
    var local=safeParse(localStorage.getItem(key));
    var cookie=safeParse(getCookie(cookieName));
    if(local.length){setCookie(cookieName,JSON.stringify(trimForCookie(local)));return;}
    if(cookie.length){
      localStorage.setItem(key,JSON.stringify(cookie));
      if(feed){
        feed.innerHTML=cookie.map(function(p){return '<article class="post"><div class="postTop"><span class="chip">'+esc(p.type)+'</span><span class="chip">'+esc(p.date)+'</span></div><h3>'+esc(p.title)+'</h3><p>'+esc(p.summary)+'</p><div class="meta"><span class="chip">Poster: '+esc(p.poster)+'</span></div></article>'}).join('');
      }
    }
  }
  document.addEventListener('click',function(e){
    var closeBtn=e.target.closest('.chat .close,#chat .close,[data-close-chat],.chatClose,.chat-close');
    if(closeBtn){
      setTimeout(hideChat,20);
      return;
    }
    var t=e.target.closest('[data-open-scalewise-ai],a[href="#assistant"]');
    if(!t) return;
    e.preventDefault();
    e.stopPropagation();
    openChat();
  },true);
  document.addEventListener('submit',function(e){if(e.target&&e.target.id==='insightForm'){setTimeout(syncInsightsLibrary,450)}},true);
  document.addEventListener('keydown',function(e){ if(e.key==='Escape') hideChat(); });
  function initDropdown(){
    document.querySelectorAll('.sw-nav-drop,.navDrop').forEach(function(drop){
      var timer;
      var open=function(){clearTimeout(timer);drop.classList.add('open');};
      var close=function(){timer=setTimeout(function(){drop.classList.remove('open');},650);};
      drop.addEventListener('mouseenter',open);
      drop.addEventListener('mouseleave',close);
      drop.addEventListener('focusin',open);
      drop.addEventListener('focusout',close);
      var panel=drop.querySelector('.sw-mega,.mega');
      if(panel){panel.addEventListener('mouseenter',open);panel.addEventListener('mouseleave',close);}
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',function(){initDropdown();syncInsightsLibrary();}); else {initDropdown();syncInsightsLibrary();}
})();
</script>`;

  page = page.replace(/<script id="ask-scalewise-nav-fix">[\s\S]*?<\/script>/g, '');
  page = page.replace('</body>', script + '</body>');

  return new Response(page, { status: res.status, statusText: res.statusText, headers: res.headers });
}
