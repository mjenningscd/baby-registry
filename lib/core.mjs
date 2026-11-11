// Baby Jennings Registry API — shared by Cloudflare Pages Functions (KV) and Netlify.
import TRACKMAP from "./trackmap.mjs";

let STORE = null, ENV = {};
export function init(store, env) { STORE = store; ENV = env || {}; }
const store = () => STORE;
const json = (data, status = 200) =>
  new Response(JSON.stringify(data), { status, headers: { "content-type": "application/json", "cache-control": "no-store" } });

let catalogCache = null;
async function catalog(req) {
  if (catalogCache) return catalogCache;
  const r = await fetch(new URL("/catalog.json", req.url));
  catalogCache = await r.json();
  return catalogCache;
}

async function getConfig() {
  return (await store().get("config", { type: "json" })) || { items: [], removed: [], wanted: {}, images: {}, overrides: {}, live: {} };
}
const saveConfig = (c) => store().setJSON("config", c);

async function getPurchases() {
  const s = store();
  const { blobs } = await s.list({ prefix: "p/" });
  const out = await Promise.all(blobs.map(async (b) => Object.assign({ id: b.key.slice(2) }, await s.get(b.key, { type: "json" }))));
  return out.filter((p) => p && p.itemId);
}

function isAdmin(req) {
  const key = req.headers.get("x-admin-key");
  return !!ENV.ADMIN_PASSWORD && key === ENV.ADMIN_PASSWORD;
}

const UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_0) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36";

// Read name, price and photo from a product page (Open Graph, product meta tags and JSON-LD).
async function readProduct(url) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 8000);
  try {
    const r = await fetch(url, { headers: { "user-agent": UA, "accept-language": "en-AU,en;q=0.9" }, signal: ctrl.signal, redirect: "follow" });
    const html = (await r.text()).slice(0, 600000);
    const meta = (p) => {
      const m = html.match(new RegExp(`<meta[^>]+(?:property|name)=["']${p}["'][^>]*content=["']([^"']+)["']`, "i")) ||
                html.match(new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]*(?:property|name)=["']${p}["']`, "i"));
      return m ? decode(m[1]) : null;
    };
    let name = meta("og:title") || (html.match(/<title[^>]*>([^<]+)</i) || [])[1];
    let image = meta("og:image:secure_url") || meta("og:image") || meta("twitter:image");
    let price = meta("product:price:amount") || meta("og:price:amount");
    const site = meta("og:site_name");
    if (!price || !image) {
      for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
        try {
          const found = findProduct(JSON.parse(m[1].trim()));
          if (found) {
            if (!image && found.image) image = Array.isArray(found.image) ? (found.image[0].url || found.image[0]) : (found.image.url || found.image);
            const off = Array.isArray(found.offers) ? found.offers[0] : found.offers;
            if (!price && off) price = off.price || off.lowPrice || (off.priceSpecification && off.priceSpecification.price);
            if (!name && found.name) name = found.name;
          }
        } catch (_) {}
      }
    }
    // Fallbacks for stores that don't use standard tags (Amazon, Big W, Baby Bunting and others).
    const pick = (re) => { const m = html.match(re); return m ? decode(m[1]) : null; };
    if (!name) name = pick(/id=["']productTitle["'][^>]*>\s*([^<]+)</i) || pick(/<h1[^>]*>\s*([^<]{4,160})</i);
    if (!image) image = pick(/data-old-hires=["']([^"']+)["']/i) || pick(/id=["']landingImage["'][^>]*src=["']([^"']+)["']/i) || pick(/"hiRes"\s*:\s*"([^"]+)"/);
    if (!price) price = pick(/itemprop=["']price["'][^>]*content=["']([0-9.,]+)["']/i) || pick(/content=["']([0-9.,]+)["'][^>]*itemprop=["']price["']/i) ||
      pick(/class=["']a-offscreen["'][^>]*>\s*\$\s*([0-9.,]+)/i) || pick(/"priceAmount"\s*:\s*([0-9.]+)/) ||
      pick(/"(?:sellPrice|salePrice|currentPrice|finalPrice|priceValue|nowPrice|sellingPrice)"\s*:\s*\{?[^0-9{}]{0,40}?([0-9]+(?:\.[0-9]{1,2})?)/) ||
      pick(/"price"\s*:\s*\{[^}]{0,80}?"(?:value|amount|centAmount)"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)/) ||
      pick(/"price"\s*:\s*"?([0-9]+(?:\.[0-9]{1,2})?)"?\s*[,}]/);
    // Shopify stores: ask for the product's own data file.
    if ((!price || !image) && /\/products\//.test(url)) {
      try {
        const j = await (await fetch(url.split(/[?#]/)[0].replace(/\/$/, "") + ".js", { headers: { "user-agent": UA }, signal: ctrl.signal })).json();
        if (!name && j.title) name = j.title;
        if (!price && j.price != null) price = j.price / 100;
        if (!image && j.featured_image) image = j.featured_image;
      } catch (_) {}
    }
    if (image && image.startsWith("//")) image = "https:" + image;
    if (image && image.startsWith("/")) image = new URL(image, url).href;
    const p = price != null ? parseFloat(String(price).replace(/[^0-9.]/g, "")) : NaN;
    return { name: name ? decode(name).trim().replace(/\s*[|–-]\s*[^|–-]{2,40}$/, "") : null, image: image || null, price: isNaN(p) ? null : p, store: site ? decode(site).trim().slice(0, 60) : storeFromHost(url) };
  } catch (_) {
    return { name: null, image: null, price: null };
  } finally { clearTimeout(t); }
}
const STORES = { "babybunting": "Baby Bunting", "bigw": "Big W", "amazon": "Amazon AU", "kmart": "Kmart", "target": "Target", "chemistwarehouse": "Chemist Warehouse", "jbhifi": "JB Hi-Fi", "myer": "Myer", "davidjones": "David Jones", "adairs": "Adairs", "babykingdom": "Baby Kingdom", "babyvillage": "Baby Village", "bubsngrubs": "Bubs n Grubs", "bananababy": "Banana Baby", "kiddiecountry": "Kiddie Country", "harveynorman": "Harvey Norman", "officeworks": "Officeworks", "priceline": "Priceline" };
function storeFromHost(url) {
  try { const h = new URL(url).hostname.replace(/^www\./, ""); const k = Object.keys(STORES).find((x) => h.includes(x)); if (k) return STORES[k];
    const base = h.split(".")[0]; return base.charAt(0).toUpperCase() + base.slice(1); } catch (_) { return null; }
}
function findProduct(node) {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) { for (const n of node) { const f = findProduct(n); if (f) return f; } return null; }
  const type = node["@type"]; if (type === "Product" || (Array.isArray(type) && type.includes("Product"))) return node;
  if (node["@graph"]) return findProduct(node["@graph"]);
  return null;
}
function decode(s) { return String(s).replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">"); }

const hostOf = (u) => { try { return new URL(u).hostname.replace(/^www\./, ""); } catch (_) { return ""; } };
const clean = (s, n) => String(s || "").trim().slice(0, n);

export async function handle(req) {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = req.method;

  try {
    // ---------- Public ----------
    if (path === "state" && method === "GET") {
      const [cfg, purchases] = await Promise.all([getConfig(), getPurchases()]);
      const admin = isAdmin(req);
      const items = cfg.items.filter((i) => admin || (i.name && i.price != null));
      { const cat0 = await catalog(req); const ov = cfg.overrides || {};
        for (const id of Object.keys(ov)) { const b0 = cat0.find((i) => i.id === id); if (!b0) continue; const o = ov[id];
          for (const k of ["name", "store", "cat", "url"]) if (o[k] === b0[k]) delete o[k];
          if (o.price != null && Number(o.price) === Number(b0.price)) delete o.price;
          if (!Object.keys(o).length) delete ov[id]; } }
      const ps = purchases.map((p) => admin ? p : { id: p.id, itemId: p.itemId, qty: p.qty, name: p.surprise ? null : p.name, message: p.surprise ? null : p.message, surprise: !!p.surprise, at: p.at });
      const images = Object.assign({}, cfg.images || {}); images.v = cfg.imgV || 0;
      return json({ items, removed: cfg.removed, wanted: cfg.wanted, images, purchases: ps, overrides: cfg.overrides || {}, live: cfg.live || {}, liveAt: cfg.liveAt || null, picks: cfg.picks || null, admin, ownerReady: !!ENV.ADMIN_PASSWORD });
    }

    if (path === "purchase" && method === "POST") {
      const b = await req.json();
      const qty = Math.max(1, Math.min(20, parseInt(b.qty, 10) || 1));
      const name = clean(b.name, 60);
      if (!name) return json({ error: "Please add your name." }, 400);
      const [cat, cfg, purchases] = await Promise.all([catalog(req), getConfig(), getPurchases()]);
      const item = cat.find((i) => i.id === b.itemId) || cfg.items.find((i) => i.id === b.itemId);
      if (!item || cfg.removed.includes(item.id)) return json({ error: "That item isn't on the registry any more." }, 404);
      const want = cfg.wanted[item.id] != null ? cfg.wanted[item.id] : item.qty;
      const got = purchases.filter((p) => p.itemId === item.id).reduce((a, p) => a + p.qty, 0);
      if (got + qty > want) return json({ error: "Someone has just bought this. The list has been updated.", left: Math.max(0, want - got) }, 409);
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
      await store().setJSON("p/" + id, { itemId: item.id, qty, name, message: clean(b.message, 280), surprise: !!b.surprise, at: new Date().toISOString() });
      return json({ ok: true, id });
    }

    if (path.startsWith("up/") && method === "GET") {
      const key = "up/" + decodeURIComponent(path.slice(3)).replace(/[^a-z0-9_-]/gi, "");
      const r = await store().getWithMetadata(key, { type: "arrayBuffer" });
      if (!r || !r.data) return new Response(null, { status: 404 });
      return new Response(r.data, { headers: { "content-type": (r.metadata && r.metadata.type) || "image/jpeg", "cache-control": "public, max-age=31536000, immutable" } });
    }

    // Product photo for catalogue items: looked up once from the store page, then cached.
    if (path.startsWith("img/") && method === "GET") {
      const id = decodeURIComponent(path.slice(4));
      const s = store();
      let cached = await s.get("img/" + id, { type: "json" });
      if (cached && !cached.image && Date.now() - (cached.at || 0) > 86400000) cached = null;
      if (!cached) {
        const cat = await catalog(req);
        const item = cat.find((i) => i.id === id);
        if (!item || !item.url) return new Response(null, { status: 404 });
        const info = await readProduct(item.url);
        cached = { image: info.image || null, at: Date.now() };
        await s.setJSON("img/" + id, cached);
      }
      if (!cached.image) return new Response(null, { status: 404, headers: { "cache-control": "public, max-age=3600" } });
      return new Response(null, { status: 302, headers: { location: cached.image, "cache-control": "public, max-age=86400" } });
    }

    // ---------- Daily price sync (key can only update prices) ----------
    if (path === "sync" && method === "POST") {
      const key = req.headers.get("x-sync-key");
      if (!ENV.SYNC_KEY || key !== ENV.SYNC_KEY) return json({ error: "Wrong sync key." }, 401);
      const b = await req.json();
      const cfg = await getConfig();
      const cat = await catalog(req);
      const live = {};
      let n = 0;
      for (const [rawId, v] of Object.entries(b.prices || {})) {
        const id = TRACKMAP[rawId] || (cat.find((i) => i.id === rawId) ? rawId : null) || (rawId.startsWith("b-") ? rawId.slice(2) : null);
        if (!id || live[id] || !v || typeof v.price !== "number" || !(v.price > 0)) continue;
        const e = { price: Math.round(v.price * 100) / 100 };
        if (typeof v.was === "number" && v.was > e.price * 1.03) e.was = Math.round(v.was * 100) / 100;
        if (v.store) e.store = clean(v.store, 60);
        if (v.url && /^https?:\/\//i.test(v.url)) e.url = clean(v.url, 1000);
        live[id] = e; n++;
      }
      cfg.live = live; cfg.liveAt = new Date().toISOString();
      // keep added items' prices fresh too
      for (const it of cfg.items) if (live[it.id] && !it.manualPrice) { it.price = live[it.id].price; }
      await saveConfig(cfg);
      return json({ ok: true, updated: n });
    }

    // ---------- Admin (Matt & Grace) ----------
    if (path.startsWith("admin/")) {
      if (!isAdmin(req)) return json({ error: "Wrong password." }, 401);
      const action = path.slice(6);
      if (action === "check") return json({ ok: true });

      if (action === "upload" && method === "POST") {
        const { data } = await req.json();
        const m = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(data || "");
        if (!m) return json({ error: "That doesn't look like a photo. Try a JPG or PNG." }, 400);
        const bin = atob(m[2]); const buf = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
        if (buf.length > 3 * 1024 * 1024) return json({ error: "That photo is too large. Try a smaller one." }, 400);
        const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
        await store().set("up/" + id, buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length), { metadata: { type: m[1] } });
        return json({ ok: true, url: "/api/up/" + id });
      }
      if (action === "lookup" && method === "POST") {
        const { url: link } = await req.json();
        return json(await readProduct(link));
      }

      const cfg = await getConfig();
      const b = method === "POST" ? await req.json() : {};

      if (action === "add") {
        const link = clean(b.url, 1000);
        if (!/^https?:\/\//i.test(link)) return json({ error: "Please paste a full link starting with https://" }, 400);
        let info = { name: b.name || null, price: b.price != null && b.price !== "" ? Number(b.price) : null, image: b.image || null };
        if (!info.name || info.price == null || !info.image) {
          const read = await readProduct(link);
          info = { name: info.name || read.name, price: info.price != null ? info.price : read.price, image: info.image || read.image };
        }
        const item = {
          id: "c-" + Date.now().toString(36), name: clean(info.name, 140) || null, price: info.price, image: info.image,
          url: link, store: clean(b.store, 60) || hostOf(link), qty: Math.max(1, parseInt(b.qty, 10) || 1),
          cat: clean(b.cat, 40) || "General", order: 100000 + cfg.items.length, addedAt: new Date().toISOString(),
        };
        cfg.items.push(item);
        await saveConfig(cfg);
        return json({ ok: true, item });
      }
      if (action === "edit") {
        const it0 = cfg.items.find((i) => i.id === b.id);
        if (!it0) {
          // catalogue item: store the changes as an override
          const cat = await catalog(req);
          if (!cat.find((i) => i.id === b.id)) return json({ error: "Not found" }, 404);
          cfg.overrides = cfg.overrides || {};
          const o = cfg.overrides[b.id] || {};
          const base = cat.find((i) => i.id === b.id), lv = (cfg.live || {})[b.id] || {};
          // Only keep fields the owner actually changed, so daily prices keep flowing in.
          for (const k of ["name", "store", "cat", "url"]) {
            if (b[k] == null || b[k] === "") continue;
            const v = clean(b[k], 1000);
            if (v === base[k] || v === lv[k]) delete o[k]; else o[k] = v;
          }
          if (b.price != null && b.price !== "") {
            const pr = Number(b.price);
            if (pr === Number(base.price) || pr === Number(lv.price)) delete o.price; else o.price = pr;
          }
          cfg.images = cfg.images || {};
          if (b.image) cfg.images[b.id] = clean(b.image, 1500);
          cfg.overrides[b.id] = o;
          await saveConfig(cfg);
          return json({ ok: true });
        }
        const it = it0;
        for (const k of ["name", "store", "cat", "image", "url"]) if (b[k] != null) it[k] = clean(b[k], 1000);
        if (b.price != null && b.price !== "" && Number(b.price) !== Number(it.price)) { it.price = Number(b.price); it.manualPrice = true; }
        await saveConfig(cfg);
        return json({ ok: true, item: it });
      }
      if (action === "import") {
        // One-off move from the old Netlify site: copies settings, gifts and uploaded photos.
        const OLD = "https://babyjennings.netlify.app";
        const r = await fetch(OLD + "/api/state", { headers: { "x-admin-key": ENV.ADMIN_PASSWORD } });
        if (!r.ok) return json({ error: "Couldn't reach the old site (" + r.status + ")." }, 502);
        const o = await r.json();
        if (!o.admin) return json({ error: "The old site didn't accept the password. Use the same owner password on both." }, 403);
        const cfg = await getConfig();
        cfg.items = o.items || []; cfg.removed = o.removed || []; cfg.wanted = o.wanted || {};
        const imgs = Object.assign({}, o.images || {}); delete imgs.v; cfg.images = imgs;
        cfg.overrides = o.overrides || {}; cfg.live = o.live || {}; cfg.liveAt = o.liveAt || null;
        if (o.picks) cfg.picks = o.picks;
        const ups = new Set();
        JSON.stringify([cfg.items, cfg.images, cfg.overrides]).replace(/\/api\/up\/([a-z0-9]+)/g, (_, id) => ups.add(id));
        let photos = 0;
        for (const id of ups) {
          try { const pr = await fetch(OLD + "/api/up/" + id); if (pr.ok) { await store().set("up/" + id, await pr.arrayBuffer(), { metadata: { type: pr.headers.get("content-type") || "image/jpeg" } }); photos++; } } catch (_) {}
        }
        let gifts = 0;
        for (const p of o.purchases || []) {
          if (!p.id || !p.itemId) continue;
          await store().setJSON("p/" + p.id, { itemId: p.itemId, qty: p.qty, name: p.name, message: p.message || "", surprise: !!p.surprise, at: p.at });
          gifts++;
        }
        await saveConfig(cfg);
        return json({ ok: true, items: cfg.items.length, gifts, photos });
      }
      if (action === "pick") {
        const id = clean(b.id, 100);
        let picks = cfg.picks || ["maxicosi-monitor","eufy-s1-pro","bunjie-bundle","momcozy-kleanpal","teddy-clouds","babybjorn-carrier-mini","jengo-bouncer","sable-nappybag"];
        picks = picks.filter(x => x !== id);
        if (b.on) picks.push(id);
        cfg.picks = picks;
        await saveConfig(cfg);
        return json({ ok: true, picks });
      }
      if (action === "wanted") {
        cfg.wanted[clean(b.id, 100)] = Math.max(0, parseInt(b.qty, 10) || 0);
        await saveConfig(cfg);
        return json({ ok: true });
      }
      if (action === "remove") {
        const id = clean(b.id, 100);
        if (!cfg.removed.includes(id)) cfg.removed.push(id);
        await saveConfig(cfg);
        return json({ ok: true });
      }
      if (action === "restore") {
        cfg.removed = cfg.removed.filter((x) => x !== b.id);
        await saveConfig(cfg);
        return json({ ok: true });
      }
      if (action === "undo") {
        await store().delete("p/" + clean(b.id, 100));
        return json({ ok: true });
      }
      if (action === "refresh-photo") {
        await store().delete("img/" + clean(b.id, 100));
        cfg.images = cfg.images || {}; delete cfg.images[clean(b.id, 100)]; cfg.imgV = (cfg.imgV || 0) + 1;
        await saveConfig(cfg);
        return json({ ok: true });
      }
      if (action === "photo") {
        const img = clean(b.image, 1500);
        cfg.images = cfg.images || {};
        if (img && !/^(https?:\/\/|\/api\/up\/)/i.test(img)) return json({ error: "Please paste a full image link starting with https://" }, 400);
        if (img) cfg.images[clean(b.id, 100)] = img; else delete cfg.images[clean(b.id, 100)];
        await saveConfig(cfg);
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
};

