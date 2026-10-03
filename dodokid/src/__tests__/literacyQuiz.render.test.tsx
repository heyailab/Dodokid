/**
 * 识字认知模块 — 渲染与交互测试（RNTL）。
 * 证明题目按字卡顺序生成、四选一可作答、答对后能推进到下一题。
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { LiteracyQuiz } from '../features/literacy/LiteracyQuiz';
import { LITERACY_CARDS } from '../features/literacy/literacyData';

describe('LiteracyQuiz 渲染与交互', () => {
  it('首题以第一张字卡的拼音为题干，并提供 4 个选项', () => {
    const first = LITERACY_CARDS[0]!;
    const screen = render(
      <LiteracyQuiz cards={LITERACY_CARDS} onFinish={() => {}} onExit={() => {}} />,
    );
    expect(screen.getByText(`第 1 / ${LITERACY_CARDS.length} 题`)).toBeTruthy();
    expect(screen.getByText(first.pinyin)).toBeTruthy();
    expect(screen.getByText(first.char)).toBeTruthy();
  });

  it('答对后出现「下一题」，可推进到第 2 题', () => {
    const first = LITERACY_CARDS[0]!;
    const screen = render(
      <LiteracyQuiz cards={LITERACY_CARDS} onFinish={() => {}} onExit={() => {}} />,
    );
    fireEvent.press(screen.getByText(first.char));
    fireEvent.press(screen.getByText('下一题'));
    expect(screen.getByText(`第 2 / ${LITERACY_CARDS.length} 题`)).toBeTruthy();
    expect(screen.getByText(LITERACY_CARDS[1]!.pinyin)).toBeTruthy();
  });

  it('字卡不足 4 张时给出提示并可直接退出', () => {
    const onExit = jest.fn();
    const screen = render(
      <LiteracyQuiz cards={LITERACY_CARDS.slice(0, 3)} onFinish={() => {}} onExit={onExit} />,
    );
    expect(screen.getByText('字卡太少，先多认几个字再来小测吧')).toBeTruthy();
    fireEvent.press(screen.getByText('回字卡'));
    expect(onExit).toHaveBeenCalled();
  });
});
