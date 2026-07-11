const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Formats a byte count as a human-readable string, e.g. `104 GB`. */
export function formatBytes(bytes: number, fractionDigits = 0): string {
  if (bytes <= 0) return '0 B';
  const exponent = Math.min(Math.floor(Math.log2(bytes) / 10), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value.toFixed(exponent === 0 ? 0 : fractionDigits)} ${UNITS[exponent]}`;
}

/** Splits a formatted byte string into number and unit for layouts that
 * style the two parts differently (e.g. "472 GB" -> ["472", "GB"]). */
export function splitBytes(bytes: number): [string, string] {
  const [value, unit] = formatBytes(bytes).split(' ');
  return [value, unit];
}
