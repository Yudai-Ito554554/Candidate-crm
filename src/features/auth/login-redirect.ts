import type { Location } from "react-router-dom";

/** Where the login screen sends a user who arrived without a remembered route. */
export const DEFAULT_LOGIN_REDIRECT = "/";

/**
 * Routes that must never become a post-login destination. `/login` and
 * `/forgot-password` would loop, and `/set-password` only works with the
 * session an invite or recovery deep link installs.
 */
const EXCLUDED_REDIRECT_PATHS = new Set([
  "/login",
  "/forgot-password",
  "/set-password",
]);

export interface LoginRedirectState {
  from: string;
}

function hasControlCharacter(value: string) {
  for (const character of value) {
    const code = character.codePointAt(0) ?? 0;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

/**
 * Records the route a protected navigation was refused at, so the login screen
 * can return there once a session exists.
 */
export function toLoginRedirectState(
  location: Pick<Location, "hash" | "pathname" | "search">,
): LoginRedirectState {
  return { from: `${location.pathname}${location.search}${location.hash}` };
}

/**
 * Resolves the router state carried into `/login` into an in-application path.
 * Anything that is not a plain internal route falls back to the home route, so
 * a crafted state value cannot turn the login screen into an open redirect.
 */
export function resolveLoginRedirect(state: unknown): string {
  if (typeof state !== "object" || state === null)
    return DEFAULT_LOGIN_REDIRECT;

  const { from } = state as Partial<LoginRedirectState>;
  if (typeof from !== "string") return DEFAULT_LOGIN_REDIRECT;
  if (!from.startsWith("/")) return DEFAULT_LOGIN_REDIRECT;
  // "//host" and "/\host" are protocol-relative once the History API sees them.
  if (from.startsWith("//") || from.startsWith("/\\"))
    return DEFAULT_LOGIN_REDIRECT;
  if (hasControlCharacter(from)) return DEFAULT_LOGIN_REDIRECT;

  const [pathname] = from.split(/[?#]/);
  if (EXCLUDED_REDIRECT_PATHS.has(pathname)) return DEFAULT_LOGIN_REDIRECT;

  return from;
}
