// US-01: helpers for sign-in and sign-up that don't touch the network.

/** Only same-site paths are allowed after sign-in, so a link can't bounce a landlord elsewhere. */
export function safeNext(next: string | null | undefined): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) return "/";
  return next;
}

type AuthErrorLike = { code?: string; message?: string; status?: number } | Error;

export const NETWORK_ERROR = "Can't reach the server. Check your connection and try again.";

/** Turns a Supabase Auth error into a sentence that says what went wrong and what to do. */
export function authErrorMessage(error: AuthErrorLike): string {
  const code = "code" in error ? error.code : undefined;
  const message = error.message ?? "";
  if (error instanceof TypeError || /fetch failed|network/i.test(message)) return NETWORK_ERROR;
  switch (code) {
    case "invalid_credentials":
      return "Email or password is incorrect";
    case "user_already_exists":
    case "email_exists":
      return "An account with this email already exists. Sign in instead.";
    case "weak_password":
      return "Use a password of at least 8 characters";
    case "email_address_invalid":
    case "validation_failed":
      return "Enter a valid email address";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "Too many attempts. Wait a minute and try again.";
  }
  return "Something went wrong signing you in. Try again.";
}
