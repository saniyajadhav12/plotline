/** Same limits as the backend's password schemas: Field(min_length=8, max_length=72). */
export const MIN_PASSWORD_LENGTH = 8;
export const MAX_PASSWORD_LENGTH = 72;

/** Same wording as the backend's error, so the user sees one consistent message. */
export const SAME_PASSWORD_MESSAGE = "New password must be different from your current password.";

/** Returns an error message for a proposed new password, or "" if it's acceptable. */
export function newPasswordError(password: string): string {
  if (password.length < MIN_PASSWORD_LENGTH) return `Use at least ${MIN_PASSWORD_LENGTH} characters.`;
  if (password.length > MAX_PASSWORD_LENGTH) return `Use at most ${MAX_PASSWORD_LENGTH} characters.`;
  return "";
}
