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
}

const SIGNATURE_KEY = "latest-announcement-signature";
const RECORD_KEY = "latest-announcement-record";
const AUTH_KEY_PAIR_KEY = "worker-auth-key-pair";

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

async function signedBroadcastHeaders(env: Env): Promise<Record<string, string>> {
  const timestamp = Date.now().toString();
  const message = `${timestamp}\nGET\n/api/broadcast`;
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
  };
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

  const broadcastResponse = await fetch(`${env.VERCEL_BASE_URL}/api/broadcast`, {
    headers: await signedBroadcastHeaders(env),
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
    if (url.pathname === "/status") {
      const record = await env.GOLD_BOT_KV.get(RECORD_KEY, "json");
      return Response.json({ ok: true, schedule: "every-minute", latest: record });
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
