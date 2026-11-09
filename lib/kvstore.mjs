// Netlify-Blobs-style wrapper around a Cloudflare KV namespace.
export function kvStore(kv) {
  return {
    async get(key, opts = {}) { return kv.get(key, { type: opts.type === "json" ? "json" : opts.type === "arrayBuffer" ? "arrayBuffer" : "text" }); },
    async getWithMetadata(key, opts = {}) { const r = await kv.getWithMetadata(key, { type: opts.type === "json" ? "json" : "arrayBuffer" }); return r && r.value != null ? { data: r.value, metadata: r.metadata || {} } : null; },
    async setJSON(key, value) { await kv.put(key, JSON.stringify(value)); },
    async set(key, value, opts = {}) { await kv.put(key, value, opts.metadata ? { metadata: opts.metadata } : undefined); },
    async delete(key) { await kv.delete(key); },
    async list({ prefix } = {}) {
      const blobs = []; let cursor;
      do { const r = await kv.list({ prefix, cursor }); r.keys.forEach((k) => blobs.push({ key: k.name })); cursor = r.list_complete ? null : r.cursor; } while (cursor);
      return { blobs };
    },
  };
}
