import type { IncomingMessage, ServerResponse } from "node:http";
import { messagingApi, validateSignature, type WebhookEvent } from "@line/bot-sdk";
import { goldPriceFlex } from "../src/flex.js";
import { fetchGoldPrice } from "../src/scraper.js";

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

const PRICE_WORDS = /^(ราคาทอง|ทองวันนี้|ทองคำวันนี้|ราคาล่าสุด|ล่าสุด)$/u;

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  if (req.method !== "POST") {
    res.writeHead(405, { "content-type": "application/json; charset=utf-8", allow: "POST" });
    return res.end(JSON.stringify({ ok: false, message: "ใช้ POST เท่านั้น" }));
  }

  const token = process.env.LINE_CHANNEL_ACCESS_TOKEN;
  const secret = process.env.LINE_CHANNEL_SECRET;
  if (!token || !secret) {
    res.writeHead(500, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "ยังไม่ได้ตั้งค่า LINE Environment Variables" }));
  }

  const raw = await readRawBody(req);
  const signature = String(req.headers["x-line-signature"] ?? "");
  if (!signature || !validateSignature(raw.toString("utf8"), secret, signature)) {
    res.writeHead(401, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "LINE signature ไม่ถูกต้อง" }));
  }

  let events: WebhookEvent[];
  try {
    events = JSON.parse(raw.toString("utf8")).events ?? [];
  } catch {
    res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ ok: false, message: "JSON ไม่ถูกต้อง" }));
  }

  const client = new messagingApi.MessagingApiClient({ channelAccessToken: token });
  await Promise.all(events.map(async (event) => {
    if (event.type !== "message" || event.message.type !== "text" || !event.replyToken) return;
    const text = event.message.text.trim();
    if (!PRICE_WORDS.test(text)) {
      await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "พิมพ์ “ราคาทอง” เพื่อดูราคาล่าสุดค่ะ" }] });
      return;
    }
    try {
      const price = await fetchGoldPrice();
      await client.replyMessage({ replyToken: event.replyToken, messages: [goldPriceFlex(price)] });
    } catch (error) {
      console.error("price/reply error", error);
      await client.replyMessage({ replyToken: event.replyToken, messages: [{ type: "text", text: "ขออภัย ระบบดึงราคาทองไม่สำเร็จ กรุณาลองใหม่อีกครั้งค่ะ" }] });
    }
  }));

  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify({ ok: true }));
}
