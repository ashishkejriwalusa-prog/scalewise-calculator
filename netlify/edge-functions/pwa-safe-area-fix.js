export default async function handler(request, context) {
  const res = await context.next();
  const ct = res.headers.get('content-type') || '';
  if (!ct.includes('text/html')) return res;
  let page = await res.text();
  const oldLabel = ['Founder', 'digital asset investment and advisory firm'].join(', ');
  const newLabel = ['Founder', 'web3 company'].join(', ');
  page = page.split(oldLabel).join(newLabel);
  const css = '<style id="scale-form-height-fix">.engagementFrame{height:1320px!important}@media(max-width:960px){.engagementFrame{height:1500px!important}}@media(max-width:620px){.engagementFrame{height:1760px!important}}</style>';
  if (!page.includes('scale-form-height-fix')) page = page.replace('</head>', css + '</head>');
  return new Response(page, { status: res.status, statusText: res.statusText, headers: res.headers });
}
