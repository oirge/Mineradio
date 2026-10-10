// src/i18n/missingTranslation.ts
// Preserves runtime default text when neither the active locale nor the Chinese fallback has a key.

export const resolveMissingTranslation = (
  fallbacks: Record<string, string>,
  key: string,
  defaultValue?: string
): string => fallbacks[key] ?? defaultValue ?? key;
