/**
 * 护眼防沉迷 Store（P0 全局）。
 * - 当日在内容活跃时累计计时；
 * - 单次连续使用达 15min 触发软提示（softPrompted）；
 * - 当日累计达上限 → isBlocked=true，播放温和晚安提示并停止内容，
 *   界面仅留家长验证入口，儿童不可跳过（unblock 仅由家长锁成功后调用）。
 */
import { create } from 'zustand';
import { eyeCare } from '../design/tokens';

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

interface EyeCareState {
  dailyLimitSec: number;
  dailyUsedSec: number;
  singleSessionSec: number;
  isBlocked: boolean;
  softPrompted: boolean;
  lastResetDay: string;
  /** 是否处于内容消费路由（绘本/儿歌/习惯等计入护眼计时；家长中心不计入） */
  contentActive: boolean;
  setContentActive: (v: boolean) => void;
  setLimit: (sec: number) => void;
  /** 内容活跃时每秒 +1 */
  tick: () => void;
  /** 切换页面/暂停时累加单次会话时长 */
  addSession: (sec: number) => void;
  resetDailyIfNeeded: () => void;
  block: () => void;
  /** 仅家长锁验证成功后调用，给当日新的额度 */
  unblock: () => void;
  resetSoftPrompt: () => void;
}

export const useEyeCareStore = create<EyeCareState>((set, get) => ({
  dailyLimitSec: eyeCare.defaultDailyLimitSec,
  dailyUsedSec: 0,
  singleSessionSec: 0,
  isBlocked: false,
  softPrompted: false,
  lastResetDay: todayKey(),
  contentActive: false,

  setContentActive(v) {
    set({ contentActive: v });
  },

  setLimit(sec) {
    set({ dailyLimitSec: Math.max(60, sec) });
  },

  tick() {
    const s = get();
    if (s.isBlocked) return;
    const dailyUsedSec = s.dailyUsedSec + 1;
    const singleSessionSec = s.singleSessionSec + 1;
    const reachedLimit = dailyUsedSec >= s.dailyLimitSec;
    const softPrompted =
      s.softPrompted ||
      (singleSessionSec >= eyeCare.singleSessionSoftLimitSec && !reachedLimit);
    set({
      dailyUsedSec,
      singleSessionSec,
      isBlocked: reachedLimit,
      softPrompted,
    });
  },

  addSession(sec) {
    const s = get();
    if (s.isBlocked) return;
    const singleSessionSec = s.singleSessionSec + sec;
    set({
      singleSessionSec,
      softPrompted:
        s.softPrompted ||
        (singleSessionSec >= eyeCare.singleSessionSoftLimitSec &&
          s.dailyUsedSec < s.dailyLimitSec),
    });
  },

  resetDailyIfNeeded() {
    const key = todayKey();
    if (get().lastResetDay !== key) {
      set({
        lastResetDay: key,
        dailyUsedSec: 0,
        singleSessionSec: 0,
        isBlocked: false,
        softPrompted: false,
      });
    }
  },

  block() {
    set({ isBlocked: true });
  },

  unblock() {
    set({
      isBlocked: false,
      dailyUsedSec: 0,
      singleSessionSec: 0,
      softPrompted: false,
    });
  },

  resetSoftPrompt() {
    set({ softPrompted: false });
  },
}));
