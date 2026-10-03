/**
 * AC-05 家长锁 — 屏幕级渲染/交互测试（RNTL 真实渲染 ParentGateScreen）。
 *
 * 待证命题：「验证未通过 = 什么都不暴露」，且验证通过的副作用边界正确：
 * - 三种进入原因各自渲染对应说明，未知原因回落家长中心；
 * - verifyGate 失败 → gatePassed 仍 false、不 goBack、仅提示失败原因；
 * - 指纹成功 → gatePassed=true、goBack 一次、给出成功提示；
 * - 仅 reason='eyeCare' 成功时解除护眼阻断；parentCenter 入口成功不得绕过护眼限制；
 * - 密码按钮长度门槛（空输入不可提交）、成功提交入参正确；
 * - verifyGate reject → 不崩溃、不上锁、上报异常；
 * - 整屏不出现任何设置类文案，只保留验证入口与警示语。
 *
 * 说明：本文件为独立验证新增，不改动任何既有源码或测试。
 * 外部依赖仅隔离 parentApi（精确断言入参）/ uiStore（断言提示文案与级别）/
 * errorToast（断言异常上报）；authStore / eyeCareStore 使用真实 store 断言其状态。
 */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ParentGateScreen } from '../features/parent/ParentGateScreen';
import { parentApi } from '../api/parent';
import { useAuthStore } from '../store/authStore';
import { useEyeCareStore } from '../store/eyeCareStore';
import { useUiStore } from '../store/uiStore';
import { reportError } from '../lib/errorToast';

// jest.mock 工厂由 babel-jest 提升到所有 import 之前；import 全部置顶以满足 import/first。
jest.mock('../api/parent', () => ({
  parentApi: { verifyGate: jest.fn() },
}));

// 整体 mock uiStore：既满足组件的 useUiStore(selector) 调用，
// 也满足 reportError 内部的 useUiStore.getState().show(...)。
jest.mock('../store/uiStore', () => {
  const state = { show: jest.fn() };
  const useUiStore = (selector: (s: typeof state) => unknown) => selector(state);
  useUiStore.getState = () => state;
  return { useUiStore };
});

jest.mock('../lib/errorToast', () => ({ reportError: jest.fn() }));

const verifyGateMock = parentApi.verifyGate as unknown as jest.Mock;
const showMock = (useUiStore as unknown as { getState: () => { show: jest.Mock } }).getState;
const reportErrorMock = reportError as unknown as jest.Mock;

const REASON_EYECARE = '今天的使用时间到了，请家长验证后继续。';
const REASON_PARENT_CENTER = '家长中心需要验证身份才能进入。';
const REASON_SETTINGS = '设置需要验证身份才能修改。';
const WARNING = '为保护孩子，验证未通过前不会显示任何设置。';
const BIOMETRIC = '使用指纹 / 面容验证';
const SUBMIT = '验证';
const PASSWORD_PLACEHOLDER = '6 位数字密码';
/** 家长中心/设置内部才应有的文案；验证屏不得出现（AC-05：未过验证不暴露）。 */
const SETTINGS_TERMS = ['每日时长', '退出登录', '周报', '使用时长', '时间限制', '护眼设置'];

function renderGate(reason?: string): { navigation: { goBack: jest.Mock } } {
  const navigation = { goBack: jest.fn() };
  render(
    <ParentGateScreen
      route={{ params: reason === undefined ? {} : { reason } }}
      navigation={navigation}
    />
  );
  return { navigation };
}

beforeEach(() => {
  useAuthStore.setState({ gatePassed: false });
  useEyeCareStore.setState({ isBlocked: false });
  verifyGateMock.mockReset();
  verifyGateMock.mockResolvedValue({ ok: true });
  reportErrorMock.mockClear();
  showMock().show.mockClear();
});

describe('AC-05 家长锁：进入原因说明文案', () => {
  it('reason=eyeCare 渲染护眼达限说明', () => {
    renderGate('eyeCare');
    expect(screen.getByText(REASON_EYECARE)).toBeTruthy();
  });

  it('reason=parentCenter 渲染家长中心说明', () => {
    renderGate('parentCenter');
    expect(screen.getByText(REASON_PARENT_CENTER)).toBeTruthy();
  });

  it('reason=settings 渲染设置说明', () => {
    renderGate('settings');
    expect(screen.getByText(REASON_SETTINGS)).toBeTruthy();
  });

  it('未知 reason 回落家长中心说明', () => {
    renderGate('nope');
    expect(screen.getByText(REASON_PARENT_CENTER)).toBeTruthy();
    expect(screen.queryByText(REASON_EYECARE)).toBeNull();
    expect(screen.queryByText(REASON_SETTINGS)).toBeNull();
  });

  it('不传 params 时回落家长中心说明', () => {
    renderGate();
    expect(screen.getByText(REASON_PARENT_CENTER)).toBeTruthy();
  });
});

describe('AC-05 家长锁：验证失败不暴露', () => {
  it('指纹验证失败：不上锁、不返回、按后端 hint 提示失败', async () => {
    verifyGateMock.mockResolvedValueOnce({ ok: false, hint: '密码不正确' });
    const { navigation } = renderGate('parentCenter');

    fireEvent.press(screen.getByText(BIOMETRIC));
    await waitFor(() => expect(verifyGateMock).toHaveBeenCalledTimes(1));

    expect(verifyGateMock).toHaveBeenCalledWith({ method: 'biometric', payload: undefined });
    expect(useAuthStore.getState().gatePassed).toBe(false);
    expect(navigation.goBack).not.toHaveBeenCalled();
    expect(showMock().show).toHaveBeenCalledWith('密码不正确', 'danger');
  });
});

describe('AC-05 家长锁：验证成功的副作用边界', () => {
  it('指纹成功：置 gatePassed、返回一次、给出成功提示', async () => {
    const { navigation } = renderGate('parentCenter');

    fireEvent.press(screen.getByText(BIOMETRIC));
    await waitFor(() => expect(useAuthStore.getState().gatePassed).toBe(true));

    expect(navigation.goBack).toHaveBeenCalledTimes(1);
    expect(showMock().show).toHaveBeenCalledWith('验证成功', 'success');
  });

  it('reason=eyeCare 成功：解除护眼阻断（isBlocked true → false）', async () => {
    useEyeCareStore.setState({ isBlocked: true });
    renderGate('eyeCare');

    fireEvent.press(screen.getByText(BIOMETRIC));
    await waitFor(() => expect(useEyeCareStore.getState().isBlocked).toBe(false));
    expect(useAuthStore.getState().gatePassed).toBe(true);
  });

  it('reason=parentCenter 成功：不解除护眼阻断（回归保护）', async () => {
    useEyeCareStore.setState({ isBlocked: true });
    const { navigation } = renderGate('parentCenter');

    fireEvent.press(screen.getByText(BIOMETRIC));
    await waitFor(() => expect(useAuthStore.getState().gatePassed).toBe(true));

    // 从家长中心入口验证通过，不得顺带清掉护眼限制
    expect(useEyeCareStore.getState().isBlocked).toBe(true);
    expect(navigation.goBack).toHaveBeenCalledTimes(1);
  });
});

describe('AC-05 家长锁：密码按钮门槛与入参', () => {
  it('初始空输入点「验证」不触发任何 verifyGate 调用', () => {
    renderGate('parentCenter');

    fireEvent.press(screen.getByText(SUBMIT));
    expect(verifyGateMock).not.toHaveBeenCalled();
  });

  it('输入 4 位及以上密码后可提交，verifyGate 收到 method/payload', async () => {
    renderGate('parentCenter');

    fireEvent.changeText(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER), '1234');
    fireEvent.press(screen.getByText(SUBMIT));

    await waitFor(() =>
      expect(verifyGateMock).toHaveBeenCalledWith({ method: 'password', payload: '1234' }),
    );
  });
});

describe('AC-05 家长锁：异常路径', () => {
  it('verifyGate reject：不崩溃、不上锁、不返回，且异常被上报', async () => {
    const boom = new Error('network');
    verifyGateMock.mockRejectedValueOnce(boom);
    const { navigation } = renderGate('parentCenter');

    fireEvent.press(screen.getByText(BIOMETRIC));
    await waitFor(() => expect(reportErrorMock).toHaveBeenCalledWith(boom));

    expect(useAuthStore.getState().gatePassed).toBe(false);
    expect(navigation.goBack).not.toHaveBeenCalled();
  });
});

describe('AC-05 家长锁：不暴露任何设置', () => {
  it('settings 入口下仍只渲染验证入口与警示语，无任何设置类文案', () => {
    renderGate('settings');

    expect(screen.getByText(WARNING)).toBeTruthy();
    expect(screen.getByText(BIOMETRIC)).toBeTruthy();
    expect(screen.getByText(SUBMIT)).toBeTruthy();
    expect(screen.getByPlaceholderText(PASSWORD_PLACEHOLDER)).toBeTruthy();
    for (const term of SETTINGS_TERMS) {
      expect(screen.queryByText(term)).toBeNull();
    }
  });
});
