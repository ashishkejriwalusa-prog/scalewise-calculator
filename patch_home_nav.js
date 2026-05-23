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
  function openScaleWiseChat(){
    closeMenu();
    var chat=document.getElementById('chat');
    var launcher=document.getElementById('launcher');
    if(launcher && chat && !chat.classList.contains('open')) launcher.click();
    if(chat){
      chat.classList.add('open');
      chat.style.display='flex';
      chat.setAttribute('aria-hidden','false');
      var input=document.getElementById('chatInput');
      if(input) setTimeout(function(){input.focus();},80);
    }
  }
  document.addEventListener('click',function(e){
    var link=e.target.closest('a[href="#assistant"], [data-open-scalewise-ai="true"]');
    if(!link) return;
    e.preventDefault();
    e.stopPropagation();
    openScaleWiseChat();
  },true);
})();
</script>`;

html = html.replace(/<script id="home-nav-ask-scalewise-fix">[\s\S]*?<\/script>/g, '');
html = html.replace('</body>', fixScript + '\n</body>');

fs.writeFileSync(path, html, 'utf8');
console.log('Home navigation patched: Ask ScaleWise + SW Insights restored.');
