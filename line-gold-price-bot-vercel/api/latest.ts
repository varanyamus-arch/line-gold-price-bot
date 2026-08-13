import type { IncomingMessage, ServerResponse } from "node:http";
import { fetchGoldPrice } from "../src/scraper.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET") {
    res.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "GET" });
    return res.end(JSON.stringify({ ok: false, message: "Method ไม่ถูกต้อง" }));
  }

  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const authorization = (req.headers.authorization ?? "").trim();
  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "CRON_SECRET ไม่ถูกต้อง" }));
  }

  try {
    const price = await fetchGoldPrice();
    res.writeHead(200, {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store, max-age=0",
    });
    return res.end(JSON.stringify({ ok: true, price }));
  } catch (error) {
    console.error("latest price error", error);
    res.writeHead(502, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "อ่านประกาศสมาคมไม่สำเร็จ" }));
  }
}
