import type { AuthOptions } from "next-auth";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import EmailProvider from "next-auth/providers/email";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { loginSchema } from "@/lib/validations";
import { isRateLimited } from "@/lib/rateLimit";

const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_ATTEMPTS = 8;

export const authOptions: AuthOptions = {
  adapter: PrismaAdapter(prisma),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        if (isRateLimited(`login:${parsed.data.email.toLowerCase()}`, LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS)) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: parsed.data.email },
        });
        if (!user || !user.passwordHash) return null;

        const isValid = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!isValid) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          termsAcceptedAt: user.termsAcceptedAt,
        };
      },
    }),
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),
    EmailProvider({
      server: process.env.EMAIL_SERVER,
      from: process.env.EMAIL_FROM,
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role: string }).role;
        token.registered = Boolean((user as { termsAcceptedAt?: Date | null }).termsAcceptedAt);
      } else if (trigger === "update" && token.id) {
        // Sessão já aberta (ex.: conta Google que acabou de virar
        // instrutor, ou aceitou os termos, em /register/complete) — o JWT
        // só refaz este pedido à BD quando o cliente chama update() explicitamente.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, termsAcceptedAt: true },
        });
        if (dbUser) {
          token.role = dbUser.role;
          token.registered = Boolean(dbUser.termsAcceptedAt);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.registered = Boolean(token.registered);
      }
      return session;
    },
  },
};
