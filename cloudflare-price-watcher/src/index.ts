interface Price {
  barBuy: number;
  barSell: number;
  announcedDate: string;
  announcedTime: string;
  round: number;
  signature: string;
}

interface Env {
  GOLD_BOT_KV: KVNamespace;
  VERCEL_BASE_URL: string;
  CRON_SECRET: string;
  LINE_CHANNEL_SECRET: string;
}

const SIGNATURE_KEY = "latest-announcement-signature";
const RECORD_KEY = "latest-announcement-record";
const AUTH_KEY_PAIR_KEY = "worker-auth-key-pair";
const GROUP_ID_KEY = "line-group-id";

interface StoredKeyPair {
  privateKey: JsonWebKey;
  publicKey: JsonWebKey;
}

const toBase64Url = (value: ArrayBuffer): string => {
  const bytes = new Uint8Array(value);
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
};

async function ensureAuthKeyPair(env: Env): Promise<StoredKeyPair> {
  const stored = await env.GOLD_BOT_KV.get<StoredKeyPair>(AUTH_KEY_PAIR_KEY, "json");
  if (stored?.privateKey && stored?.publicKey) return stored;

  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  ) as CryptoKeyPair;
  const created = {
    privateKey: await crypto.subtle.exportKey("jwk", pair.privateKey) as JsonWebKey,
    publicKey: await crypto.subtle.exportKey("jwk", pair.publicKey) as JsonWebKey,
  };
  await env.GOLD_BOT_KV.put(AUTH_KEY_PAIR_KEY, JSON.stringify(created));
  return created;
}

async function sha256Base64Url(value: string): Promise<string> {
  return toBase64Url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

async function signedBroadcastHeaders(env: Env, body: string): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const bodyHash = await sha256Base64Url(body);
  const message = `${timestamp}\nPOST\n/api/broadcast\n${bodyHash}`;
  const pair = await ensureAuthKeyPair(env);
  const privateKey = await crypto.subtle.importKey(
    "jwk",
    pair.privateKey,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    new TextEncoder().encode(message),
  );
  return {
    "x-gold-timestamp": timestamp,
    "x-gold-signature": toBase64Url(signature),
    "x-gold-body-sha256": bodyHash,
    "content-type": "application/json; charset=utf-8",
  };
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

export async function verifyLineWebhookSignature(
  body: string,
  signature: string,
  channelSecret: string,
): Promise<boolean> {
  if (!body || !signature || !channelSecret) return false;
  try {
    const key = await crypto.subtle.importKey(
      "raw",
      new TextEncoder().encode(channelSecret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["verify"],
    );
    return await crypto.subtle.verify(
      "HMAC",
      key,
      fromBase64(signature) as BufferSource,
      new TextEncoder().encode(body),
    );
  } catch {
    return false;
  }
}

interface LineWebhookBody {
  events?: Array<{ source?: { type?: string; groupId?: string } }>;
}

export function extractGroupId(payload: LineWebhookBody): string | null {
  for (const event of payload.events ?? []) {
    const groupId = event.source?.groupId?.trim() ?? "";
    if (event.source?.type === "group" && /^C[0-9A-Za-z_-]{10,127}$/.test(groupId)) return groupId;
  }
  return null;
}

async function captureLineGroup(request: Request, env: Env): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ ok: false, message: "Method not allowed" }, { status: 405, headers: { allow: "POST" } });
  }
  const rawBody = await request.text();
  const signature = request.headers.get("x-line-signature") ?? "";
  if (!await verifyLineWebhookSignature(rawBody, signature, env.LINE_CHANNEL_SECRET)) {
    return Response.json({ ok: false, message: "Invalid LINE signature" }, { status: 401 });
  }

  let payload: LineWebhookBody;
  try {
    payload = JSON.parse(rawBody) as LineWebhookBody;
  } catch {
    return Response.json({ ok: false, message: "Invalid JSON" }, { status: 400 });
  }
  const groupId = extractGroupId(payload);
  if (groupId) await env.GOLD_BOT_KV.put(GROUP_ID_KEY, groupId);

  // Intentionally never reply through LINE: this bot only captures the group and pushes alerts.
  return Response.json({ ok: true, groupCaptured: Boolean(groupId) });
}

async function checkForAnnouncement(env: Env) {
  const latestResponse = await fetch(`${env.VERCEL_BASE_URL}/api/latest`);
  if (!latestResponse.ok) throw new Error(`latest endpoint returned ${latestResponse.status}`);

  const payload = await latestResponse.json<{ ok: boolean; price: Price }>();
  if (!payload.ok || !payload.price?.signature) throw new Error("latest endpoint returned invalid data");

  const previousSignature = await env.GOLD_BOT_KV.get(SIGNATURE_KEY);
  if (previousSignature === payload.price.signature) {
    return { ok: true, sent: false, reason: "unchanged", signature: payload.price.signature };
  }

  const groupId = await env.GOLD_BOT_KV.get(GROUP_ID_KEY);
  if (!groupId) {
    return { ok: false, sent: false, reason: "group-not-configured", signature: payload.price.signature };
  }

  const body = JSON.stringify({ to: groupId });
  const broadcastResponse = await fetch(`${env.VERCEL_BASE_URL}/api/broadcast`, {
    method: "POST",
    headers: await signedBroadcastHeaders(env, body),
    body,
  });
  if (!broadcastResponse.ok) throw new Error(`broadcast endpoint returned ${broadcastResponse.status}`);

  await env.GOLD_BOT_KV.put(SIGNATURE_KEY, payload.price.signature);
  await env.GOLD_BOT_KV.put(RECORD_KEY, JSON.stringify({ ...payload.price, savedAt: new Date().toISOString() }));
  return { ok: true, sent: true, reason: "new-announcement", signature: payload.price.signature };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(checkForAnnouncement(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/line/webhook") {
      return captureLineGroup(request, env);
    }
    if (url.pathname === "/status") {
      const record = await env.GOLD_BOT_KV.get(RECORD_KEY, "json");
      const groupConfigured = Boolean(await env.GOLD_BOT_KV.get(GROUP_ID_KEY));
      return Response.json({ ok: true, schedule: "every-minute", groupConfigured, latest: record });
    }
    if (url.pathname === "/public-key") {
      const { publicKey } = await ensureAuthKeyPair(env);
      return Response.json({ ok: true, publicKey });
    }
    if (url.pathname === "/check") {
      if (request.headers.get("authorization") !== `Bearer ${env.CRON_SECRET}`) {
        return Response.json({ ok: false, message: "Unauthorized" }, { status: 401 });
      }
      return Response.json(await checkForAnnouncement(env));
    }
    return Response.json({ ok: true, service: "Gold announcement watcher" });
  },
};
