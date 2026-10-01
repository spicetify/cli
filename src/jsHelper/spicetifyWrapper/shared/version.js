/**
 * Whether a dotted Spotify version such as "1.3.3.264" is older than `target`.
 * @param {string} version
 * @param {number[]} target
 */
export function isVersionBefore(version, target) {
  const parts = version.split(".").map((part) => Number.parseInt(part, 10) || 0);
  for (let i = 0; i < target.length; i++) {
    const part = parts[i] ?? 0;
    if (part !== target[i]) return part < target[i];
  }
  return false;
}
