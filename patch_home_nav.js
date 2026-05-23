const fs = require('fs');
const path = 'index.html';
let html = fs.readFileSync(path, 'utf8');

// Restore SW Insights in the home-page ribbon and make Ask ScaleWise open the chat.
html = html.replace(
  '<a href="#assistant">Ask ScaleWise</a><a href="#contact">Contact</a>',
  '<a href="#assistant" data-open-scalewise-ai="true">Ask ScaleWise</a><a href="sw-insights.html">SW Insights</a><a href="#contact">Contact</a>'
);

html = html.replace(
  '<a href="#assistant">Ask ScaleWise</a><a href="sw-insights.html">SW Insights</a><a href="#contact">Contact</a>',
  '<a href="#assistant" data-open-scalewise-ai="true">Ask ScaleWise</a><a href="sw-insights.html">SW Insights</a><a href="#contact">Contact</a>'
);

if (!html.includes('href="sw-insights.html">SW Insights</a>')) {
  html = html.replace(
    '<a href="#contact">Contact</a></div></div></nav>',
    '<a href="sw-insights.html">SW Insights</a><a href="#contact">Contact</a></div></div></nav>'
  );
}

const fixScript = `
<script id="home-nav-ask-scalewise-fix">
(function(){
  function closeMenu(){
    var menu=document.getElementById('mobileMenu');
    var bd=document.getElementById('backdrop');
    var btn=document.getElementById('menuBtn');
    if(menu) menu.classList.remove('open');
    if(bd) bd.classList.remove('show');
    if(btn){btn.setAttribute('aria-expanded','false');btn.textContent='☰';}
  }
  function getChat(){return document.getElementById('chat');}
  function hardCloseChat(){
    var chat=getChat();
    var launcher=document.getElementById('launcher');
    if(!chat) return;
    chat.classList.remove('open');
    chat.setAttribute('aria-hidden','true');
    chat.style.display='none';
    chat.style.visibility='hidden';
    chat.style.pointerEvents='none';
    if(launcher) launcher.setAttribute('aria-expanded','false');
  }
  function openScaleWiseChat(){
    closeMenu();
    var chat=getChat();
    var launcher=document.getElementById('launcher');
    if(chat){
      chat.style.visibility='visible';
      chat.style.pointerEvents='auto';
      chat.style.display='flex';
      chat.classList.add('open');
      chat.setAttribute('aria-hidden','false');
      if(launcher) launcher.setAttribute('aria-expanded','true');
      var input=document.getElementById('chatInput');
      if(input) setTimeout(function(){input.focus();},80);
    }
  }
  document.addEventListener('click',function(e){
    var closeBtn=e.target.closest('#closeChat,.close,[aria-label="Close ScaleWise AI"]');
    if(closeBtn){
      e.preventDefault();
      e.stopPropagation();
      setTimeout(hardCloseChat,0);
      return;
    }
    var link=e.target.closest('a[href="#assistant"], [data-open-scalewise-ai="true"]');
    if(!link) return;
    e.preventDefault();
    e.stopPropagation();
    openScaleWiseChat();
  },true);
  document.addEventListener('keydown',function(e){if(e.key==='Escape') hardCloseChat();});
})();
</script>`;

html = html.replace(/<script id="home-nav-ask-scalewise-fix">[\s\S]*?<\/script>/g, '');
html = html.replace('</body>', fixScript + '\n</body>');

fs.writeFileSync(path, html, 'utf8');
console.log('Home navigation patched: Ask ScaleWise + SW Insights restored + chat close fixed.');
