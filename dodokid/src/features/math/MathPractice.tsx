/**
 * 数学启蒙 — 练习作答界面：题干 +（可选）点阵 + 选项，即时对错反馈与结算。
 * 逻辑与出题分离（见 problems.ts），本组件只负责呈现与交互。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, XCircle } from 'phosphor-react-native';
import { colors, fontFamily, moduleStrongColor, radius, shadow, spacing } from '../../design/tokens';
import type { AgeGroup } from '../../api/types';
import { Button, Card } from '../../shared/components';
import { scoreOf } from '../../shared/lib/quizCore';
import { buildPractice, gradeAnswer, type MathProblem } from './problems';
import { activityLabel, type MathKind } from './mathData';

interface Props {
  kind: MathKind;
  age?: AgeGroup;
  onFinish: (score: number) => void;
  onExit: () => void;
}

/** 点阵：按组渲染圆点，直观呈现数量。 */
function Dots({ groups }: { groups: number[] }) {
  return (
    <View style={styles.dots}>
      {groups.map((n, gi) => (
        <View key={`g-${gi}`} style={styles.dotGroup}>
          {Array.from({ length: n }, (_, i) => (
            <View key={`d-${i}`} style={styles.dot} />
          ))}
        </View>
      ))}
    </View>
  );
}

export function MathPractice({ kind, age, onFinish, onExit }: Props) {
  const problems = useMemo(() => buildPractice(age, kind, Math.random), [age, kind]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  const problem = problems[index] as MathProblem | undefined;

  if (!problem) {
    return (
      <Card padding="lg" style={styles.center}>
        <Text style={styles.tip}>题目准备中，请稍后重试</Text>
        <Button label="返回" variant="ghost" onPress={onExit} />
      </Card>
    );
  }

  const isLast = index === problems.length - 1;

  if (done) {
    const s = scoreOf(problems.length, correct);
    return (
      <Card padding="x2l" style={styles.center}>
        <Text style={styles.resultTitle}>{s >= 80 ? '太棒啦！' : '再试一次会更棒～'}</Text>
        <Text style={styles.resultScore}>{s} 分</Text>
        <Text style={styles.tip}>
          答对 {correct} / {problems.length} 题
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
          <Button label="选别的玩法" variant="ghost" onPress={onExit} />
        </View>
      </Card>
    );
  }

  const choose = (opt: string) => {
    if (chosen) return;
    setChosen(opt);
    if (gradeAnswer(problem, opt)) setCorrect((c) => c + 1);
  };

  const next = () => {
    if (isLast) {
      const s = scoreOf(problems.length, correct);
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
        {activityLabel(kind)} · 第 {index + 1} / {problems.length} 题
      </Text>

      <Card padding="x2l" style={styles.stage}>
        <Text style={styles.title}>{problem.title}</Text>
        <Dots groups={problem.groups} />
      </Card>

      <View style={styles.options}>
        {problem.options.map((opt) => {
          const isAnswer = opt === problem.answer;
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
  stage: { alignItems: 'center', gap: spacing.lg, minHeight: 200, justifyContent: 'center' },
  title: { fontFamily: fontFamily.display, fontSize: 26, color: colors.fg, fontWeight: '700' },
  dots: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.lg, justifyContent: 'center' },
  dotGroup: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, maxWidth: 140, justifyContent: 'center' },
  dot: {
    width: 22,
    height: 22,
    borderRadius: radius.pill,
    backgroundColor: moduleStrongColor('math'),
  },
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
  optionText: { fontFamily: fontFamily.display, fontSize: 22, color: colors.fg, fontWeight: '700' },
  center: { alignItems: 'center', gap: spacing.sm },
  tip: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '600' },
  resultTitle: { fontFamily: fontFamily.display, fontSize: 24, color: colors.fg, fontWeight: '700' },
  resultScore: { fontFamily: fontFamily.display, fontSize: 40, color: colors.primaryStrong, fontWeight: '700' },
  row: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
