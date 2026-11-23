// One-time import of photos and videos from the ReUnion 31 Fleek store into the website.
// Runs on GitHub Actions (see .github/workflows/import-fleek.yml), which has internet access and ffmpeg.
// Reads fleek-import/products.json (Fleek product id -> website listing), downloads each product's
// photos and video, compresses them, saves them in public/images/uploads/fleek/, and adds them to
// content/listings/<listing>.json. Already-imported products are skipped, so it is safe to re-run.
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const MAX_PHOTOS = +(process.env.MAX_PHOTOS || 12);   // photos per website listing (including existing ones)
const MAX_VIDEOS = +(process.env.MAX_VIDEOS || 2);    // videos per website listing
const PHOTOS_PER_PRODUCT = +(process.env.PHOTOS_PER_PRODUCT || 2);
const VIDEO_SECONDS = +(process.env.VIDEO_SECONDS || 45);
const OUT_DIR = path.join(ROOT, "public/images/uploads/fleek");
const PUBLIC = "/images/uploads/fleek";
const DONE_FILE = path.join(ROOT, "fleek-import/imported.json");
const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0 Safari/537.36";

const products = JSON.parse(fs.readFileSync(path.join(ROOT, "fleek-import/products.json"), "utf8"));
const done = fs.existsSync(DONE_FILE) ? JSON.parse(fs.readFileSync(DONE_FILE, "utf8")) : {};
fs.mkdirSync(OUT_DIR, { recursive: true });

const sleep = (ms) => new Promise(r => setTimeout(r, ms));
const titleCase = (s) => s.replace(/\.\.$/, "").replace(/\s*\([^)]*\)\s*$/, "").trim();
const CAT_NAMES = Object.fromEntries(fs.readdirSync(path.join(ROOT, "content/categories")).map(f => [f.replace(/\.json$/, ""), JSON.parse(fs.readFileSync(path.join(ROOT, "content/categories", f), "utf8")).name]));

async function fetchText(url) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-US,en" } });
      if (r.ok) return await r.text();
      console.warn("  HTTP", r.status, url);
    } catch (e) { console.warn("  fetch failed", e.message); }
    await sleep(1500 * (i + 1));
  }
  return null;
}
async function download(url, file) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch(url, { headers: { "user-agent": UA } });
      if (r.ok) { fs.writeFileSync(file, Buffer.from(await r.arrayBuffer())); return true; }
    } catch (e) { /* retry */ }
    await sleep(1000 * (i + 1));
  }
  return false;
}
function ff(args) {
  execFileSync("ffmpeg", ["-hide_banner", "-loglevel", "error", "-y", ...args], { stdio: "inherit", timeout: 240000 });
}

// Product page -> { images: [...], video: "...m3u8" | null }
async function productMedia(p) {
  const html = await fetchText(`https://www.joinfleek.com/products/${p.id}`);
  const out = { images: [], video: null, body: "" };
  if (html) {
    const m = html.match(/<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/);
    if (m) {
      try {
        const info = JSON.parse(m[1])?.props?.pageProps?.productInfo || {};
        out.images = (info.images || []).map(i => i.url).filter(Boolean);
        const assets = info.metafields?.assets || [];
        out.video = assets.map(a => a.url).find(u => /\.m3u8|\.mp4/i.test(u || "")) || null;
        out.body = String(info.body || "");
      } catch (e) { console.warn("  could not parse product data", e.message); }
    }
    if (!out.video) { const v = html.match(/https:\/\/[^"'\s\\]+?\.m3u8/); if (v) out.video = v[0]; }
  }
  if (!out.images.length && p.thumb) out.images = [p.thumb];
  return out;
}

const listingFile = (slug) => path.join(ROOT, "content/listings", `${slug}.json`);
function loadListing(p) {
  const f = listingFile(p.listing);
  if (fs.existsSync(f)) return JSON.parse(fs.readFileSync(f, "utf8"));
  console.log(`  + new listing ${p.listing}`);
  return { title: p.brand, category: p.category, brand_note: "", styles: [], description: "", photos: [], videos: [], video: "", video_url: "", featured: false, in_stock: true, sort: 60 };
}

let photosAdded = 0, videosAdded = 0, pagesRead = 0;
const byListing = {};
for (const p of products) (byListing[p.listing] ||= []).push(p);

for (const [slug, list] of Object.entries(byListing)) {
  const L = loadListing(list[0]);
  L.photos = (L.photos || []).map(x => typeof x === "string" ? x : x?.image).filter(Boolean);
  L.videos = (L.videos || []).filter(Boolean);
  if (L.video && !L.videos.includes(L.video)) { L.videos.unshift(L.video); }
  L.video = "";
  L.styles = L.styles || [];
  console.log(`\n${slug}: ${list.length} Fleek products (has ${L.photos.length} photos, ${L.videos.length} videos)`);
  let changed = false;

  for (const p of list) {
    const style = titleCase(p.title);
    if (style && !L.styles.some(s => s.toLowerCase() === style.toLowerCase())) { L.styles.push(style); changed = true; }
    if (done[p.id]) continue;
    const needPhotos = L.photos.length < MAX_PHOTOS, needVideo = L.videos.length < MAX_VIDEOS;
    if (!needPhotos && !needVideo) { done[p.id] = "skipped (listing full)"; continue; }

    const media = await productMedia(p); pagesRead++;
    await sleep(400);

    if (needPhotos) {
      for (const [k, url] of media.images.slice(0, PHOTOS_PER_PRODUCT).entries()) {
        if (L.photos.length >= MAX_PHOTOS) break;
        const raw = path.join(OUT_DIR, `${p.id}-${k + 1}.src`);
        const name = `${p.id}-${k + 1}.jpg`;
        if (!(await download(url, raw))) { console.warn("  photo download failed", url); continue; }
        try {
          ff(["-i", raw, "-vf", "scale='min(1600,iw)':-2", "-q:v", "4", path.join(OUT_DIR, name)]);
          L.photos.push(`${PUBLIC}/${name}`); photosAdded++; changed = true;
        } catch (e) { console.warn("  photo convert failed", e.message); }
        fs.rmSync(raw, { force: true });
      }
    }
    if (needVideo && media.video) {
      const name = `${p.id}.mp4`;
      try {
        ff([...(/^https?:/.test(media.video) ? ["-user_agent", UA] : []), "-i", media.video, "-t", String(VIDEO_SECONDS),
            "-vf", "scale=-2:'min(720,ih)'", "-c:v", "libx264", "-preset", "veryfast", "-crf", "28",
            "-c:a", "aac", "-b:a", "96k", "-movflags", "+faststart", path.join(OUT_DIR, name)]);
        const size = fs.statSync(path.join(OUT_DIR, name)).size;
        if (size > 20 * 1024 * 1024) { fs.rmSync(path.join(OUT_DIR, name)); console.warn("  video too large, skipped"); }
        else { L.videos.push(`${PUBLIC}/${name}`); videosAdded++; changed = true; console.log(`  video ${name} ${(size / 1e6).toFixed(1)} MB`); }
      } catch (e) { console.warn("  video convert failed", e.message); }
    }
    done[p.id] = `${p.listing}`;
  }

  if (changed || !fs.existsSync(listingFile(slug))) {
    if (!L.description && CAT_NAMES[L.category]) L.description = "";
    fs.writeFileSync(listingFile(slug), JSON.stringify(L, null, 2) + "\n");
  }
  fs.writeFileSync(DONE_FILE, JSON.stringify(done, null, 1) + "\n");
}

console.log(`\nDone: read ${pagesRead} product pages, added ${photosAdded} photos and ${videosAdded} videos.`);
fs.writeFileSync(path.join(ROOT, "fleek-import/last-run.txt"), `${new Date().toISOString()}\nproduct pages read: ${pagesRead}\nphotos added: ${photosAdded}\nvideos added: ${videosAdded}\n`);
