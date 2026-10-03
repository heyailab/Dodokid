/**
 * 益智游戏 — 渲染与交互测试（RNTL）。
 * 覆盖牌面渲染/翻牌回调（MemoryBoard）、状态条（MemoryHud）、
 * 结算页与「再来一局」冷却（MemoryResult，AC-21）。
 */
import React from 'react';
import { act, fireEvent, render } from '@testing-library/react-native';
import { MemoryBoard, MemoryHud } from '../features/puzzle/MemoryBoard';
import { MemoryResult, RESTART_COOLDOWN_SEC } from '../features/puzzle/MemoryResult';
import { createBoard, flipCard } from '../features/puzzle/memoryLogic';
import { levelFor } from '../features/puzzle/memoryData';

const level = levelFor('3-4');
const rng = () => 0.37;
const board = createBoard(level, rng);

describe('MemoryBoard 牌面渲染与翻牌', () => {
  it('渲染全部卡位，初始均为未翻开', () => {
    const screen = render(<MemoryBoard state={board} columns={level.columns} onFlip={() => {}} />);
    const tiles = screen.getAllByTestId(/^memory-card-/);
    expect(tiles).toHaveLength(board.cards.length);
    expect(screen.getAllByLabelText(/^未翻开的卡片/)).toHaveLength(board.cards.length);
  });

  it('点击卡位回传其索引', () => {
    const onFlip = jest.fn();
    const screen = render(<MemoryBoard state={board} columns={level.columns} onFlip={onFlip} />);
    fireEvent.press(screen.getByTestId('memory-card-3'));
    expect(onFlip).toHaveBeenCalledWith(3);
  });

  it('正被翻开的卡显示为已翻开', () => {
    const flipped = flipCard(board, 2);
    const screen = render(
      <MemoryBoard state={flipped} columns={level.columns} onFlip={() => {}} />,
    );
    expect(screen.getByLabelText('已翻开的卡片 3')).toBeTruthy();
    expect(screen.getAllByLabelText(/^未翻开的卡片/)).toHaveLength(board.cards.length - 1);
  });

  it('配对的卡保持已翻开', () => {
    const a = 0;
    const b = board.cards.findIndex((c, i) => i !== a && c.face === board.cards[a]!.face);
    const matched = flipCard(flipCard(board, a), b);
    const screen = render(
      <MemoryBoard state={matched} columns={level.columns} onFlip={() => {}} />,
    );
    expect(screen.getByLabelText('已翻开的卡片 1')).toBeTruthy();
    expect(screen.getByLabelText(`已翻开的卡片 ${b + 1}`)).toBeTruthy();
  });
});

describe('MemoryHud 状态条', () => {
  it('渲染已配对数与翻牌次数', () => {
    const screen = render(<MemoryHud state={flipCard(board, 0)} pairs={level.pairs} />);
    expect(screen.getByText(`已配对 0 / ${level.pairs}`)).toBeTruthy();
    expect(screen.getByText('翻牌 1 次')).toBeTruthy();
  });
});

describe('MemoryResult 结算与「再来一局」冷却（AC-21）', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });
  afterEach(() => {
    jest.useRealTimers();
  });

  it('渲染成绩与星级，冷却期内按钮禁用且不可触发重开', () => {
    const onRestart = jest.fn();
    const screen = render(
      <MemoryResult stars={3} flips={8} pairs={4} onRestart={onRestart} onExit={() => {}} />,
    );
    expect(screen.getByText('全部配对成功！')).toBeTruthy();
    expect(screen.getByText('翻牌 8 次 · 共 4 组')).toBeTruthy();

    const cooling = screen.getByText(`再来一局（${RESTART_COOLDOWN_SEC}s）`);
    expect(cooling).toBeTruthy();
    fireEvent.press(cooling);
    expect(onRestart).not.toHaveBeenCalled();
  });

  it('冷却结束后按钮恢复可用且文案去掉倒计时', () => {
    const onRestart = jest.fn();
    const screen = render(
      <MemoryResult stars={2} flips={11} pairs={4} onRestart={onRestart} onExit={() => {}} />,
    );
    act(() => {
      jest.advanceTimersByTime(RESTART_COOLDOWN_SEC * 1000);
    });
    expect(screen.queryByText(/再来一局（/)).toBeNull();
    fireEvent.press(screen.getByText('再来一局'));
    expect(onRestart).toHaveBeenCalledTimes(1);
  });

  it('「回到首页」始终可点', () => {
    const onExit = jest.fn();
    const screen = render(
      <MemoryResult stars={1} flips={20} pairs={4} onRestart={() => {}} onExit={onExit} />,
    );
    fireEvent.press(screen.getByText('回到首页'));
    expect(onExit).toHaveBeenCalledTimes(1);
  });
});
