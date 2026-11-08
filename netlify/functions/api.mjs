// Baby Jennings Registry API (Netlify Functions v2 + Netlify Blobs)
import { getStore } from "@netlify/blobs";

const store = () => getStore({ name: "registry", consistency: "strong" });
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
  return (await store().get("config", { type: "json" })) || { items: [], removed: [], wanted: {} };
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
  return !!process.env.ADMIN_PASSWORD && key === process.env.ADMIN_PASSWORD;
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
    if (image && image.startsWith("//")) image = "https:" + image;
    if (image && image.startsWith("/")) image = new URL(image, url).href;
    const p = price != null ? parseFloat(String(price).replace(/[^0-9.]/g, "")) : NaN;
    return { name: name ? decode(name).trim().replace(/\s*[|–-]\s*[^|–-]{2,40}$/, "") : null, image: image || null, price: isNaN(p) ? null : p };
  } catch (_) {
    return { name: null, image: null, price: null };
  } finally { clearTimeout(t); }
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

export default async (req) => {
  const url = new URL(req.url);
  const path = url.pathname.replace(/^\/api\/?/, "");
  const method = req.method;

  try {
    // ---------- Public ----------
    if (path === "state" && method === "GET") {
      const [cfg, purchases] = await Promise.all([getConfig(), getPurchases()]);
      const admin = isAdmin(req);
      const items = cfg.items.filter((i) => admin || (i.name && i.price != null));
      const ps = purchases.map((p) => admin ? p : { id: p.id, itemId: p.itemId, qty: p.qty, name: p.surprise ? null : p.name, message: p.surprise ? null : p.message, surprise: !!p.surprise, at: p.at });
      return json({ items, removed: cfg.removed, wanted: cfg.wanted, purchases: ps, admin });
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

    // Product photo for catalogue items: looked up once from the store page, then cached.
    if (path.startsWith("img/") && method === "GET") {
      const id = decodeURIComponent(path.slice(4));
      const s = store();
      let cached = await s.get("img/" + id, { type: "json" });
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

    // ---------- Admin (Matt & Grace) ----------
    if (path.startsWith("admin/")) {
      if (!isAdmin(req)) return json({ error: "Wrong password." }, 401);
      const action = path.slice(6);
      if (action === "check") return json({ ok: true });

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
        const it = cfg.items.find((i) => i.id === b.id);
        if (!it) return json({ error: "Not found" }, 404);
        for (const k of ["name", "store", "cat", "image", "url"]) if (b[k] != null) it[k] = clean(b[k], 1000);
        if (b.price != null && b.price !== "") it.price = Number(b.price);
        await saveConfig(cfg);
        return json({ ok: true, item: it });
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
        return json({ ok: true });
      }
    }
    return json({ error: "Not found" }, 404);
  } catch (err) {
    return json({ error: "Something went wrong. Please try again." }, 500);
  }
};

export const config = { path: "/api/*" };
