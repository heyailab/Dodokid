/**
 * 数学启蒙 — 练习界面渲染与交互测试（RNTL）。
 * 证明题干/点阵渲染、选项可作答、作答后出现推进按钮。
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { MathPractice } from '../features/math/MathPractice';
import { rangeFor } from '../features/math/mathData';

const size = rangeFor('3-4').sessionSize;

describe('MathPractice 渲染与交互', () => {
  it('数一数：渲染题干、点阵与题号进度', () => {
    const screen = render(
      <MathPractice kind="count" age="3-4" onFinish={() => {}} onExit={() => {}} />,
    );
    expect(screen.getByText('数一数，有几个圆点？')).toBeTruthy();
    expect(screen.getByText(`数一数 · 第 1 / ${size} 题`)).toBeTruthy();
  });

  it('比大小：渲染三选一固定选项，作答后出现「下一题」', () => {
    const screen = render(
      <MathPractice kind="compare" age="3-4" onFinish={() => {}} onExit={() => {}} />,
    );
    expect(screen.getByText('哪边的圆点更多？')).toBeTruthy();
    expect(screen.getByText('左边多')).toBeTruthy();
    expect(screen.getByText('右边多')).toBeTruthy();
    expect(screen.getByText('一样多')).toBeTruthy();

    // 任选一项作答后，应出现推进按钮与对错反馈路径
    fireEvent.press(screen.getByText('左边多'));
    expect(screen.getByText('下一题')).toBeTruthy();
  });

  it('算一算：题干为 a + b = ? 形式', () => {
    const screen = render(
      <MathPractice kind="add" age="4-6" onFinish={() => {}} onExit={() => {}} />,
    );
    expect(screen.getByText(/^\d+ \+ \d+ = \?$/)).toBeTruthy();
    expect(screen.getByText(`算一算 · 第 1 / ${rangeFor('4-6').sessionSize} 题`)).toBeTruthy();
  });
});
