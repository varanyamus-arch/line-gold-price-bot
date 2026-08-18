import type { IncomingMessage, ServerResponse } from "node:http";
import { messagingApi } from "@line/bot-sdk";
import { verifyCloudflareSignature } from "../src/cloudflare-auth.js";
import { goldPriceFlex } from "../src/flex.js";
import { fetchMarketSnapshot } from "../src/market.js";
import { fetchGoldPrice } from "../src/scraper.js";

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "POST" });
    return res.end(JSON.stringify({ ok: false, message: "Method ไม่ถูกต้อง" }));
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  const rawBody = Buffer.concat(chunks).toString("utf8");
  const bodyHash = String(req.headers["x-gold-body-sha256"] ?? "");
  const calculatedBodyHash = Buffer.from(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(rawBody))).toString("base64url");
  const isCloudflareAuthorized = await verifyCloudflareSignature(
    req.method,
    String(req.headers["x-gold-timestamp"] ?? ""),
    String(req.headers["x-gold-signature"] ?? ""),
    bodyHash,
  );

  if (!isCloudflareAuthorized || bodyHash !== calculatedBodyHash) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ไม่ผ่านการยืนยันตัวตน" }));
  }

  let to = "";
  try {
    const payload = JSON.parse(rawBody) as { to?: unknown };
    to = typeof payload.to === "string" ? payload.to.trim() : "";
  } catch {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "JSON ไม่ถูกต้อง" }));
  }
  if (!/^C[0-9A-Za-z_-]{10,127}$/.test(to)) {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "groupId ไม่ถูกต้อง" }));
  }
  if (!token) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ยังไม่ได้ตั้งค่า LINE_CHANNEL_ACCESS_TOKEN" }));
  }

  try {
    const [price, market] = await Promise.all([fetchGoldPrice(), fetchMarketSnapshot()]);
    const notification = { ...price, ...market };
    const client = new messagingApi.MessagingApiClient({ channelAccessToken: token });
    await client.pushMessage({ to, messages: [goldPriceFlex(notification)] });
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({
      ok: true,
      announcedDate: price.announcedDate,
      announcedTime: price.announcedTime,
      round: price.round,
      signature: price.signature,
      goldSpotUsd: market.goldSpotUsd,
      usdThb: market.usdThb,
    }));
  } catch (error) {
    console.error("group push error", error);
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ส่งแจ้งเตือนไม่สำเร็จ" }));
  }
}
