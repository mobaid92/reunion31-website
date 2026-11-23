(() => {
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // mobile menu
  const btn = $(".menu-btn"), nav = $("#mobile-nav");
  if (btn && nav) btn.addEventListener("click", () => {
    const open = btn.getAttribute("aria-expanded") === "true";
    btn.setAttribute("aria-expanded", String(!open));
    btn.setAttribute("aria-label", open ? "Open menu" : "Close menu");
    nav.hidden = open;
  });

  // listing dialog
  const dlg = $(".lot-dialog");
  if (dlg && window.LISTINGS) {
    const Q = window.QUOTE || {};
    const open = (i) => {
      const l = window.LISTINGS[i]; if (!l) return;
      $(".dlg-cat", dlg).textContent = l.cat;
      $("#dlg-title", dlg).textContent = l.title;
      $(".dlg-note", dlg).textContent = l.note;
      $(".dlg-desc", dlg).innerHTML = l.desc ? l.desc.split(/\n\s*\n/).map(p => `<p>${esc(p)}</p>`).join("") : "";
      $(".dlg-styles", dlg).innerHTML = l.styles.map(s => `<li>${esc(s)}</li>`).join("");
      $(".dlg-sub", dlg).hidden = !l.styles.length;
      const media = l.photos.map((p, k) => `<img src="${esc(p)}" alt="${esc(l.title)} photo ${k + 1}" loading="lazy">`);
      const vids = (l.videos || []).map(v => `<video controls playsinline preload="metadata"><source src="${esc(v)}" type="video/mp4"></video>`);
      media.splice(Math.min(1, media.length), 0, ...vids);
      if (l.embed) media.push(l.embed);
      $(".dlg-media", dlg).innerHTML = media.join("");
      const msg = `Hi ReUnion 31, I'd like a quote for ${l.title} – ${l.cat}.`;
      $(".dlg-quote", dlg).href = `/contact.html?listing=${encodeURIComponent(l.title + " – " + l.cat)}`;
      const wa = $(".dlg-wa", dlg);
      if (Q.wa) { wa.hidden = false; wa.textContent = "WhatsApp for a quote"; wa.href = `https://wa.me/${Q.wa}?text=${encodeURIComponent(msg)}`; }
      dlg.showModal();
      $(".dlg-close", dlg).focus();
    };
    document.addEventListener("click", (e) => {
      const b = e.target.closest(".lot-open");
      if (b) open(+b.closest(".lot").dataset.i);
    });
    $(".dlg-close", dlg).addEventListener("click", () => dlg.close());
    dlg.addEventListener("click", (e) => { if (e.target === dlg) dlg.close(); });
    dlg.addEventListener("close", () => { $$("video", dlg).forEach(v => v.pause()); $(".dlg-media", dlg).innerHTML = ""; });
  }

  // catalogue filters
  const q = $("#q");
  if (q) {
    const brand = $("#brand"), photosOnly = $("#photos-only"), chips = $$(".filters .chip");
    const lots = $$(".catalogue .lot"), secs = $$(".cat-sec"), count = $("#result-count"), empty = $(".catalogue .empty");
    const params = new URLSearchParams(location.search);
    let cat = params.get("cat") || "";
    if (params.get("brand")) {
      const want = params.get("brand").toLowerCase();
      const opt = [...brand.options].find(o => o.value.toLowerCase() === want) || [...brand.options].find(o => o.value.toLowerCase().split(/\s*\/\s*/).includes(want));
      if (opt) brand.value = opt.value; else q.value = params.get("brand");
    }
    if (params.get("q")) q.value = params.get("q");
    const apply = (push) => {
      const term = q.value.trim().toLowerCase(), b = brand.value, po = photosOnly.checked;
      let n = 0;
      lots.forEach(el => {
        const ok = (!cat || el.dataset.cat === cat) && (!b || el.dataset.brand === b) && (!po || el.classList.contains("has-photo")) && (!term || el.dataset.search.includes(term));
        el.hidden = !ok; if (ok) n++;
      });
      secs.forEach(s => s.hidden = !$$(".lot:not([hidden])", s).length);
      chips.forEach(c => c.setAttribute("aria-pressed", String(c.dataset.cat === cat)));
      const total = lots.length;
      count.textContent = n === total ? `${total} listings in ${secs.length} categories` : `${n} of ${total} listings`;
      empty.hidden = n > 0;
      if (push) {
        const p = new URLSearchParams();
        if (cat) p.set("cat", cat); if (b) p.set("brand", b); if (term) p.set("q", term);
        history.replaceState(null, "", location.pathname + (p.toString() ? "?" + p : ""));
      }
    };
    chips.forEach(c => c.addEventListener("click", () => { cat = c.dataset.cat; apply(true); c.scrollIntoView({ block: "nearest", inline: "nearest" }); }));
    q.addEventListener("input", () => apply(true));
    brand.addEventListener("change", () => apply(true));
    photosOnly.addEventListener("change", () => apply(true));
    $(".reset")?.addEventListener("click", () => { cat = ""; q.value = ""; brand.value = ""; photosOnly.checked = false; apply(true); });
    apply(false);
  }

  // gallery filter
  const mf = $$(".media-filter .chip");
  if (mf.length) mf.forEach(c => c.addEventListener("click", () => {
    const show = c.dataset.show;
    mf.forEach(x => x.setAttribute("aria-pressed", String(x === c)));
    $$(".media-grid .media-item").forEach(m => {
      const v = m.classList.contains("is-video");
      m.hidden = show === "photo" ? v : show === "video" ? !v : false;
    });
  }));

  // photo lightbox
  let lb;
  document.addEventListener("click", (e) => {
    const z = e.target.closest(".zoom"); if (!z) return;
    if (!lb) {
      lb = document.createElement("dialog"); lb.className = "lightbox";
      lb.innerHTML = `<img alt="">`; document.body.appendChild(lb);
      lb.addEventListener("click", () => lb.close());
    }
    const im = lb.querySelector("img"); im.src = z.dataset.src; im.alt = z.getAttribute("aria-label") || "";
    lb.showModal();
  });

  // contact: prefill from a listing
  const form = $(".quote-form");
  if (form) {
    const l = new URLSearchParams(location.search).get("listing");
    if (l) { const m = form.querySelector("textarea[name=message]"); if (m && !m.value) m.value = `I'm interested in: ${l}\n\nQuantity / sizes: `; }
  }
})();
