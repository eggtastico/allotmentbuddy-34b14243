/**
 * Generate a UUID v4 compatible string.
 * Works in both secure (HTTPS) and insecure (HTTP) contexts.
 * Fallback for crypto.randomUUID() which requires secure context.
 */
export function generateId(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    try {
      return crypto.randomUUID();
    } catch {
      // Fallback if randomUUID fails
    }
  }

  // UUID v4 implementation using getRandomValues (works in all contexts)
  const template = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx';
  const arr = new Uint8Array(16);

  if (crypto && crypto.getRandomValues) {
    crypto.getRandomValues(arr);
  } else {
    // Last resort fallback: Math.random (less ideal but works everywhere)
    for (let i = 0; i < 16; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
  }

  let uuid = '';
  for (let i = 0; i < 16; i++) {
    const hex = arr[i].toString(16).padStart(2, '0');
    if (i === 4 || i === 6 || i === 8 || i === 10) {
      uuid += '-';
    }
    // Set version (4) and variant bits for UUID v4
    if (i === 6) {
      uuid += ((parseInt(hex, 16) & 0x0f) | 0x40).toString(16);
    } else if (i === 8) {
      uuid += ((parseInt(hex, 16) & 0x3f) | 0x80).toString(16);
    } else {
      uuid += hex;
    }
  }

  return uuid;
}
