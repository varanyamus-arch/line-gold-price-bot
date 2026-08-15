import type { IncomingMessage, ServerResponse } from "node:http";
import { messagingApi } from "@line/bot-sdk";
import { verifyCloudflareSignature } from "../src/cloudflare-auth.js";
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
  const isSecretAuthorized = Boolean(cronSecret) && (
    authorization === `Bearer ${cronSecret}` || suppliedSecret === cronSecret
  );
  const isCloudflareAuthorized = await verifyCloudflareSignature(
    req.method,
    String(req.headers["x-gold-timestamp"] ?? ""),
    String(req.headers["x-gold-signature"] ?? ""),
  );

  if (!isSecretAuthorized && !isCloudflareAuthorized) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ไม่ผ่านการยืนยันตัวตน" }));
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
    return res.end(JSON.stringify({
      ok: true,
      announcedDate: price.announcedDate,
      announcedTime: price.announcedTime,
      round: price.round,
      signature: price.signature,
    }));
  } catch (error) {
    console.error("broadcast error", error);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ส่งแจ้งเตือนไม่สำเร็จ" }));
  }
}
