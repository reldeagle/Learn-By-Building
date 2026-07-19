import { withAuth } from "next-auth/middleware";

const deploymentUrl =
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
const sessionCookieName = `${
  deploymentUrl?.startsWith("https://") ? "__Secure-" : ""
}learn-by-building.session-token`;

export default withAuth({
  cookies: { sessionToken: { name: sessionCookieName } },
  pages: { signIn: "/signin" },
});

export const config = {
  matcher: ["/start", "/project/:path*", "/track"],
};
