/**
 * crypto.randomUUID() only exists in secure contexts (HTTPS or localhost).
 * When the dev server is reached over LAN HTTP (e.g. iPad testing), it's
 * undefined, so fall back to a non-cryptographic UUID-shaped string. These
 * ids are only ever used as local React keys, never persisted, so this is safe.
 */
export function randomId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
