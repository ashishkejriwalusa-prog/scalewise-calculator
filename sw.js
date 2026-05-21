const CACHE_NAME = 'scalewise-pwa-v2-header-fix';
const CORE_ASSETS = [
  '/',
  '/index.html',
  '/client-intake.html',
  '/scalewise-direct.html',
  '/favicon.svg',
  '/site.webmanifest'
];

const PWA_HEADER_FIX_CSS = `
  /* ScaleWise iOS PWA header/menu fix */
  .nav{
    padding-top:env(safe-area-inset-top);
    padding-top:constant(safe-area-inset-top);
    z-index:1000;
  }
  .menuBtn{
    position:relative;
    z-index:1003;
    touch-action:manipulation;
    -webkit-tap-highlight-color:transparent;
    cursor:pointer;
  }
  .links.open{display:flex!important;}
  @media(max-width:960px){
    .links{
      top:calc(76px + env(safe-area-inset-top));
      top:calc(76px + constant(safe-area-inset-top));
      z-index:1002;
      max-height:calc(100dvh - 76px - env(safe-area-inset-top));
      overflow:auto;
      -webkit-overflow-scrolling:touch;
    }
    .backdrop{
      top:calc(76px + env(safe-area-inset-top));
      top:calc(76px + constant(safe-area-inset-top));
      z-index:999;
    }
    .hero{padding-top:calc(112px + env(safe-area-inset-top));}
    body.sw-menu-open{overflow:hidden;}
  }
  @media(max-width:620px){
    .brand{min-width:0;max-width:calc(100vw - 106px);}
    .brand strong{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
    .links{
      top:calc(68px + env(safe-area-inset-top));
      top:calc(68px + constant(safe-area-inset-top));
      max-height:calc(100dvh - 68px - env(safe-area-inset-top));
    }
    .backdrop{
      top:calc(68px + env(safe-area-inset-top));
      top:calc(68px + constant(safe-area-inset-top));
    }
    .hero{padding-top:calc(124px + env(safe-area-inset-top));}
  }
  @media(display-mode:standalone) and (max-width:620px){
    .nav{padding-top:max(env(safe-area-inset-top), 10px);}
    .hero{padding-top:calc(132px + env(safe-area-inset-top));}
  }
`;

const PWA_HEADER_FIX_JS = `
  (function(){
    function initScaleWiseMobileMenuFix(){
      var btn=document.getElementById('menuBtn');
      var menu=document.getElementById('mobileMenu');
      var backdrop=document.getElementById('backdrop');
      if(!btn||!menu||!backdrop||btn.dataset.swPwaFix==='1') return;
      btn.dataset.swPwaFix='1';
      function isOpen(){return menu.classList.contains('open');}
      function closeMenu(){
        menu.classList.remove('open');
        backdrop.classList.remove('show');
        document.body.classList.remove('sw-menu-open');
        btn.setAttribute('aria-expanded','false');
        btn.textContent='☰';
      }
      function openMenu(){
        menu.classList.add('open');
        backdrop.classList.add('show');
        document.body.classList.add('sw-menu-open');
        btn.setAttribute('aria-expanded','true');
        btn.textContent='×';
      }
      function toggleMenu(event){
        if(event){event.preventDefault();event.stopPropagation();event.stopImmediatePropagation();}
        isOpen()?closeMenu():openMenu();
      }
      btn.addEventListener('click',toggleMenu,true);
      btn.addEventListener('touchend',toggleMenu,{capture:true,passive:false});
      backdrop.addEventListener('click',function(e){e.preventDefault();closeMenu();},true);
      Array.prototype.forEach.call(menu.querySelectorAll('a'),function(link){
        link.addEventListener('click',function(){setTimeout(closeMenu,0);},true);
      });
      window.addEventListener('resize',function(){if(window.innerWidth>960)closeMenu();});
    }
    if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',initScaleWiseMobileMenuFix);
    else initScaleWiseMobileMenuFix();
  })();
`;

function decorateHtml(html) {
  if (!html || html.includes('swPwaFix=\'1\'') || html.includes('ScaleWise iOS PWA header/menu fix')) return html;
  const cssTag = `<style id="sw-pwa-header-fix">${PWA_HEADER_FIX_CSS}</style>`;
  const jsTag = `<script id="sw-pwa-menu-fix">${PWA_HEADER_FIX_JS}<\/script>`;
  return html.replace('</head>', `${cssTag}\n</head>`).replace('</body>', `${jsTag}\n</body>`);
}

async function decorateResponse(response) {
  const contentType = response.headers.get('content-type') || '';
  if (!contentType.includes('text/html')) return response;
  const html = await response.text();
  return new Response(decorateHtml(html), {
    status: response.status,
    statusText: response.statusText,
    headers: { 'Content-Type': 'text/html; charset=utf-8' }
  });
}

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(CORE_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const { request } = event;

  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(async response => {
          const decorated = await decorateResponse(response.clone());
          const copy = decorated.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          return decorated;
        })
        .catch(() => caches.match(request)
          .then(cached => cached || caches.match('/index.html'))
          .then(async fallback => fallback ? decorateResponse(fallback.clone()) : fallback))
    );
    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      const networkFetch = fetch(request)
        .then(response => {
          if (response && response.status === 200) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then(cache => cache.put(request, copy));
          }
          return response;
        })
        .catch(() => cached);

      return cached || networkFetch;
    })
  );
});
