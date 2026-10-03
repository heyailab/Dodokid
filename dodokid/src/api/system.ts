/** 系统类：同意记录 / 偏好 / 反馈 / 版本 / 隐私政策 / 周报 */
import { apiRequest } from './client';
import type {
  ConsentRecord,
  FeedbackReq,
  PreferencesUpdateReq,
  PrivacyPolicy,
  VersionInfo,
  WeekReport,
} from './types';

export const systemApi = {
  recordConsent(req: ConsentRecord) {
    return apiRequest<ConsentRecord>('POST', '/consent/record', req);
  },
  updatePreferences(req: PreferencesUpdateReq) {
    return apiRequest<null>('PUT', '/preferences', req);
  },
  postFeedback(req: FeedbackReq) {
    return apiRequest<null>('POST', '/feedback', req);
  },
  getVersion() {
    return apiRequest<VersionInfo>('GET', '/version');
  },
  getPrivacyPolicy() {
    return apiRequest<PrivacyPolicy>('GET', '/privacyPolicy');
  },
  getWeekReport(childId: string) {
    return apiRequest<WeekReport>('GET', `/report/week/${childId}`);
  },
};
