// phone.js
// Phone number validation and SMS code generation helpers.

// Mainland China mobile number format. Adjust if other regions are supported.
function isValidPhone(phone) {
  if (typeof phone !== 'string') return false;
  return /^1[3-9]\d{9}$/.test(phone.trim());
}

function generateCode(length) {
  const len = length && length > 0 ? length : 6;
  let code = '';
  for (let i = 0; i < len; i += 1) {
    code += Math.floor(Math.random() * 10);
  }
  return code;
}

// Mask the middle digits of a phone number for privacy in API responses.
function maskPhone(phone) {
  if (typeof phone !== 'string' || phone.length < 7) return phone;
  return phone.replace(/(\d{3})\d+(\d{4})/, '$1****$2');
}

module.exports = { isValidPhone, generateCode, maskPhone };
