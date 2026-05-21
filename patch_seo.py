from pathlib import Path

INDEX = Path("index.html")
html = INDEX.read_text(encoding="utf-8")

old_title = "<title>ScaleWise | Offshore Accounting & Finance Support</title>"
new_title = "<title>ScaleWise | Offshore Accounting, Bookkeeping, Tax &amp; CFO Advisory</title>"
html = html.replace(old_title, new_title, 1)

old_description = '<meta name="description" content="ScaleWise helps CPA firms, startups, and growing businesses strengthen bookkeeping, accounting, reporting, tax-ready workflows, FP&A, and offshore finance operations.">'
new_description = '<meta name="description" content="ScaleWise helps U.S. businesses and CPA firms scale smarter with offshore accounting, bookkeeping, tax support, FP&amp;A, reporting, and CFO advisory services.">'
html = html.replace(old_description, new_description, 1)

canonical = '  <link rel="canonical" href="https://scalewise.group/">\n'
if 'rel="canonical" href="https://scalewise.group/"' not in html:
    html = html.replace(new_description + "\n", new_description + "\n" + canonical, 1)

open_graph = '''  <meta property="og:site_name" content="ScaleWise">
  <meta property="og:title" content="ScaleWise | Offshore Accounting, Bookkeeping, Tax &amp; CFO Advisory">
  <meta property="og:description" content="ScaleWise helps U.S. businesses and CPA firms scale smarter with offshore accounting, bookkeeping, tax support, FP&amp;A, reporting, and CFO advisory services.">
  <meta property="og:url" content="https://scalewise.group/">
  <meta property="og:type" content="website">
  <meta name="twitter:card" content="summary_large_image">
'''
if 'property="og:site_name" content="ScaleWise"' not in html:
    html = html.replace(canonical, canonical + open_graph, 1)

schema = '''  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "WebSite",
        "@id": "https://scalewise.group/#website",
        "name": "ScaleWise",
        "alternateName": ["ScaleWise Group", "ScaleWise LLC"],
        "url": "https://scalewise.group/",
        "publisher": { "@id": "https://scalewise.group/#organization" }
      },
      {
        "@type": "Organization",
        "@id": "https://scalewise.group/#organization",
        "name": "ScaleWise",
        "legalName": "ScaleWise LLC",
        "url": "https://scalewise.group/",
        "logo": "https://scalewise.group/favicon.svg",
        "email": "info@scalewise.group",
        "telephone": "+1-307-285-0020",
        "address": {
          "@type": "PostalAddress",
          "streetAddress": "30 N Gould St Ste 61480",
          "addressLocality": "Sheridan",
          "addressRegion": "WY",
          "postalCode": "82801",
          "addressCountry": "US"
        },
        "description": "ScaleWise provides offshore accounting, bookkeeping, tax support, FP&A, reporting, and CFO advisory services for U.S. businesses and CPA firms.",
        "sameAs": ["https://www.linkedin.com/company/scalewiseusa"]
      },
      {
        "@type": "ProfessionalService",
        "@id": "https://scalewise.group/#professionalservice",
        "name": "ScaleWise",
        "url": "https://scalewise.group/",
        "description": "Offshore accounting, bookkeeping, tax support, FP&A, reporting, and CFO advisory services for U.S. businesses and CPA firms.",
        "areaServed": "United States",
        "serviceType": ["Offshore Accounting", "Bookkeeping", "Tax Support", "FP&A", "Reporting", "CFO Advisory"]
      }
    ]
  }
  </script>
'''
if 'https://scalewise.group/#website' not in html:
    html = html.replace(open_graph, open_graph + schema, 1)

# Add one clear branded SEO sentence near the top of the visible homepage while preserving the existing design.
old_intro = "ScaleWise helps CPA firms, founders, and growth-minded businesses strengthen accounting execution, elevate reporting discipline, and create decision-ready financial visibility."
new_intro = "ScaleWise is an offshore accounting, bookkeeping, tax support, FP&A, reporting, and CFO advisory firm helping U.S. businesses and CPA firms scale smarter with disciplined finance execution."
html = html.replace(old_intro, new_intro, 1)

INDEX.write_text(html, encoding="utf-8")
print("ScaleWise SEO metadata patched for Netlify build.")
