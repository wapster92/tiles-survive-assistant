import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

const passwordKeyLength = 64;
const tokenTtlMs = 30 * 24 * 60 * 60 * 1000;
const tokenSecret = process.env.AUTH_TOKEN_SECRET ?? 'dev-only-change-me';

export function normalizeUsername(value) {
  return String(value ?? '').trim().toLowerCase();
}

export function normalizeGameNickname(value) {
  return String(value ?? '').trim();
}

export function validateUsername(username) {
  return /^[a-zа-яё0-9_-]{3,32}$/i.test(username);
}

export function validateGameNickname(gameNickname) {
  return typeof gameNickname === 'string' && gameNickname.length >= 1 && gameNickname.length <= 32;
}

export function validatePassword(password) {
  return typeof password === 'string' && password.length >= 6 && password.length <= 128;
}

export function hashPassword(password) {
  const salt = randomBytes(16).toString('base64url');
  const hash = scryptSync(password, salt, passwordKeyLength).toString('base64url');
  return `scrypt:${salt}:${hash}`;
}

export function verifyPassword(password, storedHash) {
  const [algorithm, salt, hash] = String(storedHash ?? '').split(':');

  if (algorithm !== 'scrypt' || !salt || !hash) {
    return false;
  }

  const expected = Buffer.from(hash, 'base64url');
  const actual = scryptSync(password, salt, expected.length);

  return expected.length === actual.length && timingSafeEqual(expected, actual);
}

export function createAuthToken(user) {
  const payload = {
    sub: user.id,
    username: user.username,
    exp: Date.now() + tokenTtlMs
  };
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifyAuthToken(token) {
  const [encodedPayload, signature] = String(token ?? '').split('.');

  if (!encodedPayload || !signature || sign(encodedPayload) !== signature) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8'));

    if (!payload.sub || !payload.exp || Date.now() > payload.exp) {
      return null;
    }

    return payload;
  } catch {
    return null;
  }
}

function sign(value) {
  return createHmac('sha256', tokenSecret).update(value).digest('base64url');
}
