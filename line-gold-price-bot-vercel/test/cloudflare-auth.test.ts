import assert from "node:assert/strict";
import test from "node:test";
import { verifyCloudflareSignature } from "../src/cloudflare-auth.js";

test("ยอมรับลายเซ็น Worker ที่ถูกต้อง", async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const timestamp = "1786815000000";
  const bodyHash = "test-body-hash";
  const message = `${timestamp}\nPOST\n/api/broadcast\n${bodyHash}`;
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    new TextEncoder().encode(message),
  );
  const encoded = Buffer.from(signature).toString("base64url");
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  assert.equal(await verifyCloudflareSignature("POST", timestamp, encoded, bodyHash, publicKey, Number(timestamp)), true);
});

test("ปฏิเสธลายเซ็นหมดอายุและข้อความที่ถูกแก้", async () => {
  const pair = await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["sign", "verify"],
  );
  const timestamp = "1786815000000";
  const bodyHash = "test-body-hash";
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    pair.privateKey,
    new TextEncoder().encode(`${timestamp}\nPOST\n/api/broadcast\n${bodyHash}`),
  );
  const encoded = Buffer.from(signature).toString("base64url");
  const publicKey = await crypto.subtle.exportKey("jwk", pair.publicKey);
  assert.equal(await verifyCloudflareSignature("GET", timestamp, encoded, bodyHash, publicKey, Number(timestamp)), false);
  assert.equal(await verifyCloudflareSignature("POST", timestamp, encoded, "changed", publicKey, Number(timestamp)), false);
  assert.equal(await verifyCloudflareSignature("POST", timestamp, encoded, bodyHash, publicKey, Number(timestamp) + 180_000), false);
});
