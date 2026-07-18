export function getSafeCallbackPath(callbackUrl?: string) {
  if (
    !callbackUrl ||
    !callbackUrl.startsWith("/") ||
    callbackUrl.startsWith("//") ||
    callbackUrl.startsWith("/\\")
  ) {
    return "/track";
  }

  return callbackUrl;
}

export function getSignInUrl(callbackPath: string) {
  return `/signin?callbackUrl=${encodeURIComponent(
    getSafeCallbackPath(callbackPath),
  )}`;
}
