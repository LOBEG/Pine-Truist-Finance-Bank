import jwt from 'jsonwebtoken';
import { errors } from '@pine/lib-http';

function decodeKey(b64) {
  if (!b64) throw new Error('JWT key not configured.');
  return Buffer.from(b64, 'base64').toString('utf8');
}

export function createJwtSigner({ privateKeyB64, issuer, audience, accessTtlSeconds }) {
  const privateKey = decodeKey(privateKeyB64);
  return function sign(payload, { ttlSeconds = accessTtlSeconds, subject } = {}) {
    return jwt.sign(payload, privateKey, {
      algorithm: 'RS256',
      issuer,
      audience,
      subject,
      expiresIn: ttlSeconds,
    });
  };
}

export function createJwtVerifier({ publicKeyB64, issuer, audience }) {
  const publicKey = decodeKey(publicKeyB64);
  return function verify(token) {
    return jwt.verify(token, publicKey, {
      algorithms: ['RS256'],
      issuer,
      audience,
    });
  };
}

/**
 * Express middleware that requires a valid bearer JWT. On success populates
 * `req.user = { id, email, roles, permissions, sessionId }`.
 */
export function requireAuth(verify) {
  return (req, _res, next) => {
    const header = req.headers.authorization || '';
    const [scheme, token] = header.split(' ');
    if (scheme !== 'Bearer' || !token) {
      return next(errors.unauthorized('missing_bearer', 'Missing bearer token.'));
    }
    try {
      const claims = verify(token);
      req.user = {
        id: claims.sub,
        email: claims.email,
        roles: claims.roles || [],
        permissions: claims.permissions || [],
        sessionId: claims.sid,
        mfaVerified: !!claims.mfa,
      };
      next();
    } catch (err) {
      next(errors.unauthorized('invalid_token', `Invalid token: ${err.message}`));
    }
  };
}
