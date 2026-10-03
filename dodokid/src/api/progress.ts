/** 阅读进度 / 里程碑 服务封装 */
import { apiRequest } from './client';
import type { Milestone, ProgressSnapshot, ProgressUpsertReq, ReadProgress } from './types';

export const progressApi = {
  snapshot(childId: string) {
    return apiRequest<ProgressSnapshot>('GET', `/progress/${childId}`);
  },
  list(childId: string) {
    return apiRequest<ReadProgress[]>('GET', `/progress/${childId}/list`);
  },
  upsert(childId: string, req: ProgressUpsertReq) {
    return apiRequest<ReadProgress>('PUT', `/progress/${childId}`, req);
  },
};

export const milestoneApi = {
  list(childId: string) {
    return apiRequest<Milestone[]>('GET', `/milestones/${childId}`);
  },
};
