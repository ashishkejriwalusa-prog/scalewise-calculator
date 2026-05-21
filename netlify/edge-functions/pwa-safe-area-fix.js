export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  let html = await response.text();

  html = html
    .replace('Finance Operations · Accounting · Reporting', 'Finance Operations · Accounting · Reporting · CFO Advisory')
    .replace('Founder, digital asset investment and advisory firm', 'Founder, Web3 company')
    .replace('<a href="#assistant">Ask ScaleWise</a><a href="#contact">Contact</a>', '<a href="#assistant" data-open-scalewise-ai>Ask ScaleWise</a><a href="#sw-insights">SW Insights</a><a href="#contact">Contact</a>');

  const insightsSection = `
    <section id="sw-insights" class="swInsightsSection"><div class="container"><div class="head"><h2>SW Insights</h2><p>Post ScaleWise case studies, attach supporting files, and show the poster name directly on the website.</p></div><div class="swInsightsShell"><form class="swInsightsForm" id="swInsightsForm"><div><label>Poster name</label><input id="swPosterName" type="text" placeholder="Enter poster name" required></div><div><label>Case study title</label><input id="swPostTitle" type="text" placeholder="Enter case study title" required></div><div><label>Case study summary</label><textarea id="swPostSummary" placeholder="Write the case study insight, result, or client story" required></textarea></div><div><label>Add file</label><input id="swPostFile" type="file" accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.webp"></div><button class="btn gold" type="submit">Publish Insight</button></form><div class="swInsightsFeed"><h3>Published Insights</h3><div id="swInsightsPosts" class="swInsightsPosts"><div class="swEmptyPost">No case studies posted yet. Use the form to add your first SW Insight.</div></div></div></div></div></section>
  `;

  if (!html.includes('id="sw-insights"')) {
    html = html.replace('<section id="contact">', `${insightsSection}<section id="contact">`);
  }

  const safeAreaCss = `
  <style id="pwa-permanent-iphone-safe-area-fix">
    .swInsightsSection{background:linear-gradient(180deg,#f6f8fb 0%,#fff 100%)}
    .swInsightsShell{display:grid;grid-template-columns:.9fr 1.1fr;gap:24px;align-items:start}
    .swInsightsForm,.swInsightsFeed{background:#fff;border:1px solid var(--line);border-radius:28px;padding:28px;box-shadow:var(--shadow)}
    .swInsightsForm{display:grid;gap:16px}
    .swInsightsForm textarea{width:100%;min-height:150px;resize:vertical;border:1px solid #d8dee8;background:#fbfcfe;border-radius:15px;padding:14px 15px;font:inherit;font-weight:700;color:#101828;line-height:1.55}
    .swInsightsForm textarea:focus{outline:0;border-color:var(--gold);box-shadow:0 0 0 4px rgba(232,189,98,.18)}
    .swInsightsFeed h3{margin:0 0 18px;font-size:28px;color:var(--navy)}
    .swInsightsPosts{display:grid;gap:14px}
    .swInsightPost{border:1px solid var(--line);border-radius:20px;padding:18px;background:#fbfcfe}
    .swInsightPost h4{margin:0 0 8px;color:var(--navy);font-size:21px;line-height:1.25}
    .swInsightPost p{margin:0 0 12px;color:#53637b;line-height:1.65}
    .swPostMeta{display:flex;flex-wrap:wrap;gap:8px;align-items:center;color:#73510b;font-size:12px;font-weight:1000;text-transform:uppercase;letter-spacing:.07em}
    .swPostMeta span{display:inline-flex;border:1px solid #f3d791;background:#fff6df;border-radius:999px;padding:8px 10px}
    .swEmptyPost{border:1px dashed #cfd7e4;border-radius:18px;padding:18px;color:#667085;background:#fbfcfe;line-height:1.55}
    @media(max-width:960px){.swInsightsShell{grid-template-columns:1fr}.swInsightsForm,.swInsightsFeed{padding:22px;border-radius:22px}}
    @media (display-mode: standalone) and (max-width:620px),
           (display-mode: fullscreen) and (max-width:620px){
      html, body{
        width:100%;
        min-height:100%;
        overflow-x:hidden;
        background:#061a33;
      }

      .nav{
        position:fixed;
        top:0;
        left:0;
        right:0;
        min-height:calc(76px + env(safe-area-inset-top));
        padding-top:env(safe-area-inset-top);
        background:#061a33;
      }

      .navin{
        height:76px !important;
        min-height:76px !important;
        align-items:center !important;
      }

      .brand{
        max-width:calc(100vw - 106px);
        overflow:hidden;
      }

      .brand strong{
        font-size:18px !important;
        line-height:1 !important;
        white-space:nowrap;
      }

      .mark{
        width:38px !important;
        height:38px !important;
        flex:0 0 38px;
      }

      .mark svg{
        width:38px !important;
        height:38px !important;
        display:block;
      }

      .menuBtn{
        width:48px !important;
        height:48px !important;
        min-width:48px !important;
        margin-right:max(0px, env(safe-area-inset-right));
        display:grid !important;
        place-items:center !important;
        flex:0 0 48px;
      }

      .links{
        top:calc(76px + env(safe-area-inset-top)) !important;
      }

      .backdrop{
        top:calc(76px + env(safe-area-inset-top)) !important;
      }

      .hero{
        padding-top:calc(140px + env(safe-area-inset-top)) !important;
      }
    }
  </style>
  `;

  const insightsScript = `
  <script id="sw-insights-and-ai-fix">
    (function(){
      function openScaleWiseAi(event){
        var trigger = event.target.closest('[data-open-scalewise-ai], a[href="#assistant"]');
        if(!trigger) return;
        event.preventDefault();
        var menu = document.getElementById('mobileMenu');
        var backdrop = document.getElementById('backdrop');
        var menuBtn = document.getElementById('menuBtn');
        if(menu) menu.classList.remove('open');
        if(backdrop) backdrop.classList.remove('show');
        if(menuBtn){ menuBtn.setAttribute('aria-expanded','false'); menuBtn.textContent='☰'; }
        var launcher = document.getElementById('launcher');
        var chat = document.getElementById('chat');
        if(chat && !chat.classList.contains('open') && launcher){ launcher.click(); }
        if(chat){ setTimeout(function(){ chat.scrollIntoView({behavior:'smooth', block:'nearest'}); }, 50); }
      }
      document.addEventListener('click', openScaleWiseAi, true);

      function escapeHtml(value){
        return String(value || '').replace(/[&<>'"]/g, function(char){
          return {'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char];
        });
      }
      function getPosts(){
        try { return JSON.parse(localStorage.getItem('swInsightsPosts') || '[]'); }
        catch(e){ return []; }
      }
      function savePosts(posts){ localStorage.setItem('swInsightsPosts', JSON.stringify(posts)); }
      function renderPosts(){
        var feed = document.getElementById('swInsightsPosts');
        if(!feed) return;
        var posts = getPosts();
        if(!posts.length){
          feed.innerHTML = '<div class="swEmptyPost">No case studies posted yet. Use the form to add your first SW Insight.</div>';
          return;
        }
        feed.innerHTML = posts.map(function(post){
          var file = post.fileName ? '<span>File: '+escapeHtml(post.fileName)+'</span>' : '';
          return '<article class="swInsightPost"><h4>'+escapeHtml(post.title)+'</h4><p>'+escapeHtml(post.summary)+'</p><div class="swPostMeta"><span>Poster: '+escapeHtml(post.poster)+'</span><span>'+escapeHtml(post.date)+'</span>'+file+'</div></article>';
        }).join('');
      }
      function initInsights(){
        renderPosts();
        var form = document.getElementById('swInsightsForm');
        if(!form || form.dataset.bound === 'true') return;
        form.dataset.bound = 'true';
        form.addEventListener('submit', function(event){
          event.preventDefault();
          var fileInput = document.getElementById('swPostFile');
          var posts = getPosts();
          posts.unshift({
            poster: document.getElementById('swPosterName').value.trim(),
            title: document.getElementById('swPostTitle').value.trim(),
            summary: document.getElementById('swPostSummary').value.trim(),
            fileName: fileInput && fileInput.files && fileInput.files[0] ? fileInput.files[0].name : '',
            date: new Date().toLocaleDateString()
          });
          savePosts(posts);
          form.reset();
          renderPosts();
        });
      }
      if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initInsights);
      else initInsights();
    })();
  </script>
  `;

  if (!html.includes('pwa-permanent-iphone-safe-area-fix')) {
    html = html.replace('</head>', `${safeAreaCss}</head>`);
  }

  if (!html.includes('sw-insights-and-ai-fix')) {
    html = html.replace('</body>', `${insightsScript}</body>`);
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
