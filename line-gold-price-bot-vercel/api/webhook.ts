import type { IncomingMessage, ServerResponse } from "node:http";
import { validateSignature } from "@line/bot-sdk";

function json(res: ServerResponse, status: number, body: object) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  return res.end(JSON.stringify(body));
}

function readRawBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on("data", (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    if (req.method !== "POST") {
      res.setHeader("allow", "POST");
      return json(res, 405, { ok: false, message: "ใช้ POST เท่านั้น" });
    }

    const secret = process.env.LINE_CHANNEL_SECRET;
    if (!secret) {
      return json(res, 500, { ok: false, message: "ยังไม่ได้ตั้งค่า LINE Environment Variables" });
    }

    const raw = await readRawBody(req);
    const signature = String(req.headers["x-line-signature"] ?? "");
    if (!signature || !validateSignature(raw.toString("utf8"), secret, signature)) {
      return json(res, 401, { ok: false, message: "LINE signature ไม่ถูกต้อง" });
    }

    try {
      JSON.parse(raw.toString("utf8"));
    } catch {
      return json(res, 400, { ok: false, message: "JSON ไม่ถูกต้อง" });
    }

    // Legacy endpoint intentionally acknowledges events without replying.
    // LINE Webhook should point to the Cloudflare Worker, which stores groupId in KV.
    return json(res, 200, { ok: true, replyMode: "disabled" });
  } catch (error) {
    console.error("webhook error", error);
    return json(res, 500, { ok: false, message: "Webhook ทำงานไม่สำเร็จ" });
  }
}
