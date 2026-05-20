export default async (request, context) => {
  const response = await context.next();
  const contentType = response.headers.get('content-type') || '';

  if (!contentType.includes('text/html')) {
    return response;
  }

  let html = await response.text();

  const safeAreaCss = `
  <style id="pwa-permanent-iphone-safe-area-fix">
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

  if (!html.includes('pwa-permanent-iphone-safe-area-fix')) {
    html = html.replace('</head>', `${safeAreaCss}</head>`);
  }

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers: response.headers,
  });
};
