const MAX_CLOCK_SKEW_MS = 2 * 60 * 1000;

// Public half of the signing key generated and retained by the Cloudflare Worker in KV.
export const CLOUDFLARE_PUBLIC_KEY: JsonWebKey = {
  kty: "EC",
  key_ops: ["verify"],
  ext: true,
  crv: "P-256",
  x: "OfmBFWCio0ZlFrL5Li0lX_vZsFzABj_bJ3-ZkEPg_bw",
  y: "wjnEenUES7dr0llKh-PTWNQfRqFtFrdJwRhy70evMlo",
};

function fromBase64Url(value: string): ArrayBuffer {
  const bytes = Buffer.from(value, "base64url");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export async function verifyCloudflareSignature(
  method: string,
  timestamp: string,
  signature: string,
  bodyHash = "",
  publicKey: JsonWebKey | null = CLOUDFLARE_PUBLIC_KEY,
  now = Date.now(),
): Promise<boolean> {
  if (!publicKey || !timestamp || !signature || !bodyHash || !/^\d{13}$/.test(timestamp)) return false;
  if (Math.abs(now - Number(timestamp)) > MAX_CLOCK_SKEW_MS) return false;

  try {
    const key = await crypto.subtle.importKey(
      "jwk",
      publicKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
    const message = `${timestamp}\n${method.toUpperCase()}\n/api/broadcast\n${bodyHash}`;
    return await crypto.subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      key,
      fromBase64Url(signature),
      new TextEncoder().encode(message),
    );
  } catch {
    return false;
  }
}
