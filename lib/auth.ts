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
          emailVerified: user.emailVerified,
          // Nunca a hash em si no objeto de sessão — só esta flag, o jwt()
          // reduz logo a seguir a um boolean antes de ir para o token.
          hasPassword: true,
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
        // Para OAuth/link mágico, `user` é a linha real do Prisma (o
        // adapter devolve-a tal e qual) — tem passwordHash de verdade
        // (null nesses casos). Para credenciais, authorize() já mandou uma
        // flag hasPassword em vez da hash, nunca a hash em si por aqui.
        const raw = user as unknown as {
          role: string;
          termsAcceptedAt?: Date | null;
          emailVerified?: Date | null;
          hasPassword?: boolean;
          passwordHash?: string | null;
        };
        const hasPassword = raw.hasPassword ?? Boolean(raw.passwordHash);
        token.id = user.id;
        token.role = raw.role;
        token.hasPassword = hasPassword;
        // Contas com password só contam como registadas depois de
        // confirmar o código por email — Google/link mágico já provam
        // dono do email só por completarem o respetivo fluxo.
        token.registered = Boolean(raw.termsAcceptedAt) && (hasPassword ? Boolean(raw.emailVerified) : true);
      } else if (trigger === "update" && token.id) {
        // Sessão já aberta (ex.: acabou de aceitar termos, verificar o
        // email, ou virar instrutor) — o JWT só refaz este pedido à BD
        // quando o cliente chama update() explicitamente.
        const dbUser = await prisma.user.findUnique({
          where: { id: token.id as string },
          select: { role: true, termsAcceptedAt: true, emailVerified: true, passwordHash: true },
        });
        if (dbUser) {
          const hasPassword = Boolean(dbUser.passwordHash);
          token.role = dbUser.role;
          token.hasPassword = hasPassword;
          token.registered = Boolean(dbUser.termsAcceptedAt) && (hasPassword ? Boolean(dbUser.emailVerified) : true);
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as string;
        session.user.registered = Boolean(token.registered);
        session.user.hasPassword = Boolean(token.hasPassword);
      }
      return session;
    },
  },
};
