/** 家长 / 鉴权 / 家长锁 / 护眼设置 服务封装 */
import { apiRequest } from './client';
import type {
  AuthResult,
  GateVerifyReq,
  GateVerifyResult,
  ParentSettings,
  SendSmsReq,
  TimeLimitUpdateReq,
  VerifyCodeReq,
  ParentLoginReq,
  ParentRegisterReq,
} from './types';

export const parentApi = {
  register(req: ParentRegisterReq) {
    return apiRequest<AuthResult>('POST', '/parent/register', req);
  },
  login(req: ParentLoginReq) {
    return apiRequest<AuthResult>('POST', '/parent/login', req);
  },
  logout() {
    return apiRequest<null>('POST', '/parent/logout');
  },
  sendSmsCode(req: SendSmsReq) {
    return apiRequest<{ sent: boolean }>('POST', '/parent/sendSmsCode', req);
  },
  verifyCode(req: VerifyCodeReq) {
    return apiRequest<{ ok: boolean }>('POST', '/parent/verifyCode', req);
  },
  getSettings() {
    return apiRequest<ParentSettings>('GET', '/parent/settings');
  },
  updateTimeLimit(req: TimeLimitUpdateReq) {
    return apiRequest<ParentSettings>('PUT', '/parent/settings/timeLimit', req);
  },
  verifyGate(req: GateVerifyReq) {
    return apiRequest<GateVerifyResult>('POST', '/parent/gate/verify', req);
  },
};
