import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { z } from "zod";

import { UserRepository } from "../data/repositories";

const credentialsSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});
const deploymentUrl =
  process.env.NEXTAUTH_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : undefined);
const useSecureCookies = deploymentUrl?.startsWith("https://") ?? false;
const cookiePrefix = useSecureCookies ? "__Secure-" : "";
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: useSecureCookies,
};
const demoPassword = process.env.AUTH_DEMO_PASSWORD;

if (process.env.NODE_ENV === "production" && !demoPassword) {
  throw new Error("AUTH_DEMO_PASSWORD is required in production.");
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "UnauthorizedError";
  }
}

export const authOptions: NextAuthOptions = {
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: `${cookiePrefix}learn-by-building.session-token`,
      options: cookieOptions,
    },
    callbackUrl: {
      name: `${cookiePrefix}learn-by-building.callback-url`,
      options: { ...cookieOptions, httpOnly: false },
    },
    csrfToken: {
      name: `${cookiePrefix}learn-by-building.csrf-token`,
      options: cookieOptions,
    },
  },
  providers: [
    CredentialsProvider({
      name: "Development credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        const result = credentialsSchema.safeParse(credentials);

        if (
          !result.success ||
          !demoPassword ||
          result.data.password !== demoPassword
        ) {
          return null;
        }

        const user = await new UserRepository().upsertByEmail(
          result.data.email,
        );

        return { id: user.id, email: user.email };
      },
    }),
  ],
};

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    throw new UnauthorizedError();
  }

  const user = await new UserRepository().findByEmail(email);

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}
