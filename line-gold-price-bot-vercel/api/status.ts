import type { IncomingMessage, ServerResponse } from "node:http";

export default function handler(_req: IncomingMessage, res: ServerResponse) {
  res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({
    ok: true,
    service: "LINE Gold Price Bot",
    configured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.LINE_CHANNEL_SECRET),
    broadcastConfigured: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN && process.env.CRON_SECRET),
  }));
}
