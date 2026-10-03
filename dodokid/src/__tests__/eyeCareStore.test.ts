/**
 * AC-04 护眼防沉迷单测：日限阻断、单次软提示、阻断后不再累加、
 * 家长锁解锁重置、额度下限。
 */
import { useEyeCareStore } from '../store/eyeCareStore';
import { eyeCare } from '../design/tokens';

const initial = {
  dailyLimitSec: eyeCare.defaultDailyLimitSec,
  dailyUsedSec: 0,
  singleSessionSec: 0,
  isBlocked: false,
  softPrompted: false,
};

describe('eyeCareStore (AC-04)', () => {
  beforeEach(() => useEyeCareStore.setState({ ...initial }));

  it('单次连续使用达 15 分钟触发软提示（且未阻断）', () => {
    for (let i = 0; i < eyeCare.singleSessionSoftLimitSec; i += 1) {
      useEyeCareStore.getState().tick();
    }
    const s = useEyeCareStore.getState();
    expect(s.softPrompted).toBe(true);
    expect(s.isBlocked).toBe(false);
  });

  it('当日累计达上限即阻断，阻断后 tick 不再累加', () => {
    for (let i = 0; i < eyeCare.defaultDailyLimitSec; i += 1) {
      useEyeCareStore.getState().tick();
    }
    expect(useEyeCareStore.getState().isBlocked).toBe(true);
    expect(useEyeCareStore.getState().dailyUsedSec).toBe(eyeCare.defaultDailyLimitSec);

    useEyeCareStore.getState().tick();
    expect(useEyeCareStore.getState().dailyUsedSec).toBe(eyeCare.defaultDailyLimitSec);
  });

  it('阻断后 addSession 同样不再累加单次会话时长', () => {
    useEyeCareStore.setState({ isBlocked: true });
    useEyeCareStore.getState().addSession(120);
    expect(useEyeCareStore.getState().singleSessionSec).toBe(0);
  });

  it('unblock（家长锁验证成功后）重置当日额度与阻断态', () => {
    useEyeCareStore.setState({
      isBlocked: true,
      dailyUsedSec: eyeCare.defaultDailyLimitSec,
      singleSessionSec: eyeCare.singleSessionSoftLimitSec,
      softPrompted: true,
    });
    useEyeCareStore.getState().unblock();
    const s = useEyeCareStore.getState();
    expect(s.isBlocked).toBe(false);
    expect(s.dailyUsedSec).toBe(0);
    expect(s.singleSessionSec).toBe(0);
    expect(s.softPrompted).toBe(false);
  });

  it('setLimit 有 60 秒下限（防误设过小）', () => {
    useEyeCareStore.getState().setLimit(10);
    expect(useEyeCareStore.getState().dailyLimitSec).toBe(60);
  });

  it('跨日重置：lastResetDay 变化时清空用量与阻断', () => {
    useEyeCareStore.setState({ lastResetDay: '1970-01-01', dailyUsedSec: 999, isBlocked: true });
    useEyeCareStore.getState().resetDailyIfNeeded();
    const s = useEyeCareStore.getState();
    expect(s.dailyUsedSec).toBe(0);
    expect(s.isBlocked).toBe(false);
  });
});
