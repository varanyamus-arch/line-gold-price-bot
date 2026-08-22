const disabledResponse = () =>
  Response.json(
    {
      ok: true,
      enabled: false,
      service: "Gold LINE bot",
      message: "LINE bot automation is disabled",
    },
    { status: 410 },
  );

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/status") {
      return Response.json({
        ok: true,
        enabled: false,
        schedule: "disabled",
        webhook: "disabled",
        service: "Gold LINE bot",
      });
    }
    return disabledResponse();
  },
};
