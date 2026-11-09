// Netlify entry point (kept so the old site keeps working until the move is finished).
import { getStore } from "@netlify/blobs";
import { init, handle } from "../../lib/core.mjs";
export default async (req) => { init(getStore({ name: "registry", consistency: "strong" }), process.env); return handle(req); };
export const config = { path: "/api/*" };
