/** TanStack Query 数据钩子（服务端缓存 + 离线失效） */
import { useQuery } from '@tanstack/react-query';
import { contentApi } from './content';
import { milestoneApi, progressApi } from './progress';
import { parentApi } from './parent';
import { systemApi } from './system';
import type { AgeGroup } from './types';

export function useContentList(ageGroup?: AgeGroup) {
  return useQuery({
    queryKey: ['content', 'list', ageGroup ?? 'all'],
    queryFn: () => contentApi.list(ageGroup ? { ageGroup } : {}),
    staleTime: 5 * 60_000,
  });
}

export function useContent(id: string) {
  return useQuery({
    queryKey: ['content', id],
    queryFn: () => contentApi.get(id),
    enabled: !!id,
  });
}

export function useProgress(childId: string) {
  return useQuery({
    queryKey: ['progress', childId],
    queryFn: () => progressApi.snapshot(childId),
    enabled: !!childId,
    refetchInterval: 30_000,
  });
}

export function useMilestones(childId: string) {
  return useQuery({
    queryKey: ['milestones', childId],
    queryFn: () => milestoneApi.list(childId),
    enabled: !!childId,
  });
}

export function useParentSettings() {
  return useQuery({
    queryKey: ['parent', 'settings'],
    queryFn: () => parentApi.getSettings(),
  });
}

export function useWeekReport(childId: string) {
  return useQuery({
    queryKey: ['report', 'week', childId],
    queryFn: () => systemApi.getWeekReport(childId),
    enabled: !!childId,
  });
}
