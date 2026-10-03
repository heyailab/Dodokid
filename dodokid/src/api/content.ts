/** 内容 / 绘本 服务封装（年龄路由 + 试读样章 + 离线兜底） */
import { apiRequest } from './client';
import * as offline from '../lib/offline';
import { isConnected } from '../lib/net';
import type { ContentCategory, ContentItem, ContentListQuery } from './types';

export const contentApi = {
  list(query: ContentListQuery = {}) {
    return apiRequest<ContentItem[]>('GET', '/content/list', undefined, {
      ageGroup: query.ageGroup,
      module: query.module,
    });
  },
  get(id: string) {
    // 离线兜底：请求失败且当前离线时，回退到本地缓存（AC-07）
    return apiRequest<ContentItem>('GET', `/content/${id}`).catch(async (err) => {
      if (!(await isConnected())) {
        const cached = await offline.getCachedContent(id);
        if (cached) return cached;
      }
      throw err;
    });
  },
  /** v1.2.1：试读样章（后台可配置 isSample，首页试读入口使用）。 */
  samples(ageGroup?: string) {
    return apiRequest<ContentItem[]>('GET', '/content/samples', undefined, ageGroup ? { ageGroup } : undefined).then(
      (items) =>
        items.map((it) => ({ ...it, sample: (it as ContentItem & { isSample?: boolean }).isSample ?? it.sample })),
    );
  },
  search(keyword: string) {
    return apiRequest<ContentItem[]>('GET', '/content/search', undefined, {
      keyword,
    });
  },
  categories() {
    return apiRequest<ContentCategory[]>('GET', '/content/categories');
  },
  mediaUrl(contentId: string, page: number) {
    return apiRequest<string>('GET', '/content/mediaUrl', undefined, {
      contentId,
      page,
    });
  },
};
