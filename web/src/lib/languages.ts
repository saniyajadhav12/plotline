// TMDb uses a few non-standard language codes: "cn" is Cantonese, and "xx"
// means no spoken language (e.g. silent films), which we don't display.
const TMDB_LANGUAGE_OVERRIDES: Record<string, string | null> = { cn: "Cantonese", xx: null };

/** English name for a TMDb original-language code ("ko" -> "Korean"), or null
 *  when the code is missing, means "no language", or isn't recognised. */
export function languageName(code: string | null | undefined): string | null {
  if (!code) return null;
  const key = code.toLowerCase();
  if (key in TMDB_LANGUAGE_OVERRIDES) return TMDB_LANGUAGE_OVERRIDES[key];
  try {
    const name = new Intl.DisplayNames(["en"], { type: "language" }).of(key);
    return name && name.toLowerCase() !== key ? name : null;
  } catch {
    return null;
  }
}
