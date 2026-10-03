// request.js
// Small helpers to read client metadata from the proxy-injected headers.
// Used for audit log ip fields (Spec 14.4).

function getClientIp(headers) {
  const h = headers || {};
  const forwarded = h['x-forwarded-for'] || h['X-Forwarded-For'];
  if (forwarded) {
    const first = String(forwarded).split(',')[0].trim();
    if (first) return first;
  }
  return h['x-real-ip'] || h['X-Real-Ip'] || null;
}

module.exports = { getClientIp };
