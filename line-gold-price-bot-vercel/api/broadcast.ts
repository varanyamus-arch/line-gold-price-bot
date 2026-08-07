import type { IncomingMessage, ServerResponse } from "node:http";
import { messagingApi } from "@line/bot-sdk";
import { goldPriceFlex } from "../src/flex.js";
import { fetchGoldPrice } from "../src/scraper.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "GET" && req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "GET, POST" });
    return res.end(JSON.stringify({ ok: false, message: "Method ไม่ถูกต้อง" }));
  }

  const requestUrl = new URL(req.url ?? "/", "https://localhost");
  const suppliedSecret = requestUrl.searchParams.get("key") ?? "";
  const cronSecret = (process.env.CRON_SECRET ?? "").trim();
  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
  const authorization = (req.headers.authorization ?? "").trim();
  const isVercelCron = authorization === `Bearer ${cronSecret}`;
  const isManualRequest = suppliedSecret === cronSecret;

  if (!cronSecret || (!isVercelCron && !isManualRequest)) {
    console.warn("cron auth rejected", {
      hasAuthorization: Boolean(authorization),
      authorizationLength: authorization.length,
      expectedAuthorizationLength: cronSecret ? `Bearer ${cronSecret}`.length : 0,
      hasQueryKey: Boolean(suppliedSecret),
    });
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "CRON_SECRET ไม่ถูกต้อง" }));
  }
  if (!token) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }));
  }

  try {
    const price = await fetchGoldPrice();
    const client = new messagingApi.MessagingApiClient({ channelAccessToken: token });
    await client.broadcast({ messages: [goldPriceFlex(price)] });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: true, announcedAt: price.announcedAt, round: price.round }));
  } catch (error) {
    console.error("broadcast error", error);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ส่งแจ้งเตือนไม่สำเร็จ" }));
  }
}
