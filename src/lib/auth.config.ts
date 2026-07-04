import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = !!auth?.user;
      const isAppRoute = request.nextUrl.pathname.startsWith("/app");
      const isLoginPage = request.nextUrl.pathname === "/login";

      if (isAppRoute && !isLoggedIn) return false;
      if (isLoginPage && isLoggedIn) {
        return Response.redirect(new URL("/app", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as import("@prisma/client").Role;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
