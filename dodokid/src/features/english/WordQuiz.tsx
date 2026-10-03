/**
 * 英语启蒙 — 选词小测：图标 + 中文释义为题干，四选一英文单词。
 * 作答即时反馈，结束后回到结算并回传百分制得分。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, XCircle } from 'phosphor-react-native';
import { colors, fontFamily, moduleStrongColor, radius, shadow, spacing } from '../../design/tokens';
import { Button, Card } from '../../shared/components';
import { scoreOf } from '../../shared/lib/quizCore';
import type { EnglishWord } from './englishData';
import { buildWordQuestions, gradeWord } from './wordQuestions';
import { WordIcon } from './WordIcon';

interface Props {
  words: EnglishWord[];
  onFinish: (score: number) => void;
  onExit: () => void;
}

export function WordQuiz({ words, onFinish, onExit }: Props) {
  const questions = useMemo(() => buildWordQuestions(words), [words]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  if (questions.length === 0) {
    return (
      <Card padding="lg" style={styles.center}>
        <Text style={styles.tip}>单词太少，先多认几个再来小测吧</Text>
        <Button label="回单词卡" variant="ghost" onPress={onExit} />
      </Card>
    );
  }

  const q = questions[index]!;
  const isLast = index === questions.length - 1;

  if (done) {
    const s = scoreOf(questions.length, correct);
    return (
      <Card padding="x2l" style={styles.center}>
        <Text style={styles.resultTitle}>{s >= 80 ? 'Well done!' : 'Try again～'}</Text>
        <Text style={styles.resultScore}>{s} 分</Text>
        <Text style={styles.tip}>
          答对 {correct} / {questions.length} 题
        </Text>
        <View style={styles.row}>
          <Button
            label="再来一次"
            onPress={() => {
              setIndex(0);
              setChosen(null);
              setCorrect(0);
              setDone(false);
            }}
          />
          <Button label="回单词卡" variant="ghost" onPress={onExit} />
        </View>
      </Card>
    );
  }

  const choose = (opt: string) => {
    if (chosen) return;
    setChosen(opt);
    if (gradeWord(q, opt)) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (isLast) {
      const s = scoreOf(questions.length, correct);
      setDone(true);
      onFinish(s);
      return;
    }
    setIndex((i) => i + 1);
    setChosen(null);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.progress}>
        第 {index + 1} / {questions.length} 题
      </Text>

      <Card padding="x2l" style={styles.stage}>
        <View style={[styles.chip, { backgroundColor: moduleStrongColor('english') }]}>
          <WordIcon icon={q.icon} size={36} />
        </View>
        <Text style={styles.promptZh}>{q.promptZh}</Text>
        <Text style={styles.promptHint}>选出对应的英文单词</Text>
      </Card>

      <View style={styles.options}>
        {q.options.map((opt) => {
          const isAnswer = opt === q.answer;
          const picked = chosen === opt;
          const show = chosen !== null && (picked || isAnswer);
          return (
            <Pressable
              key={opt}
              disabled={chosen !== null}
              onPress={() => choose(opt)}
              style={[
                styles.option,
                show && isAnswer && styles.optionRight,
                show && picked && !isAnswer && styles.optionWrong,
              ]}
            >
              <Text style={styles.optionText}>{opt}</Text>
              {show && isAnswer && <CheckCircle size={20} color={colors.success} weight="fill" />}
              {show && picked && !isAnswer && <XCircle size={20} color={colors.danger} weight="fill" />}
            </Pressable>
          );
        })}
      </View>

      {chosen !== null && <Button label={isLast ? '看成绩' : '下一题'} onPress={next} />}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  progress: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '700' },
  stage: { alignItems: 'center', gap: spacing.sm, minHeight: 190, justifyContent: 'center' },
  chip: {
    width: 72,
    height: 72,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  promptZh: { fontFamily: fontFamily.display, fontSize: 26, color: colors.fg, fontWeight: '700' },
  promptHint: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, fontWeight: '600' },
  options: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  option: {
    width: '47%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingVertical: spacing.lg,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  optionRight: { borderColor: colors.success, backgroundColor: colors.primarySoft },
  optionWrong: { borderColor: colors.danger },
  optionText: { fontFamily: fontFamily.display, fontSize: 20, color: colors.fg, fontWeight: '700' },
  center: { alignItems: 'center', gap: spacing.sm },
  tip: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '600' },
  resultTitle: { fontFamily: fontFamily.display, fontSize: 24, color: colors.fg, fontWeight: '700' },
  resultScore: { fontFamily: fontFamily.display, fontSize: 40, color: colors.primaryStrong, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
