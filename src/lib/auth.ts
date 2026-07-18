import { getServerSession, type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import GoogleProvider from "next-auth/providers/google";
import { z } from "zod";

import { UserRepository } from "../data/repositories";
import {
  createRequestLogContext,
  logEvent,
  withRequestLogContext,
} from "./logger";

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
const googleClientId = process.env.GOOGLE_CLIENT_ID;
const googleClientSecret = process.env.GOOGLE_CLIENT_SECRET;
const googleSignInEnabled = Boolean(googleClientId && googleClientSecret);
const developmentCredentialsEnabled =
  process.env.NODE_ENV !== "production" && Boolean(demoPassword);

export function getAuthProviderAvailability() {
  return {
    developmentCredentials: developmentCredentialsEnabled,
    google: googleSignInEnabled,
  };
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication is required.");
    this.name = "UnauthorizedError";
  }
}

export const authOptions: NextAuthOptions = {
  callbacks: {
    async signIn({ account, user }) {
      if (account?.provider !== "google") {
        return true;
      }

      return withRequestLogContext(
        createRequestLogContext("auth_google"),
        async () => {
          if (!user.email) {
            logEvent("auth.google", { outcome: "denied" });
            return false;
          }

          try {
            await new UserRepository().upsertByEmail(user.email);
            logEvent("auth.google", { outcome: "success" });
            return true;
          } catch (error) {
            logEvent("auth.google", {
              outcome: "error",
              errorType:
                error instanceof Error ? error.constructor.name : "unknown",
            });
            return false;
          }
        },
      );
    },
  },
  session: { strategy: "jwt" },
  pages: { signIn: "/signin" },
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
    ...(googleSignInEnabled
      ? [
          GoogleProvider({
            clientId: googleClientId!,
            clientSecret: googleClientSecret!,
          }),
        ]
      : []),
    ...(developmentCredentialsEnabled
      ? [
          CredentialsProvider({
            name: "Development credentials",
            credentials: {
              email: { label: "Email", type: "email" },
              password: { label: "Password", type: "password" },
            },
            async authorize(credentials) {
              return withRequestLogContext(
                createRequestLogContext("auth_authorize"),
                async () => {
                  const result = credentialsSchema.safeParse(credentials);

                  if (
                    !result.success ||
                    !demoPassword ||
                    result.data.password !== demoPassword
                  ) {
                    logEvent("auth.authorize", { outcome: "denied" });
                    return null;
                  }

                  try {
                    const user = await new UserRepository().upsertByEmail(
                      result.data.email,
                    );

                    logEvent("auth.authorize", { outcome: "success" });
                    return { id: user.id, email: user.email };
                  } catch (error) {
                    logEvent("auth.authorize", {
                      outcome: "error",
                      errorType:
                        error instanceof Error
                          ? error.constructor.name
                          : "unknown",
                    });
                    throw error;
                  }
                },
              );
            },
          }),
        ]
      : []),
  ],
};

export async function requireUser() {
  const session = await getServerSession(authOptions);
  const email = session?.user?.email;

  if (!email) {
    logEvent("auth.session", { outcome: "missing" });
    throw new UnauthorizedError();
  }

  const user = await new UserRepository().findByEmail(email);

  if (!user) {
    logEvent("auth.session", { outcome: "user_not_found" });
    throw new UnauthorizedError();
  }

  return user;
}
