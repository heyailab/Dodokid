// response.js
// Unified API response builder. Enforces the contract:
//   { success, code, message, data }

function ok(data, message) {
  return {
    success: true,
    code: 0,
    message: message || 'ok',
    data: data === undefined ? null : data,
  };
}

function fail(code, message, data) {
  return {
    success: false,
    code,
    message,
    data: data === undefined ? null : data,
  };
}

module.exports = { ok, fail };
