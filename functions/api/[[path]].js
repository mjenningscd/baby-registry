import { init, handle } from "../../lib/core.mjs";
import { kvStore } from "../../lib/kvstore.mjs";

export async function onRequest({ request, env }) {
  if (!env.REGISTRY) return new Response(JSON.stringify({ error: "Storage isn't connected yet (KV binding REGISTRY)." }), { status: 500, headers: { "content-type": "application/json" } });
  init(kvStore(env.REGISTRY), env);
  return handle(request);
}
