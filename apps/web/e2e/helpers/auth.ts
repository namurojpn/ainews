/**
 * E2E テスト用 NextAuth v5 セッション注入ヘルパー
 * RFC 7516 準拠の JWE A256CBC-HS512 を Node.js 組み込み WebCrypto のみで実装
 */
import { webcrypto, randomUUID } from "node:crypto";
import type { BrowserContext } from "@playwright/test";

const AUTH_SECRET =
  process.env.AUTH_SECRET ?? "jslnVE+7EUHEXIk+oD9CMK7QAzRWp2LS4WtJ9DG1Lok=";
const SALT = "authjs.session-token";

const subtle = webcrypto.subtle;
const te = new TextEncoder();

function b64url(data: Uint8Array | ArrayBuffer): string {
  const bytes = data instanceof ArrayBuffer ? new Uint8Array(data) : data;
  return Buffer.from(bytes)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

/**
 * @auth/core/jwt の encode() と同等の JWE トークンを生成する
 * - HKDF-SHA256 でキーを導出 (64 bytes)
 * - AES-256-CBC で暗号化 (ENC_KEY = 後半 32 bytes)
 * - HMAC-SHA512 で認証タグを生成 (MAC_KEY = 前半 32 bytes)
 * - RFC 7516 Section 5.2.2 に従い MAC_INPUT = AAD | IV | E | AL
 */
async function encryptJWE(payload: object, secret: string, salt: string): Promise<string> {
  // 1. HKDF で 512 bits を導出
  const keyMaterial = await subtle.importKey(
    "raw",
    te.encode(secret),
    { name: "HKDF" },
    false,
    ["deriveBits"]
  );
  const derived = new Uint8Array(
    await subtle.deriveBits(
      {
        name: "HKDF",
        hash: "SHA-256",
        salt: te.encode(salt),
        info: te.encode(`Auth.js Generated Encryption Key (${salt})`),
      },
      keyMaterial,
      512
    )
  );
  const macKey = derived.slice(0, 32); // 前半: HMAC 用
  const encKey = derived.slice(32);    // 後半: AES-CBC 用

  // 2. Protected Header (alg=dir, enc=A256CBC-HS512)
  const header = JSON.stringify({ alg: "dir", enc: "A256CBC-HS512" });
  const headerB64 = b64url(te.encode(header));

  // 3. AES-256-CBC で暗号化
  const iv = webcrypto.getRandomValues(new Uint8Array(16));
  const aesKey = await subtle.importKey("raw", encKey, { name: "AES-CBC" }, false, ["encrypt"]);
  const ciphertext = new Uint8Array(
    await subtle.encrypt({ name: "AES-CBC", iv }, aesKey, te.encode(JSON.stringify(payload)))
  );

  // 4. RFC 7516 Section 5.2.2 に従い HMAC-SHA512 を計算
  //    MAC_INPUT = AAD || IV || E || AL
  //    AAD = ASCII(Protected Header) = headerB64 バイト列
  //    AL = uint64 big-endian (AAD の bit 数)
  const aad = te.encode(headerB64);
  const al = BigInt(aad.byteLength * 8);
  const macInput = new Uint8Array(aad.byteLength + iv.byteLength + ciphertext.byteLength + 8);
  let off = 0;
  macInput.set(aad, off);        off += aad.byteLength;
  macInput.set(iv, off);         off += iv.byteLength;
  macInput.set(ciphertext, off); off += ciphertext.byteLength;
  new DataView(macInput.buffer, off, 8).setBigUint64(0, al, false);

  const hmacKey = await subtle.importKey("raw", macKey, { name: "HMAC", hash: "SHA-512" }, false, ["sign"]);
  const mac = new Uint8Array(await subtle.sign("HMAC", hmacKey, macInput));
  const tag = mac.slice(0, 32); // A256CBC-HS512: tag = 前半 32 bytes

  // 5. JWE Compact Serialization: header . encryptedKey . iv . ciphertext . tag
  //    "dir" = encrypted key は空文字列
  return [headerB64, "", b64url(iv), b64url(ciphertext), b64url(tag)].join(".");
}

export interface TestUser {
  id: string;
  email: string;
  name: string;
  role: "USER" | "ADMIN";
  subscriptionStatus: "trialing" | "active" | "canceled" | "suspended";
  trialEndDate: string | null;
}

export const TEST_USER: TestUser = {
  id: "e2e-test-user-id",
  email: "e2e@example.com",
  name: "E2Eテストユーザー",
  role: "USER",
  subscriptionStatus: "active",
  trialEndDate: null,
};

export const TEST_ADMIN: TestUser = {
  id: "e2e-admin-user-id",
  email: "admin@example.com",
  name: "E2E管理者",
  role: "ADMIN",
  subscriptionStatus: "active",
  trialEndDate: null,
};

export async function createSessionToken(user: TestUser = TEST_USER): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  return encryptJWE(
    {
      sub: user.id,
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      subscriptionStatus: user.subscriptionStatus,
      trialEndDate: user.trialEndDate,
      iat: now,
      exp: now + 24 * 60 * 60,
      jti: randomUUID(),
    },
    AUTH_SECRET,
    SALT
  );
}

export async function loginAs(context: BrowserContext, user: TestUser = TEST_USER) {
  const token = await createSessionToken(user);
  await context.addCookies([
    {
      name: SALT,
      value: token,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax",
    },
  ]);
}
