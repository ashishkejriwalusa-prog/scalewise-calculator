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
    .replace(/SW Insights\s*⌃/g, 'SW Insights <span class="sw-caret">▾</span>');

  const css = `
<style id="scale-form-height-fix">
.engagementFrame{height:1320px!important}
@media(max-width:960px){.engagementFrame{height:1500px!important}}
@media(max-width:620px){.engagementFrame{height:1760px!important}}
.sw-nav-drop{display:inline-flex;align-items:center;position:relative;height:76px}
.sw-insights-link{color:rgba(255,255,255,.84)!important;text-decoration:none!important;font-weight:800!important;display:inline-flex!important;align-items:center!important;justify-content:center!important;gap:5px!important;line-height:1!important;height:76px!important;padding:0!important}
.sw-caret{display:inline-flex;align-items:center;justify-content:center;font-size:13px;line-height:1;transform:translateY(1px)}
.sw-mega{display:none;position:fixed;left:0;right:0;top:76px;background:#fff;color:#111827;border-bottom:1px solid #e6ebf2;box-shadow:0 28px 70px rgba(6,26,51,.18);padding:34px 0;z-index:9999;pointer-events:auto}
.sw-nav-drop:hover .sw-mega,.sw-nav-drop:focus-within .sw-mega,.sw-nav-drop.open .sw-mega,.sw-mega:hover{display:block!important}
.sw-mega-inner{width:min(1180px,calc(100% - 40px));margin:auto;display:grid;grid-template-columns:1fr 1fr;gap:54px}
.sw-mega b{display:block;font-size:22px;margin-bottom:18px;color:#111827}
.sw-mega small{display:block;font-size:13px;letter-spacing:.12em;text-transform:uppercase;font-weight:900;margin-bottom:10px;color:#111827}
.sw-mega a{display:block!important;color:#1f2937!important;text-decoration:none!important;font-weight:700!important;padding:10px 0!important;height:auto!important;line-height:1.35!important}
.sw-mega a:hover{color:#075ee8!important}
@media(max-width:960px){.sw-nav-drop{display:block;height:auto}.sw-insights-link{justify-content:flex-start!important;height:auto!important;padding:15px 14px!important}.sw-mega{position:static;display:block!important;background:rgba(255,255,255,.06);box-shadow:none;border:0;border-radius:18px;padding:14px;margin:0 0 10px}.sw-mega-inner{width:auto;display:grid;grid-template-columns:1fr;gap:14px}.sw-mega b,.sw-mega small{color:#fff}.sw-mega a{color:rgba(255,255,255,.86)!important}}
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
  function openChat(){
    closeMobileMenu();
    var chat=document.getElementById('chat')||document.querySelector('.chat');
    var launcher=document.getElementById('launcher')||document.querySelector('.launcher');
    var hero=document.getElementById('heroAi');
    if(launcher && !launcher.dataset.swOpening){ launcher.dataset.swOpening='1'; launcher.click(); setTimeout(function(){delete launcher.dataset.swOpening;},150); }
    else if(hero && !hero.dataset.swOpening){ hero.dataset.swOpening='1'; hero.click(); setTimeout(function(){delete hero.dataset.swOpening;},150); }
    chat=document.getElementById('chat')||document.querySelector('.chat');
    if(chat){ chat.classList.add('open'); chat.style.display='flex'; setTimeout(function(){var input=chat.querySelector('input,textarea'); if(input) input.focus();},120); }
  }
  document.addEventListener('click',function(e){
    var t=e.target.closest('[data-open-scalewise-ai],a[href="#assistant"]');
    if(!t) return;
    e.preventDefault();
    e.stopPropagation();
    openChat();
  },true);
  function initDropdown(){
    document.querySelectorAll('.sw-nav-drop').forEach(function(drop){
      var timer;
      var open=function(){clearTimeout(timer);drop.classList.add('open');};
      var close=function(){timer=setTimeout(function(){drop.classList.remove('open');},450);};
      drop.addEventListener('mouseenter',open);
      drop.addEventListener('mouseleave',close);
      drop.addEventListener('focusin',open);
      drop.addEventListener('focusout',close);
    });
  }
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initDropdown); else initDropdown();
})();
</script>`;

  page = page.replace(/<script id="ask-scalewise-nav-fix">[\s\S]*?<\/script>/g, '');
  page = page.replace('</body>', script + '</body>');

  return new Response(page, { status: res.status, statusText: res.statusText, headers: res.headers });
}
