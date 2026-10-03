/** 儿童档案服务封装（创建前需同意记录，不采集位置/麦克风/通讯录） */
import { apiRequest } from './client';
import type { ChildCreateReq, ChildProfile } from './types';

export const childApi = {
  create(req: ChildCreateReq) {
    return apiRequest<ChildProfile>('POST', '/child/create', req);
  },
  switch(childId: string) {
    return apiRequest<ChildProfile>('POST', '/child/switch', { childId });
  },
  list() {
    return apiRequest<ChildProfile[]>('GET', '/child/list');
  },
  get(id: string) {
    return apiRequest<ChildProfile | null>('GET', `/child/${id}`);
  },
  update(id: string, patch: Partial<ChildProfile>) {
    return apiRequest<ChildProfile | null>('PUT', `/child/${id}`, patch);
  },
  remove(id: string) {
    return apiRequest<null>('DELETE', `/child/${id}`);
  },
};
