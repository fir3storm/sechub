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

      const mustChangePassword = !!auth?.user?.mustChangePassword;
      const isAccountPage = request.nextUrl.pathname.startsWith("/app/account");
      if (isLoggedIn && mustChangePassword && isAppRoute && !isAccountPage) {
        return Response.redirect(new URL("/app/account", request.nextUrl));
      }

      if (isLoginPage && isLoggedIn) {
        return Response.redirect(new URL("/app", request.nextUrl));
      }
      return true;
    },
    jwt({ token, user, trigger, session }) {
      if (user) {
        token.id = user.id!;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword ?? false;
      }
      if (trigger === "update" && session?.user?.mustChangePassword !== undefined) {
        token.mustChangePassword = session.user.mustChangePassword;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        session.user.role = token.role as import("@prisma/client").Role;
        session.user.mustChangePassword = !!token.mustChangePassword;
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
