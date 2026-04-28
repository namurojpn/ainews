import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from "@simplewebauthn/server";
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";

const RP_ID = process.env.WEBAUTHN_RP_ID ?? "localhost";
const RP_NAME = process.env.WEBAUTHN_RP_NAME ?? "AI Insight Daily";
const ORIGIN =
  process.env.NEXTAUTH_URL ?? `https://${RP_ID}`;

export async function createRegistrationOptions(userId: string) {
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  const existingPasskeys = await prisma.passkey.findMany({
    where: { userId },
    select: { credentialId: true },
  });

  const options = await generateRegistrationOptions({
    rpName: RP_NAME,
    rpID: RP_ID,
    userName: user.email,
    userDisplayName: user.displayName ?? user.email,
    excludeCredentials: existingPasskeys.map((p) => ({
      id: p.credentialId,
    })),
    authenticatorSelection: {
      residentKey: "required",
      userVerification: "required",
    },
  });

  // チャレンジをDBに5分間保存
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.webAuthnChallenge.create({
    data: {
      userId,
      challenge: options.challenge,
      type: "registration",
      expiresAt,
    },
  });

  return options;
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceName?: string
) {
  const challengeRecord = await prisma.webAuthnChallenge.findFirst({
    where: {
      userId,
      type: "registration",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challengeRecord) throw new Error("チャレンジが見つからないか期限切れです");

  const verification = await verifyRegistrationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    requireUserVerification: true,
  });

  if (!verification.verified || !verification.registrationInfo) {
    throw new Error("パスキーの登録検証に失敗しました");
  }

  const { credential } = verification.registrationInfo;

  await prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } });

  const passkey = await prisma.passkey.create({
    data: {
      userId,
      credentialId: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString("base64"),
      counter: BigInt(credential.counter),
      aaguid: verification.registrationInfo.aaguid,
      deviceName: deviceName ?? "パスキー",
    },
  });

  return passkey;
}

export async function createAuthenticationOptions(email?: string) {
  let allowCredentials: { id: string }[] = [];

  if (email) {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      const passkeys = await prisma.passkey.findMany({
        where: { userId: user.id },
        select: { credentialId: true },
      });
      allowCredentials = passkeys.map((p) => ({ id: p.credentialId }));
    }
  }

  const options = await generateAuthenticationOptions({
    rpID: RP_ID,
    userVerification: "required",
    allowCredentials,
  });

  const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
  await prisma.webAuthnChallenge.create({
    data: {
      challenge: options.challenge,
      type: "authentication",
      expiresAt,
    },
  });

  return options;
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON
) {
  const passkey = await prisma.passkey.findUnique({
    where: { credentialId: response.id },
    include: { user: true },
  });
  if (!passkey) throw new Error("パスキーが見つかりません");

  const challengeRecord = await prisma.webAuthnChallenge.findFirst({
    where: {
      type: "authentication",
      expiresAt: { gt: new Date() },
    },
    orderBy: { createdAt: "desc" },
  });
  if (!challengeRecord) throw new Error("チャレンジが見つからないか期限切れです");

  const verification = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challengeRecord.challenge,
    expectedOrigin: ORIGIN,
    expectedRPID: RP_ID,
    credential: {
      id: passkey.credentialId,
      publicKey: Buffer.from(passkey.publicKey, "base64"),
      counter: Number(passkey.counter),
    },
    requireUserVerification: true,
  });

  if (!verification.verified) throw new Error("パスキー認証に失敗しました");

  await prisma.$transaction([
    prisma.passkey.update({
      where: { id: passkey.id },
      data: {
        counter: BigInt(verification.authenticationInfo.newCounter),
        lastUsedAt: new Date(),
      },
    }),
    prisma.webAuthnChallenge.delete({ where: { id: challengeRecord.id } }),
  ]);

  return passkey.user;
}
