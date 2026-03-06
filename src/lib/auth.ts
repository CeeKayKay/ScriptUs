import { NextAuthOptions } from "next-auth";
import { PrismaAdapter } from "@auth/prisma-adapter";
import GoogleProvider from "next-auth/providers/google";
import GithubProvider from "next-auth/providers/github";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "./prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma) as any,
  providers: [
    // Google OAuth
    ...(process.env.GOOGLE_CLIENT_ID
      ? [
          GoogleProvider({
            clientId: process.env.GOOGLE_CLIENT_ID!,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
          }),
        ]
      : []),

    // GitHub OAuth
    ...(process.env.GITHUB_CLIENT_ID
      ? [
          GithubProvider({
            clientId: process.env.GITHUB_CLIENT_ID!,
            clientSecret: process.env.GITHUB_CLIENT_SECRET!,
          }),
        ]
      : []),

    // Email + password credentials provider
    CredentialsProvider({
      name: "Email",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
        name: { label: "Name", type: "text" },
        isSignUp: { label: "Sign Up", type: "text" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const email = credentials.email.trim().toLowerCase();
        const password = credentials.password;
        const isSignUp = credentials.isSignUp === "true";

        if (isSignUp) {
          // Creating a new account
          const existing = await prisma.user.findUnique({ where: { email } });
          if (existing) {
            throw new Error("An account with this email already exists. Please sign in.");
          }

          const name = credentials.name?.trim() || email.split("@")[0];
          const hash = await bcrypt.hash(password, 12);

          const user = await prisma.user.create({
            data: { email, name, password: hash },
          });

          return { id: user.id, email: user.email, name: user.name };
        } else {
          // Signing in
          const user = await prisma.user.findUnique({ where: { email } });
          if (!user || !user.password) {
            throw new Error("No account found with this email.");
          }

          const valid = await bcrypt.compare(password, user.password);
          if (!valid) {
            throw new Error("Incorrect password.");
          }

          return { id: user.id, email: user.email, name: user.name };
        }
      },
    }),
  ],

  session: {
    strategy: "jwt",
  },

  callbacks: {
    async session({ session, token }) {
      if (session.user && token.sub) {
        (session.user as any).id = token.sub;
      }
      return session;
    },
    async jwt({ token, user }) {
      if (user) {
        token.sub = user.id;
      }
      return token;
    },
  },

};
