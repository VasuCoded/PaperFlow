/**
 * Username accounts (migration 0019). Supabase password sign-in needs an
 * email, so a username account carries a synthetic address on a reserved TLD
 * that can never receive mail. People only ever see and type the username.
 *
 * Pure — safe in client and server code.
 */
export const USERNAME_EMAIL_DOMAIN = "users.paperflow.invalid";

/** 3–30 characters: lower-case letters, digits, dots and underscores; starts and ends with a letter or digit. Matches the database check. */
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._]{1,28}[a-z0-9]$/;

export function normaliseUsername(raw: string): string {
  return raw.trim().replace(/^@/, "").toLowerCase();
}

/** A reason the username is unacceptable, or null when it is fine. */
export function usernameProblem(raw: string): string | null {
  const u = normaliseUsername(raw);
  if (u.length < 3) return "Use at least 3 characters.";
  if (u.length > 30) return "Use at most 30 characters.";
  if (!USERNAME_PATTERN.test(u)) {
    return "Use only letters, numbers, dots and underscores, starting and ending with a letter or number.";
  }
  if (/[._]{2}/.test(u)) return "Don't put two dots or underscores in a row.";
  return null;
}

export function usernameToEmail(username: string): string {
  return `${normaliseUsername(username)}@${USERNAME_EMAIL_DOMAIN}`;
}

export function isUsernameEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${USERNAME_EMAIL_DOMAIN}`);
}

/**
 * What someone types to sign in, or to be invited: a username or a real email
 * address. Returns the address Supabase knows the account by.
 */
export function loginToEmail(login: string): string {
  const v = login.trim();
  return v.includes("@") && !v.startsWith("@") ? v.toLowerCase() : usernameToEmail(v);
}

/** How to show an account: "@username" for username accounts, else the email. */
export function displayIdentity(email: string | null | undefined, username?: string | null): string {
  if (username) return `@${username}`;
  if (!email) return "";
  if (isUsernameEmail(email)) return `@${email.slice(0, email.indexOf("@"))}`;
  return email;
}

/** Does a typed confirmation name this account, as email or as @username? */
export function confirmsIdentity(typed: string, email: string): boolean {
  const t = typed.trim().toLowerCase();
  if (!t) return false;
  return t === email.toLowerCase() || t === displayIdentity(email).toLowerCase() || `@${t}` === displayIdentity(email).toLowerCase();
}

export function passwordProblem(password: string): string | null {
  if (password.length < 8) return "Use at least 8 characters.";
  if (password.length > 72) return "Use at most 72 characters.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) return "Use at least one letter and one number.";
  return null;
}
