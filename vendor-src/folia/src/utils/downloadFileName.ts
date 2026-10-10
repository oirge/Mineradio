// src/utils/downloadFileName.ts
// Turns a user-facing label into something an `a[download]` can carry on every OS.
const ILLEGAL = /[<>:"/\\|?*\u0000-\u001F]/g;

// Device names Windows reserves whatever the extension: `CON.lrc` is as unusable as `CON`.
const WINDOWS_RESERVED = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\..*)?$/i;

/**
 * Strips the characters Windows, macOS and Linux all refuse in a filename. Also collapses the
 * runs of whitespace left behind so `a - b` does not become `a___b`. Trailing dots and spaces go
 * too (Windows silently drops them, so the file would not keep the name it was given), and a
 * reserved device name such as `CON` gets a leading `_`.
 */
export const sanitizeDownloadFileName = (name: string, fallback = 'download'): string => {
    const cleaned = name.replace(ILLEGAL, '_').replace(/\s+/g, ' ').trim().replace(/[. ]+$/, '');
    if (!cleaned) return fallback;
    return WINDOWS_RESERVED.test(cleaned) ? `_${cleaned}` : cleaned;
};

/** Local `YYYY-MM-DD`, not `toISOString`: the latter is UTC and shifts a day for most users. */
export const formatLocalDateStamp = (date = new Date()): string => {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

/** Local `YYYY-MM-DD-HH-MM-SS`, not UTC-derived `toISOString`: it matches the user's wall clock and is filename-safe. */
export const formatLocalDateTimeStamp = (date = new Date()): string => {
    const pad = (n: number): string => `${n}`.padStart(2, '0');
    const month = pad(date.getMonth() + 1);
    const day = pad(date.getDate());
    const hours = pad(date.getHours());
    const minutes = pad(date.getMinutes());
    const seconds = pad(date.getSeconds());
    return `${date.getFullYear()}-${month}-${day}-${hours}-${minutes}-${seconds}`;
};
