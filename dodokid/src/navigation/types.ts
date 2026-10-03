import type { AgeGroup } from '../api/types';

export type TabParamList = {
  Home: undefined;
  BookList: { ageGroup?: AgeGroup } | undefined;
  Habit: undefined;
  Parent: undefined;
};

export type RootStackParamList = {
  Onboarding: undefined;
  MainTabs: undefined;
  Blocked: undefined;
  BookReader: { id: string };
  /** 识字认知模块（路线图 P2） */
  Literacy: undefined;
  /** 数学启蒙模块（路线图 P2） */
  Math: undefined;
  /** 英语启蒙模块（路线图 P2） */
  English: undefined;
  /** 益智游戏（记忆翻牌，路线图 P2） */
  Puzzle: undefined;
  Settings: undefined;
  ParentGate: { reason?: 'eyeCare' | 'parentCenter' | 'settings' };
};
