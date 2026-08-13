interface Price {
  barBuy: number;
  barSell: number;
  announcedDate: string;
  announcedTime: string;
  round: number;
  signature: string;
}

interface Env {
  ANNOUNCEMENT_STATE: KVNamespace;
  VERCEL_BASE_URL: string;
  CRON_SECRET: string;
}

const SIGNATURE_KEY = "latest-announcement-signature";
const RECORD_KEY = "latest-announcement-record";

async function checkForAnnouncement(env: Env) {
  const headers = { authorization: `Bearer ${env.CRON_SECRET}` };
  const latestResponse = await fetch(`${env.VERCEL_BASE_URL}/api/latest`, { headers });
  if (!latestResponse.ok) throw new Error(`latest endpoint returned ${latestResponse.status}`);

  const payload = await latestResponse.json<{ ok: boolean; price: Price }>();
  if (!payload.ok || !payload.price?.signature) throw new Error("latest endpoint returned invalid data");

  const previousSignature = await env.ANNOUNCEMENT_STATE.get(SIGNATURE_KEY);
  if (previousSignature === payload.price.signature) {
    return { ok: true, sent: false, reason: "unchanged", signature: payload.price.signature };
  }

  const broadcastResponse = await fetch(`${env.VERCEL_BASE_URL}/api/broadcast`, { headers });
  if (!broadcastResponse.ok) throw new Error(`broadcast endpoint returned ${broadcastResponse.status}`);

  await env.ANNOUNCEMENT_STATE.put(SIGNATURE_KEY, payload.price.signature);
  await env.ANNOUNCEMENT_STATE.put(RECORD_KEY, JSON.stringify({ ...payload.price, savedAt: new Date().toISOString() }));
  return { ok: true, sent: true, reason: "new-announcement", signature: payload.price.signature };
}

export default {
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(checkForAnnouncement(env));
  },

  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/status") {
      const record = await env.ANNOUNCEMENT_STATE.get(RECORD_KEY, "json");
      return Response.json({ ok: true, schedule: "every-minute", latest: record });
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
