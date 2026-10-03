/**
 * 英语启蒙 — 选词小测与图标映射的渲染/交互测试（RNTL）。
 * 证明题干按词序生成、四选一可作答、答错也能推进、满分手写入成绩页。
 */
import React from 'react';
import { fireEvent, render } from '@testing-library/react-native';
import { WordQuiz } from '../features/english/WordQuiz';
import { WordIcon } from '../features/english/WordIcon';
import { ENGLISH_WORDS, wordsForAge } from '../features/english/englishData';
import { OPTION_COUNT } from '../features/english/wordQuestions';

describe('WordQuiz 渲染与交互', () => {
  it('首题渲染题号、中文题干、提示语与 4 个英文选项', () => {
    const words = wordsForAge('3-4');
    const screen = render(<WordQuiz words={words} onFinish={() => {}} onExit={() => {}} />);
    expect(screen.getByText(`第 1 / ${words.length} 题`)).toBeTruthy();
    expect(screen.getByText(words[0]!.zh)).toBeTruthy();
    expect(screen.getByText('选出对应的英文单词')).toBeTruthy();
    // 正确答案必在选项中；干扰项随机，故只校验选项总数为 4
    expect(screen.getByText(words[0]!.word)).toBeTruthy();
    expect(words.filter((w) => screen.queryByText(w.word) !== null)).toHaveLength(OPTION_COUNT);
  });

  it('选中正确答案后出现「下一题」', () => {
    const words = wordsForAge('3-4');
    const screen = render(<WordQuiz words={words} onFinish={() => {}} onExit={() => {}} />);
    fireEvent.press(screen.getByText(words[0]!.word));
    expect(screen.getByText('下一题')).toBeTruthy();
  });

  it('答错同样可推进，进入第 2 题后题干随之切换', () => {
    const words = wordsForAge('4-6');
    const screen = render(<WordQuiz words={words} onFinish={() => {}} onExit={() => {}} />);
    // 干扰项是随机抽取的，不能假定某个词一定在选项中 —— 从实际渲染出的选项里取一个非正确答案
    const wrong = words.find(
      (w) => w.id !== words[0]!.id && screen.queryByText(w.word) !== null,
    )!;
    expect(wrong).toBeTruthy();
    fireEvent.press(screen.getByText(wrong.word));
    fireEvent.press(screen.getByText('下一题'));
    expect(screen.getByText(`第 2 / ${words.length} 题`)).toBeTruthy();
    expect(screen.getByText(words[1]!.zh)).toBeTruthy();
  });

  it('全部答对：末题按钮为「看成绩」，结算回传 100 分', () => {
    const words = wordsForAge('3-4').slice(0, 4);
    const onFinish = jest.fn();
    const screen = render(<WordQuiz words={words} onFinish={onFinish} onExit={() => {}} />);
    words.forEach((w, i) => {
      fireEvent.press(screen.getByText(w.word));
      fireEvent.press(screen.getByText(i === words.length - 1 ? '看成绩' : '下一题'));
    });
    expect(onFinish).toHaveBeenCalledWith(100);
    expect(screen.getByText('100 分')).toBeTruthy();
    expect(screen.getByText('Well done!')).toBeTruthy();
    expect(screen.getByText(`答对 ${words.length} / ${words.length} 题`)).toBeTruthy();
  });

  it('单词不足 4 张时给出提示并可直接退出', () => {
    const onExit = jest.fn();
    const screen = render(
      <WordQuiz words={wordsForAge('3-4').slice(0, 3)} onFinish={() => {}} onExit={onExit} />,
    );
    expect(screen.getByText('单词太少，先多认几个再来小测吧')).toBeTruthy();
    fireEvent.press(screen.getByText('回单词卡'));
    expect(onExit).toHaveBeenCalled();
  });
});

describe('WordIcon 图标映射', () => {
  it('全部词卡的图标键均有对应图标且可渲染', () => {
    ENGLISH_WORDS.forEach((w) => {
      const screen = render(<WordIcon icon={w.icon} size={24} />);
      expect(screen.toJSON()).toBeTruthy();
    });
  });
});
