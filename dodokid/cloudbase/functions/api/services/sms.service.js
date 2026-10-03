// sms.service.js
// SMS provider abstraction.
// The "log" provider is for development and prints the code so it can be used
// in manual tests. The "tencent" provider is a stub: wire it to
// tencentcloud-sdk-nodejs-sms in production. We intentionally do not call a
// non-existent API here.

const config = require('../config');

async function send(phone, code) {
  if (config.smsProvider === 'tencent') {
    // Example wiring (left for the operator to complete with real credentials):
    //   const sms = require('tencentcloud-sdk-nodejs-sms');
    //   const client = new sms.Client({ credential: { secretId, secretKey },
    //     region: 'ap-guangzhou', profile: { httpProfile: { endpoint: 'sms.tencentcloudapi.com' } } });
    //   await client.SendSms({ PhoneNumberSet: ['+86' + phone], ... });
    throw new Error('SMS_PROVIDER=tencent requires tencentcloud-sdk-nodejs-sms integration (see README)');
  }
  // Development provider: log the code so it can be used in tests/manual runs.
  console.log('[sms:dev] verification code ' + code + ' for ' + phone);
  return true;
}

module.exports = { send };
