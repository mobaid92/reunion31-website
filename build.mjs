// ReUnion 31 site builder: turns /content (edited in /admin) into HTML pages in /dist.
// No dependencies. Run: node build.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(ROOT, "dist");
const read = (p, fallback = {}) => {
  try { return JSON.parse(fs.readFileSync(path.join(ROOT, p), "utf8")); }
  catch (e) { if (fs.existsSync(path.join(ROOT, p))) console.warn("Could not read", p, e.message); return fallback; }
};
const readDir = (dir) => {
  const d = path.join(ROOT, dir);
  if (!fs.existsSync(d)) return [];
  return fs.readdirSync(d).filter(f => f.endsWith(".json")).map(f => {
    const data = read(path.join(dir, f), null);
    return data ? { ...data, _slug: f.replace(/\.json$/, "") } : null;
  }).filter(Boolean);
};

const S = read("content/settings.json");
const HOME = read("content/home.json");
const ABOUT = read("content/about.json");
const ORDER = read("content/order.json");
const CATS = readDir("content/categories").sort((a, b) => (a.order ?? 99) - (b.order ?? 99) || a.name.localeCompare(b.name));
const LISTINGS = readDir("content/listings").filter(l => l.in_stock !== false)
  .sort((a, b) => (a.sort ?? 50) - (b.sort ?? 50) || String(a.title).localeCompare(String(b.title)));
const GALLERY = readDir("content/gallery").sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));

// ---------- helpers ----------
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const paras = (s) => String(s ?? "").split(/\n\s*\n/).map(p => p.trim()).filter(Boolean).map(p => `<p>${esc(p).replace(/\n/g, "<br>")}</p>`).join("");
const catBySlug = Object.fromEntries(CATS.map(c => [c._slug, c]));
const photosOf = (l) => (l.photos || []).map(p => typeof p === "string" ? p : p?.image).filter(Boolean);
const isVideoFile = (u) => /\.(mp4|webm|mov|m4v)(\?|$)/i.test(u || "");
const waDigits = String(S.whatsapp || "").replace(/\D/g, "");
const waLink = (text) => waDigits ? `https://wa.me/${waDigits}${text ? "?text=" + encodeURIComponent(text) : ""}` : "";
const mail = (subject) => `mailto:${S.email}?subject=${encodeURIComponent(subject || "Wholesale enquiry")}`;
const igHandle = String(S.instagram || "").replace(/^@/, "").replace(/^https?:\/\/(www\.)?instagram\.com\//, "").replace(/\/.*$/, "");

function embed(url) {
  if (!url) return "";
  let m = url.match(/(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([\w-]{6,})/);
  if (m) return `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/${m[1]}" title="Video" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture; fullscreen" allowfullscreen></iframe></div>`;
  m = url.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|reels|tv)\/([\w-]+)/);
  if (m) return `<div class="embed embed-ig"><iframe src="https://www.instagram.com/${m[1] === "reels" ? "reel" : m[1]}/${m[2]}/embed" title="Instagram post" loading="lazy" allowfullscreen></iframe></div>`;
  m = url.match(/tiktok\.com\/@[\w.]+\/video\/(\d+)/);
  if (m) return `<div class="embed embed-ig"><iframe src="https://www.tiktok.com/embed/v2/${m[1]}" title="TikTok video" loading="lazy" allowfullscreen></iframe></div>`;
  if (isVideoFile(url)) return videoTag(url);
  return `<a class="btn btn-line" href="${esc(url)}" target="_blank" rel="noopener">Watch the video</a>`;
}
const videoTag = (src, poster) => `<video class="vid" controls playsinline preload="metadata"${poster ? ` poster="${esc(poster)}"` : ""}><source src="${esc(src)}"></video>`;
const img = (src, alt, cls = "", eager = false) => src ? `<img${cls ? ` class="${cls}"` : ""} src="${esc(src)}" alt="${esc(alt)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} decoding="async">` : "";

// brands shown on the home page wall: from in-stock listings, excluding generic groups
const GENERIC = /^(mixed brands|accessories|y2k \/ unbranded|hawaiian shirts)$/i;
const BRANDS = [...new Set(LISTINGS.flatMap(l => String(l.title).split(/\s*\/\s*/)).map(b => b.trim()).filter(b => b && !GENERIC.test(b) && !/unbranded/i.test(b)))];
const brandCount = BRANDS.length;

// ---------- layout ----------
const NAV = [["index.html", "Home"], ["catalogue.html", "Catalogue"], ["gallery.html", "Photos & videos"], ["about.html", "About"], ["how-to-order.html", "How to order"], ["contact.html", "Contact"]];
function layout(file, title, desc, body, extraHead = "") {
  const full = file === "index.html" ? `${S.business_name} | ${S.tagline}` : `${title} | ${S.business_name}`;
  const canonical = S.site_url ? `<link rel="canonical" href="${esc(S.site_url.replace(/\/$/, "") + "/" + (file === "index.html" ? "" : file))}">` : "";
  const ogImg = HOME.hero_image && S.site_url ? `<meta property="og:image" content="${esc(S.site_url.replace(/\/$/, "") + HOME.hero_image)}">` : "";
  const wa = waLink("Hi ReUnion 31, I'd like a wholesale quote.");
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(full)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:title" content="${esc(full)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:type" content="website">
${ogImg}
${canonical}
<link rel="icon" href="/favicon.png">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@62..125,400..900&family=IBM+Plex+Mono:wght@400;600&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/assets/style.css">
${extraHead}
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="site-header">
  <div class="wrap bar">
    <a class="logo" href="/">${img("/images/logo.jpg", "", "logo-img", true)}<span>${esc(S.business_name)}</span></a>
    <nav class="main-nav" aria-label="Main">
      ${NAV.slice(1).map(([h, l]) => `<a href="/${h}"${h === file ? ' aria-current="page"' : ""}>${l}</a>`).join("")}
    </nav>
    <a class="btn btn-kraft btn-sm head-cta" href="/contact.html">Get a quote</a>
    <button class="menu-btn" type="button" aria-expanded="false" aria-controls="mobile-nav" aria-label="Open menu"><span></span><span></span></button>
  </div>
  <nav id="mobile-nav" class="mobile-nav" aria-label="Mobile" hidden>
    ${NAV.map(([h, l]) => `<a href="/${h}"${h === file ? ' aria-current="page"' : ""}>${l}</a>`).join("")}
  </nav>
</header>
<main id="main">
${body}
</main>
<footer class="site-footer">
  <div class="wrap foot">
    <div>
      <a class="logo" href="/">${img("/images/logo.jpg", "", "logo-img")}<span>${esc(S.business_name)}</span></a>
      <p>${esc(S.tagline)}</p>
    </div>
    <div class="foot-links">
      ${NAV.map(([h, l]) => `<a href="/${h}">${l}</a>`).join("")}
    </div>
    <div class="foot-links">
      <a href="${esc(mail())}">${esc(S.email)}</a>
      ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener">WhatsApp</a>` : ""}
      ${igHandle ? `<a href="https://www.instagram.com/${esc(igHandle)}" target="_blank" rel="noopener">@${esc(igHandle)}</a>` : ""}
      ${S.fleek_url ? `<a href="${esc(S.fleek_url)}" target="_blank" rel="noopener">Our Fleek store</a>` : ""}
    </div>
  </div>
  <div class="wrap foot-base"><span>${esc(S.business_name)}, ${esc(S.ships_from)}</span><span>${esc(S.footer_note)}</span></div>
</footer>
${wa ? `<a class="float-wa" href="${esc(wa)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp"><svg viewBox="0 0 32 32" aria-hidden="true"><path fill="currentColor" d="M16 3C8.8 3 3 8.8 3 16c0 2.3.6 4.5 1.7 6.4L3 29l6.8-1.8A13 13 0 1 0 16 3Zm0 23.6c-2 0-4-.5-5.7-1.6l-.4-.2-4 1 1.1-3.9-.3-.4A10.6 10.6 0 1 1 16 26.6Zm5.8-7.9c-.3-.2-1.9-.9-2.2-1s-.5-.2-.7.2-.8 1-1 1.2-.4.2-.7.1a8.7 8.7 0 0 1-4.3-3.8c-.3-.6.3-.5.9-1.7.1-.2 0-.4 0-.6l-1-2.4c-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.6.1-.9.4s-1.2 1.1-1.2 2.7 1.2 3.2 1.4 3.4 2.4 3.6 5.7 5c2.1.9 2.9 1 4 .8.6-.1 1.9-.8 2.2-1.5s.3-1.4.2-1.5-.3-.2-.6-.3Z"/></svg></a>` : ""}
<script src="/assets/site.js" defer></script>
</body>
</html>`;
}

const tag = (rows) => `<div class="tag"><dl>${rows.filter(r => r[1]).map(([k, v]) => `<div class="kv"><dt>${esc(k)}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></div>`;
const pageHead = (eyebrow, h1, lede) => `<section class="page-head"><div class="wrap"><p class="eyebrow">${esc(eyebrow)}</p><h1>${esc(h1)}</h1>${lede ? `<p class="lede">${esc(lede)}</p>` : ""}</div></section>`;
const ctaBand = () => `<section class="cta-band"><div class="wrap"><div class="cta-card">
  <div><h2>Tell us what your store needs.</h2><p class="lede">Send your wishlist and we will reply with stock photos and a quote.</p></div>
  <div class="cta-row"><a class="btn btn-kraft" href="/contact.html">Request a quote</a>${waLink() ? `<a class="btn btn-line" href="${esc(waLink("Hi ReUnion 31, I'd like a wholesale quote."))}" target="_blank" rel="noopener">WhatsApp us</a>` : `<a class="btn btn-line" href="${esc(mail())}">Email us</a>`}</div>
</div></div></section>`;

// listing card (catalogue + home)
function card(l, i) {
  const ph = photosOf(l);
  const hasVid = !!(l.video || l.video_url);
  const cat = catBySlug[l.category];
  const styles = l.styles || [];
  return `<article class="lot${ph.length ? " has-photo" : ""}" data-i="${i}" data-cat="${esc(l.category)}" data-brand="${esc(l.title)}" data-search="${esc([l.title, l.brand_note, cat?.name, ...styles, l.description].join(" ").toLowerCase())}">
  <button class="lot-open" type="button" aria-label="View ${esc(l.title)} ${esc(cat?.name || "")}">
    ${ph.length ? `<div class="lot-photo">${img(ph[0], `${l.title} ${cat?.name || ""} from ReUnion 31 stock`)}${ph.length > 1 || hasVid ? `<span class="badge">${ph.length > 1 ? `${ph.length} photos` : ""}${ph.length > 1 && hasVid ? " · " : ""}${hasVid ? "Video" : ""}</span>` : ""}</div>` : hasVid ? `<div class="lot-photo lot-novid"><span class="badge">Video</span></div>` : ""}
    <div class="lot-body">
      <p class="lot-cat">${esc(cat?.name || "")}</p>
      <h3>${esc(l.title)}</h3>
      ${l.brand_note ? `<p class="lot-note">${esc(l.brand_note)}</p>` : ""}
      ${styles.length ? `<ul class="styles">${styles.slice(0, 4).map(s => `<li>${esc(s)}</li>`).join("")}${styles.length > 4 ? `<li class="more">+${styles.length - 4} more styles</li>` : ""}</ul>` : ""}
    </div>
  </button>
</article>`;
}
const listingData = (list) => list.map(l => ({
  title: l.title, cat: catBySlug[l.category]?.name || "", note: l.brand_note || "", styles: l.styles || [],
  desc: l.description || "", photos: photosOf(l), video: l.video || "", embed: l.video_url ? embed(l.video_url) : ""
}));
const dataScript = (list) => `<script>window.LISTINGS=${JSON.stringify(listingData(list)).replace(/</g, "\\u003c")};window.QUOTE=${JSON.stringify({ wa: waDigits, email: S.email })};</script>`;
const dialog = `<dialog class="lot-dialog" aria-labelledby="dlg-title"><div class="dlg-inner">
  <button class="dlg-close" type="button" aria-label="Close">×</button>
  <div class="dlg-media"></div>
  <div class="dlg-body"><p class="lot-cat dlg-cat"></p><h2 id="dlg-title"></h2><p class="lot-note dlg-note"></p><div class="dlg-desc"></div><h3 class="dlg-sub">Styles in this listing</h3><ul class="styles dlg-styles"></ul>
  <div class="cta-row"><a class="btn btn-kraft dlg-quote" href="/contact.html">Request a quote</a><a class="btn btn-line dlg-wa" target="_blank" rel="noopener" hidden>WhatsApp</a></div></div>
</div></dialog>`;

// ---------- pages ----------
const pages = {};

// HOME
{
  const featured = LISTINGS.filter(l => l.featured && photosOf(l).length).slice(0, 6);
  const feat = featured.length ? featured : LISTINGS.filter(l => photosOf(l).length).slice(0, 6);
  const heroMedia = HOME.hero_video
    ? `<video class="hero-media" autoplay muted loop playsinline${HOME.hero_image ? ` poster="${esc(HOME.hero_image)}"` : ""}><source src="${esc(HOME.hero_video)}"></video>`
    : img(HOME.hero_image, "ReUnion 31 stock", "hero-media", true);
  const catTiles = CATS.map(c => {
    const n = LISTINGS.filter(l => l.category === c._slug).length;
    if (!n) return "";
    const cover = c.cover || LISTINGS.filter(l => l.category === c._slug).map(l => photosOf(l)[0]).find(Boolean);
    return `<a class="cat-tile${cover ? "" : " no-photo"}" href="/catalogue.html?cat=${esc(c._slug)}">${cover ? img(cover, c.name) : ""}<span class="cat-tile-label"><b>${esc(c.name)}</b><small>${n} brand${n === 1 ? "" : "s"}</small></span></a>`;
  }).join("");
  const latest = GALLERY.slice(0, 4);
  pages["index.html"] = layout("index.html", "Home", HOME.hero_text, `
<section class="hero"><div class="wrap hero-grid">
  <div>
    <p class="eyebrow">Wholesale · ${esc(S.ships_from)} → ${esc(S.ships_to)}</p>
    <h1>${esc(HOME.hero_heading)}</h1>
    <p class="lede">${esc(HOME.hero_text)}</p>
    <div class="cta-row"><a class="btn btn-kraft" href="/contact.html">Request a quote</a><a class="btn btn-line" href="/catalogue.html">Browse the catalogue</a></div>
  </div>
  <div class="hero-photo-wrap"><div class="photo hero-photo">${heroMedia}</div>
    ${tag([["Min. order", S.min_order], ["Dispatch", S.dispatch_time], ["Ships from", S.ships_from], ["Ships to", S.ships_to]])}
  </div>
</div></section>
${(HOME.stats || []).length ? `<section class="stats" aria-label="Our track record"><div class="wrap"><div class="stat-grid">${HOME.stats.map(s => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>${HOME.stats_note ? `<small>${esc(HOME.stats_note)}</small>` : ""}</div></section>` : ""}
<section class="band"><div class="wrap">
  <div class="sec-head"><h2>Shop by category</h2><a class="link" href="/catalogue.html">Full catalogue →</a></div>
  <div class="cat-tiles">${catTiles}</div>
</div></section>
${feat.length ? `<section><div class="wrap">
  <div class="sec-head"><h2>In stock now</h2><a class="link" href="/catalogue.html">See all ${LISTINGS.length} listings →</a></div>
  <div class="lots">${feat.map((l) => card(l, LISTINGS.indexOf(l))).join("")}</div>
</div></section>` : ""}
<section class="band"><div class="wrap">
  <h2>${brandCount}+ brands we carry</h2>
  <ul class="brand-wall">${BRANDS.map(b => `<li><a href="/catalogue.html?brand=${encodeURIComponent(b)}">${esc(b)}</a></li>`).join("")}</ul>
  ${(HOME.features || []).length ? `<div class="facts">${HOME.features.map(f => `<div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join("")}</div>` : ""}
</div></section>
${latest.length ? `<section><div class="wrap">
  <div class="sec-head"><h2>Fresh from the warehouse</h2><a class="link" href="/gallery.html">All photos & videos →</a></div>
  <div class="media-grid">${latest.map(mediaItem).join("")}</div>
</div></section>` : ""}
${ctaBand()}
${dialog}${dataScript(LISTINGS)}`);
}

function mediaItem(g) {
  let media;
  if (g.video) media = videoTag(g.video, g.image);
  else if (g.video_url) media = embed(g.video_url);
  else if (g.image) media = `<button class="zoom" type="button" data-src="${esc(g.image)}" aria-label="Enlarge photo: ${esc(g.title)}">${img(g.image, g.title)}</button>`;
  else media = "";
  const d = g.date ? new Date(g.date) : null;
  const ds = d && !isNaN(d) ? d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" }) : "";
  return `<figure class="media-item${g.video || g.video_url ? " is-video" : ""}">${media}<figcaption>${ds ? `<time>${esc(ds)}</time>` : ""}<b>${esc(g.title)}</b>${g.caption ? `<span>${esc(g.caption)}</span>` : ""}</figcaption></figure>`;
}

// CATALOGUE
{
  const usedCats = CATS.filter(c => LISTINGS.some(l => l.category === c._slug));
  const brands = [...new Set(LISTINGS.map(l => l.title))].sort((a, b) => a.localeCompare(b));
  const sections = usedCats.map(c => {
    const ls = LISTINGS.filter(l => l.category === c._slug);
    return `<section class="cat-sec" id="${esc(c._slug)}" data-cat="${esc(c._slug)}">
  <div class="cat-sec-head"><div><h2>${esc(c.name)}</h2>${c.description ? `<p>${esc(c.description)}</p>` : ""}</div><span class="count">${ls.length} brand${ls.length === 1 ? "" : "s"}</span></div>
  <div class="lots">${ls.map(l => card(l, LISTINGS.indexOf(l))).join("")}</div>
</section>`;
  }).join("");
  pages["catalogue.html"] = layout("catalogue.html", "Catalogue", `Wholesale catalogue: ${usedCats.length} categories and ${brands.length} brands of branded secondhand clothing. Minimum order ${S.min_order}.`, `
${pageHead("Catalogue", "What we have in stock", "Stock changes daily. Prices depend on brand mix, grade and quantity, so request a quote for current availability.")}
<div class="filters-wrap"><div class="wrap filters" role="search">
  <label class="search"><span class="sr">Search</span><input id="q" type="search" placeholder="Search brands, styles…" autocomplete="off"></label>
  <label class="select"><span class="sr">Brand</span><select id="brand"><option value="">All brands</option>${brands.map(b => `<option>${esc(b)}</option>`).join("")}</select></label>
  <label class="check"><input id="photos-only" type="checkbox"> With photos</label>
  <div class="chips" role="group" aria-label="Category"><button type="button" class="chip" data-cat="" aria-pressed="true">All</button>${usedCats.map(c => `<button type="button" class="chip" data-cat="${esc(c._slug)}" aria-pressed="false">${esc(c.name)}</button>`).join("")}</div>
</div></div>
<section class="catalogue"><div class="wrap">
  <p id="result-count" class="result-count" aria-live="polite"></p>
  ${sections}
  <p class="empty" hidden>Nothing matches. <button type="button" class="link reset">Clear filters</button></p>
</div></section>
${ctaBand()}
${dialog}${dataScript(LISTINGS)}`);
}

// GALLERY
pages["gallery.html"] = layout("gallery.html", "Photos & videos", "Photos and videos of real ReUnion 31 stock and bundles.", `
${pageHead("Photos & videos", "Straight from the warehouse", "Real photos and videos of the stock we sort and ship. Ask for a video of your own bundle before you pay.")}
<section class="tight"><div class="wrap">
  ${GALLERY.length ? `<div class="media-filter chips" role="group" aria-label="Show"><button type="button" class="chip" data-show="all" aria-pressed="true">All</button><button type="button" class="chip" data-show="photo" aria-pressed="false">Photos</button><button type="button" class="chip" data-show="video" aria-pressed="false">Videos</button></div>
  <div class="media-grid big">${GALLERY.map(mediaItem).join("")}</div>` : `<p class="empty">New photos and videos are coming soon.</p>`}
  ${igHandle ? `<p class="more-ig">More on Instagram: <a href="https://www.instagram.com/${esc(igHandle)}" target="_blank" rel="noopener">@${esc(igHandle)}</a></p>` : ""}
</div></section>
${ctaBand()}`);

// ABOUT
pages["about.html"] = layout("about.html", "About", ABOUT.intro, `
${pageHead("About us", ABOUT.heading, ABOUT.intro)}
<section class="tight"><div class="wrap about-grid">
  <div class="prose">${paras(ABOUT.body)}</div>
  ${ABOUT.image ? `<div class="hero-photo-wrap"><div class="photo about-photo">${img(ABOUT.image, "ReUnion 31 stock")}</div></div>` : ""}
</div></section>
${(HOME.stats || []).length ? `<section class="stats"><div class="wrap"><div class="stat-grid">${HOME.stats.map(s => `<div class="stat"><b>${esc(s.value)}</b><span>${esc(s.label)}</span></div>`).join("")}</div>${HOME.stats_note ? `<small>${esc(HOME.stats_note)}</small>` : ""}</div></section>` : ""}
${(ABOUT.values || []).length ? `<section class="band"><div class="wrap"><h2>What you can expect</h2><div class="facts">${ABOUT.values.map(f => `<div><h3>${esc(f.title)}</h3><p>${esc(f.text)}</p></div>`).join("")}</div></div></section>` : ""}
${ctaBand()}`);

// HOW TO ORDER
pages["how-to-order.html"] = layout("how-to-order.html", "How to order", ORDER.intro, `
${pageHead("How to order", ORDER.heading, ORDER.intro)}
<section class="tight"><div class="wrap">
  <ol class="steps">${(ORDER.steps || []).map(s => `<li><b>${esc(s.title)}</b><span>${esc(s.text)}</span></li>`).join("")}</ol>
  <div class="tag-row">${tag([["Min. order", S.min_order], ["Dispatch", S.dispatch_time], ["Ships from", S.ships_from], ["Ships to", S.ships_to]])}</div>
</div></section>
${(ORDER.faqs || []).length ? `<section class="band"><div class="wrap faq-wrap"><h2>Questions buyers ask</h2><div class="faq">${ORDER.faqs.map(f => `<details><summary>${esc(f.question)}</summary><div>${paras(f.answer)}</div></details>`).join("")}</div></div></section>` : ""}
${ctaBand()}`);

// CONTACT
{
  const next = S.site_url ? `<input type="hidden" name="_next" value="${esc(S.site_url.replace(/\/$/, ""))}/thanks.html">` : "";
  const wa = waLink("Hi ReUnion 31, I'd like a wholesale quote.");
  pages["contact.html"] = layout("contact.html", "Contact", `Request a wholesale quote from ${S.business_name}. Minimum order ${S.min_order}.`, `
${pageHead("Contact", "Request a quote", "Tell us what your store needs. We reply with stock photos and a price, usually within a day.")}
<section class="tight"><div class="wrap contact-grid">
  <form class="quote-form" action="https://formsubmit.co/${esc(S.email)}" method="POST">
    <input type="hidden" name="_subject" value="New wholesale enquiry from the website">
    <input type="hidden" name="_template" value="table">
    <input type="text" name="_honey" class="hp" tabindex="-1" autocomplete="off" aria-hidden="true">
    ${next}
    <div class="row2">
      <label>Your name<input name="name" required autocomplete="name"></label>
      <label>Store or business name<input name="store" autocomplete="organization"></label>
    </div>
    <div class="row2">
      <label>Email<input type="email" name="email" required autocomplete="email"></label>
      <label>WhatsApp (optional)<input type="tel" name="whatsapp" autocomplete="tel" placeholder="+1 555 000 0000"></label>
    </div>
    <div class="row2">
      <label>Country<input name="country" required autocomplete="country-name"></label>
      <label>Roughly how many pieces?<select name="quantity"><option>10–25</option><option>25–50</option><option>50–100</option><option>100–250</option><option>250+</option></select></label>
    </div>
    <fieldset><legend>Categories you're interested in</legend><div class="checks">${CATS.filter(c => LISTINGS.some(l => l.category === c._slug)).map(c => `<label class="check"><input type="checkbox" name="categories" value="${esc(c.name)}"> ${esc(c.name)}</label>`).join("")}</div></fieldset>
    <label>Brands, sizes or anything else<textarea name="message" rows="5" placeholder="e.g. 30 pcs Ralph Lauren quarter zips, mostly M–XL"></textarea></label>
    <button class="btn btn-kraft" type="submit">Send enquiry</button>
    <p class="form-note">Prefer email? Write to <a href="${esc(mail())}">${esc(S.email)}</a>.</p>
  </form>
  <div class="contact-side">
    ${tag([["Min. order", S.min_order], ["Dispatch", S.dispatch_time], ["Ships to", S.ships_to]])}
    <div class="contact-list">
      <a href="${esc(mail())}"><span>${esc(S.email)}</span><small>Email</small></a>
      ${wa ? `<a href="${esc(wa)}" target="_blank" rel="noopener"><span>+${esc(waDigits)}</span><small>WhatsApp</small></a>` : ""}
      ${igHandle ? `<a href="https://www.instagram.com/${esc(igHandle)}" target="_blank" rel="noopener"><span>@${esc(igHandle)}</span><small>Instagram</small></a>` : ""}
      ${S.fleek_url ? `<a href="${esc(S.fleek_url)}" target="_blank" rel="noopener"><span>ReUnion 31 on Fleek</span><small>Store</small></a>` : ""}
    </div>
  </div>
</div></section>`);
}

pages["thanks.html"] = layout("thanks.html", "Thank you", "Enquiry received.", `
${pageHead("Enquiry sent", "Thanks, we've got it.", "We'll reply with photos and a quote, usually within a day.")}
<section class="tight"><div class="wrap"><div class="cta-row"><a class="btn btn-kraft" href="/catalogue.html">Back to the catalogue</a><a class="btn btn-line" href="/">Home</a></div></div></section>`);

pages["404.html"] = layout("404.html", "Page not found", "Page not found.", `
${pageHead("404", "That page isn't here.", "It may have moved. Try the catalogue instead.")}
<section class="tight"><div class="wrap"><div class="cta-row"><a class="btn btn-kraft" href="/catalogue.html">Catalogue</a><a class="btn btn-line" href="/">Home</a></div></div></section>`);

// ---------- write ----------
fs.rmSync(OUT, { recursive: true, force: true });
fs.cpSync(path.join(ROOT, "public"), OUT, { recursive: true });
for (const [f, html] of Object.entries(pages)) fs.writeFileSync(path.join(OUT, f), html);
if (S.site_url) {
  const base = S.site_url.replace(/\/$/, "");
  fs.writeFileSync(path.join(OUT, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${Object.keys(pages).filter(f => !/^(404|thanks)/.test(f)).map(f => `<url><loc>${base}/${f === "index.html" ? "" : f}</loc></url>`).join("")}</urlset>\n`);
  fs.writeFileSync(path.join(OUT, "robots.txt"), `User-agent: *\nDisallow: /admin/\nSitemap: ${base}/sitemap.xml\n`);
}
console.log(`Built ${Object.keys(pages).length} pages: ${CATS.length} categories, ${LISTINGS.length} listings, ${GALLERY.length} media posts.`);
