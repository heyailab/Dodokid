// jwt.js
// Minimal HS256 JWT implementation using the Node crypto module.
// Used to issue custom login tokens and short-lived parent gate tokens.
// No external dependency keeps the cloud function lean and avoids supply-chain risk.

const crypto = require('crypto');
const config = require('../config');

function base64url(input) {
  return Buffer.from(input)
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
}

function fromBase64url(str) {
  const b64 = String(str).replace(/-/g, '+').replace(/_/g, '/');
  return Buffer.from(b64, 'base64').toString('utf8');
}

function encodeJson(obj) {
  return base64url(JSON.stringify(obj));
}

function sign(payload, ttlSec, secret) {
  const useSecret = secret || config.jwtSecret;
  if (!useSecret) throw new Error('JWT secret is not configured');
  const header = { alg: 'HS256', typ: 'JWT' };
  const nowSec = Math.floor(Date.now() / 1000);
  const body = Object.assign({}, payload, { iat: nowSec, exp: nowSec + ttlSec });
  const data = encodeJson(header) + '.' + encodeJson(body);
  const sig = crypto.createHmac('sha256', useSecret).update(data).digest();
  return data + '.' + base64url(sig);
}

function verify(token, secret) {
  const useSecret = secret || config.jwtSecret;
  if (!token || typeof token !== 'string') throw new Error('Invalid token');
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Malformed token');
  const [h, p, s] = parts;
  const expected = base64url(
    crypto.createHmac('sha256', useSecret).update(h + '.' + p).digest()
  );
  const a = Buffer.from(s);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
    throw new Error('Invalid signature');
  }
  const payload = JSON.parse(fromBase64url(p));
  const nowSec = Math.floor(Date.now() / 1000);
  if (payload.exp && nowSec > payload.exp) {
    throw new Error('Token expired');
  }
  return payload;
}

// Decode without verifying signature. Used by logout to read the jti of a token
// that may already be expired.
function decode(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  try {
    return JSON.parse(fromBase64url(parts[1]));
  } catch (e) {
    return null;
  }
}

module.exports = { sign, verify, decode };
