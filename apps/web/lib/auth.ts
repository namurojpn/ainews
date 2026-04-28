import NextAuth from "next-auth";
import Google from "next-auth/providers/google";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { z } from "zod";
import type { SubscriptionStatus, UserRole } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      email: string;
      name?: string | null;
      role: UserRole;
      subscriptionStatus: SubscriptionStatus;
      trialEndDate: string | null;
    };
  }
  interface User {
    role: UserRole;
    subscriptionStatus: SubscriptionStatus;
    trialEndDate: string | null;
  }
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = z
          .object({ email: z.string().email(), password: z.string().min(8) })
          .safeParse(credentials);
        if (!parsed.success) return null;

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email, deletedAt: null },
        });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(
          parsed.data.password,
          user.passwordHash
        );
        if (!valid) return null;

        return {
          id: user.id,
          email: user.email,
          name: user.displayName,
          role: user.role,
          subscriptionStatus: user.subscriptionStatus,
          trialEndDate: user.trialEndDate?.toISOString() ?? null,
        };
      },
    }),
  ],
  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        const existing = await prisma.user.findUnique({
          where: { email: user.email! },
        });
        if (!existing) {
          const trialEnd = new Date();
          trialEnd.setDate(trialEnd.getDate() + 30);
          const newUser = await prisma.user.create({
            data: {
              email: user.email!,
              displayName: user.name,
              subscriptionStatus: "trialing",
              trialEndDate: trialEnd,
              accounts: {
                create: {
                  provider: "google",
                  providerAccountId: account.providerAccountId,
                },
              },
              notificationSetting: { create: {} },
              subscription: {
                create: {
                  status: "trialing",
                  trialStartDate: new Date(),
                  trialEndDate: trialEnd,
                },
              },
            },
          });
          user.id = newUser.id;
          user.role = newUser.role;
          user.subscriptionStatus = newUser.subscriptionStatus;
          user.trialEndDate = newUser.trialEndDate?.toISOString() ?? null;
        } else {
          user.id = existing.id;
          user.role = existing.role;
          user.subscriptionStatus = existing.subscriptionStatus;
          user.trialEndDate = existing.trialEndDate?.toISOString() ?? null;
        }
      }
      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.subscriptionStatus = user.subscriptionStatus;
        token.trialEndDate = user.trialEndDate;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      session.user.role = token.role as UserRole;
      session.user.subscriptionStatus =
        token.subscriptionStatus as SubscriptionStatus;
      session.user.trialEndDate = (token.trialEndDate as string) ?? null;
      return session;
    },
  },
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },
});
