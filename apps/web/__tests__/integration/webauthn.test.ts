/**
 * WebAuthn 登録・認証フロー 結合テスト
 * - createRegistrationOptions: チャレンジを DB に保存
 * - verifyRegistration: パスキーを DB に作成
 * - createAuthenticationOptions: 認証オプションを生成
 * - verifyAuthentication: カウンターを更新しユーザーを返す
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/prisma", () => ({
  prisma: {
    user: {
      findUniqueOrThrow: vi.fn(),
      findUnique: vi.fn(),
    },
    passkey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    webAuthnChallenge: {
      create: vi.fn(),
      findFirst: vi.fn(),
      delete: vi.fn(),
    },
    $transaction: vi.fn().mockResolvedValue([{}, {}]),
  },
}));

vi.mock("@simplewebauthn/server", () => ({
  generateRegistrationOptions: vi.fn(),
  verifyRegistrationResponse: vi.fn(),
  generateAuthenticationOptions: vi.fn(),
  verifyAuthenticationResponse: vi.fn(),
}));

import {
  createRegistrationOptions,
  verifyRegistration,
  createAuthenticationOptions,
  verifyAuthentication,
} from "@/lib/webauthn";
import { prisma } from "@/lib/prisma";
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";

const mp = prisma as any;
const mockGenRegOptions = generateRegistrationOptions as ReturnType<typeof vi.fn>;
const mockVerifyReg = verifyRegistrationResponse as ReturnType<typeof vi.fn>;
const mockGenAuthOptions = generateAuthenticationOptions as ReturnType<typeof vi.fn>;
const mockVerifyAuth = verifyAuthenticationResponse as ReturnType<typeof vi.fn>;

const MOCK_USER = { id: "user-1", email: "test@example.com", displayName: "テストユーザー" };
const MOCK_CHALLENGE = "base64-challenge-string";

describe("createRegistrationOptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("チャレンジを DB に保存してオプションを返す", async () => {
    mp.user.findUniqueOrThrow.mockResolvedValue(MOCK_USER);
    mp.passkey.findMany.mockResolvedValue([]);
    mockGenRegOptions.mockResolvedValue({ challenge: MOCK_CHALLENGE });
    mp.webAuthnChallenge.create.mockResolvedValue({});

    const options = await createRegistrationOptions("user-1");

    expect(options.challenge).toBe(MOCK_CHALLENGE);
    expect(mp.webAuthnChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          challenge: MOCK_CHALLENGE,
          type: "registration",
        }),
      })
    );
  });

  it("既存パスキーを excludeCredentials に含める", async () => {
    mp.user.findUniqueOrThrow.mockResolvedValue(MOCK_USER);
    mp.passkey.findMany.mockResolvedValue([
      { credentialId: "cred-id-1" },
      { credentialId: "cred-id-2" },
    ]);
    mockGenRegOptions.mockResolvedValue({ challenge: MOCK_CHALLENGE });
    mp.webAuthnChallenge.create.mockResolvedValue({});

    await createRegistrationOptions("user-1");

    const callArg = mockGenRegOptions.mock.calls[0][0];
    expect(callArg.excludeCredentials).toHaveLength(2);
    expect(callArg.excludeCredentials[0].id).toBe("cred-id-1");
  });
});

describe("verifyRegistration", () => {
  beforeEach(() => vi.clearAllMocks());

  it("検証成功時にパスキーを DB に作成する", async () => {
    const mockChallengeRecord = {
      id: "challenge-1",
      challenge: MOCK_CHALLENGE,
    };
    mp.webAuthnChallenge.findFirst.mockResolvedValue(mockChallengeRecord);
    mockVerifyReg.mockResolvedValue({
      verified: true,
      registrationInfo: {
        credential: { id: "new-cred-id", publicKey: new Uint8Array([1, 2, 3]), counter: 0 },
        aaguid: "aaguid-value",
      },
    });
    mp.webAuthnChallenge.delete.mockResolvedValue({});
    mp.passkey.create.mockResolvedValue({
      id: "passkey-1",
      deviceName: "テストデバイス",
    });

    const passkey = await verifyRegistration("user-1", {} as any, "テストデバイス");
    expect(passkey.id).toBe("passkey-1");
    expect(mp.passkey.create).toHaveBeenCalledOnce();
    expect(mp.webAuthnChallenge.delete).toHaveBeenCalledOnce();
  });

  it("チャレンジが存在しない場合エラーを投げる", async () => {
    mp.webAuthnChallenge.findFirst.mockResolvedValue(null);

    await expect(verifyRegistration("user-1", {} as any)).rejects.toThrow(
      "チャレンジが見つからないか期限切れです"
    );
  });

  it("検証失敗（verified = false）の場合エラーを投げる", async () => {
    mp.webAuthnChallenge.findFirst.mockResolvedValue({ id: "c1", challenge: "ch" });
    mockVerifyReg.mockResolvedValue({ verified: false, registrationInfo: null });

    await expect(verifyRegistration("user-1", {} as any)).rejects.toThrow(
      "パスキーの登録検証に失敗しました"
    );
  });
});

describe("createAuthenticationOptions", () => {
  beforeEach(() => vi.clearAllMocks());

  it("メールなしでも全ユーザー向けオプションを生成する", async () => {
    mockGenAuthOptions.mockResolvedValue({ challenge: MOCK_CHALLENGE, allowCredentials: [] });
    mp.webAuthnChallenge.create.mockResolvedValue({});

    const options = await createAuthenticationOptions();
    expect(options.challenge).toBe(MOCK_CHALLENGE);
    expect(mp.webAuthnChallenge.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ type: "authentication" }),
      })
    );
  });

  it("メールを指定するとそのユーザーのパスキーのみ allowCredentials に含める", async () => {
    mp.user.findUnique.mockResolvedValue({ id: "user-1" });
    mp.passkey.findMany.mockResolvedValue([{ credentialId: "cred-1" }]);
    mockGenAuthOptions.mockResolvedValue({ challenge: MOCK_CHALLENGE });
    mp.webAuthnChallenge.create.mockResolvedValue({});

    await createAuthenticationOptions("test@example.com");

    const callArg = mockGenAuthOptions.mock.calls[0][0];
    expect(callArg.allowCredentials).toHaveLength(1);
    expect(callArg.allowCredentials[0].id).toBe("cred-1");
  });
});

describe("verifyAuthentication", () => {
  beforeEach(() => vi.clearAllMocks());

  it("認証成功時にカウンターを更新しユーザーを返す", async () => {
    const mockPasskey = {
      id: "pk-1",
      credentialId: "cred-1",
      publicKey: Buffer.from([1, 2, 3]).toString("base64"),
      counter: BigInt(0),
      user: MOCK_USER,
    };
    mp.passkey.findUnique.mockResolvedValue(mockPasskey);
    mp.webAuthnChallenge.findFirst.mockResolvedValue({ id: "c1", challenge: MOCK_CHALLENGE });
    mockVerifyAuth.mockResolvedValue({
      verified: true,
      authenticationInfo: { newCounter: 1 },
    });

    const user = await verifyAuthentication({ id: "cred-1" } as any);
    expect(user).toEqual(MOCK_USER);
    expect(mp.$transaction).toHaveBeenCalledOnce();
  });

  it("パスキーが DB に存在しない場合エラーを投げる", async () => {
    mp.passkey.findUnique.mockResolvedValue(null);

    await expect(verifyAuthentication({ id: "unknown" } as any)).rejects.toThrow(
      "パスキーが見つかりません"
    );
  });

  it("チャレンジが存在しない場合エラーを投げる", async () => {
    mp.passkey.findUnique.mockResolvedValue({
      id: "pk-1",
      credentialId: "cred-1",
      publicKey: Buffer.from([]).toString("base64"),
      counter: BigInt(0),
      user: MOCK_USER,
    });
    mp.webAuthnChallenge.findFirst.mockResolvedValue(null);

    await expect(verifyAuthentication({ id: "cred-1" } as any)).rejects.toThrow(
      "チャレンジが見つからないか期限切れです"
    );
  });

  it("verifyAuthenticationResponse が false を返した場合エラーを投げる", async () => {
    mp.passkey.findUnique.mockResolvedValue({
      id: "pk-1",
      credentialId: "cred-1",
      publicKey: Buffer.from([]).toString("base64"),
      counter: BigInt(0),
      user: MOCK_USER,
    });
    mp.webAuthnChallenge.findFirst.mockResolvedValue({ id: "c1", challenge: MOCK_CHALLENGE });
    mockVerifyAuth.mockResolvedValue({ verified: false });

    await expect(verifyAuthentication({ id: "cred-1" } as any)).rejects.toThrow(
      "パスキー認証に失敗しました"
    );
  });
});
