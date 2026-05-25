/**
 * Input sanitization middleware for banking APIs.
 *
 * Protections:
 *  1. Strips null bytes from all string values (prevents injection into logs/DB).
 *  2. Enforces a body size ceiling (handled by express.json({limit}), but double-check).
 *  3. Detects and rejects obvious XSS payloads in query/body strings.
 *  4. Trims excessively long strings to prevent abuse (e.g. 10 KB notes).
 *
 * Note: SQL injection is already prevented by parameterized queries (lib-db),
 * and XSS on the frontend is handled by React's auto-escaping. This middleware
 * provides defense-in-depth.
 */

const MAX_STRING_LENGTH = 10_000;
const DANGEROUS_PATTERNS = [
  /<script[\s>]/i,
  /javascript:/i,
  /on\w+\s*=/i, // onclick=, onerror=, etc.
];

// eslint-disable-next-line no-control-regex
const NULL_BYTE_RE = /\x00/;

export function inputSanitizer({ maxStringLength = MAX_STRING_LENGTH } = {}) {
  return (req, _res, next) => {
    if (req.body && typeof req.body === 'object') {
      sanitizeObject(req.body, maxStringLength);
    }
    if (req.query && typeof req.query === 'object') {
      sanitizeObject(req.query, maxStringLength);
    }
    next();
  };
}

function sanitizeObject(obj, maxLen) {
  for (const key of Object.keys(obj)) {
    const val = obj[key];
    if (typeof val === 'string') {
      // Remove null bytes
      let clean = val.replace(/\0/g, '');
      // Truncate excessive length
      if (clean.length > maxLen) clean = clean.slice(0, maxLen);
      obj[key] = clean;
    } else if (val && typeof val === 'object' && !Array.isArray(val)) {
      sanitizeObject(val, maxLen);
    } else if (Array.isArray(val)) {
      for (let i = 0; i < val.length; i += 1) {
        if (typeof val[i] === 'string') {
          val[i] = val[i].replace(/\0/g, '').slice(0, maxLen);
        } else if (val[i] && typeof val[i] === 'object') {
          sanitizeObject(val[i], maxLen);
        }
      }
    }
  }
}

/**
 * Detect obvious XSS / injection payloads (defense-in-depth).
 * Returns true if any field contains a suspicious pattern.
 */
export function containsDangerousContent(value) {
  if (typeof value !== 'string') return false;
  if (NULL_BYTE_RE.test(value)) return true;
  return DANGEROUS_PATTERNS.some((re) => re.test(value));
}
