type FastAPIValidationError = {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
};

/**
 * FastAPI returns `detail` as a plain string for most errors, but as an
 * array of validation error objects for 422s. Normalize both into a
 * single readable string.
 */
export function parseErrorDetail(detail: unknown): string {
  if (typeof detail === "string") {
    return detail;
  }

  if (Array.isArray(detail)) {
    const messages = (detail as FastAPIValidationError[]).map((err) => {
      const field = err.loc?.[err.loc.length - 1];
      return field ? `${field}: ${err.msg}` : err.msg;
    });
    return messages.join(" ");
  }

  return "Something went wrong. Please try again.";
}
