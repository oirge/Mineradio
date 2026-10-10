// electron/linuxPasswordStore.cjs
//
// Chromium picks its Linux password backend from `XDG_CURRENT_DESKTOP` and falls back to the
// plaintext `basic_text` store for every desktop it does not recognise (Hyprland, sway, i3, river…).
// Folia's KuGou and QQ repositories refuse `basic_text` on purpose, so those users silently lose
// their logins on every restart even though a Secret Service is running. Selecting the libsecret
// backend explicitly restores persistence; when no Secret Service answers, Chromium reports the
// encryption as unavailable and the repositories degrade exactly as they do today.

// KDE ships its own kwallet backend, and forcing libsecret there would orphan credentials that were
// already written to the wallet, so KDE sessions keep Chromium's own detection.
const KDE_DESKTOP_PATTERN = /^kde$/i;

const SUPPORTED_BACKENDS = new Set([
  'basic',
  'gnome-libsecret',
  'kwallet',
  'kwallet5',
  'kwallet6',
]);

const hasPasswordStoreArgument = argv => argv.some(
  arg => arg === '--password-store' || String(arg).startsWith('--password-store='),
);

const isKdeSession = desktop => String(desktop || '')
  .split(':')
  .some(part => KDE_DESKTOP_PATTERN.test(part.trim()));

/**
 * Returns the `--password-store` value Folia should append, or `null` to leave Chromium's own
 * detection untouched.
 */
function resolveLinuxPasswordStore({ platform = process.platform, env = process.env, argv = process.argv } = {}) {
  if (platform !== 'linux') return null;
  // An explicit launch flag always wins so users can debug or opt out without editing the app.
  if (hasPasswordStoreArgument(argv)) return null;

  const override = String(env.FOLIA_PASSWORD_STORE || '').trim();
  if (override) {
    if (override === 'auto') return null;
    return SUPPORTED_BACKENDS.has(override) ? override : null;
  }

  if (isKdeSession(env.XDG_CURRENT_DESKTOP)) return null;
  return 'gnome-libsecret';
}

module.exports = {
  SUPPORTED_BACKENDS,
  resolveLinuxPasswordStore,
};
