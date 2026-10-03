/**
 * 识字认知 — 认读小测：拼音为题干，四选一选字。
 * 作答后即时给出对错反馈，全部作答后回写进度并给出得分。
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, XCircle } from 'phosphor-react-native';
import { colors, fontFamily, radius, shadow, spacing } from '../../design/tokens';
import type { LiteracyCard } from './literacyData';
import { buildQuestions, gradeAnswer, scoreOf } from './quiz';
import { Button, Card } from '../../shared/components';

interface Props {
  cards: LiteracyCard[];
  /** 完成全部题目时回调，携带百分制得分 */
  onFinish: (score: number) => void;
  onExit: () => void;
}

export function LiteracyQuiz({ cards, onFinish, onExit }: Props) {
  const questions = useMemo(() => buildQuestions(cards), [cards]);
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string | null>(null);
  const [correct, setCorrect] = useState(0);
  const [done, setDone] = useState(false);

  if (questions.length === 0) {
    return (
      <Card padding="lg" style={styles.empty}>
        <Text style={styles.emptyText}>字卡太少，先多认几个字再来小测吧</Text>
        <Button label="回字卡" variant="ghost" onPress={onExit} />
      </Card>
    );
  }

  const q = questions[index] as (typeof questions)[number];
  const isLast = index === questions.length - 1;

  const choose = (opt: string) => {
    if (chosen) return;
    setChosen(opt);
    if (gradeAnswer(q, opt)) setCorrect((c) => c + 1);
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

  if (done) {
    const s = scoreOf(questions.length, correct);
    return (
      <Card padding="x2l" style={styles.result}>
        <Text style={styles.resultTitle}>{s >= 80 ? '真棒！' : '继续加油～'}</Text>
        <Text style={styles.resultScore}>{s} 分</Text>
        <Text style={styles.resultSub}>
          答对 {correct} / {questions.length} 题
        </Text>
        <View style={styles.resultRow}>
          <Button
            label="再来一次"
            onPress={() => {
              setIndex(0);
              setChosen(null);
              setCorrect(0);
              setDone(false);
            }}
          />
          <Button label="回字卡" variant="ghost" onPress={onExit} />
        </View>
      </Card>
    );
  }

  return (
    <View style={styles.wrap}>
      <Text style={styles.progress}>
        第 {index + 1} / {questions.length} 题
      </Text>
      <Card padding="x2l" style={styles.promptCard}>
        <Text style={styles.promptHint}>这个音是哪个字？</Text>
        <Text style={styles.prompt}>{q.prompt}</Text>
      </Card>

      <View style={styles.options}>
        {q.options.map((opt) => {
          const isAnswer = opt === q.answer;
          const picked = chosen === opt;
          const showState = chosen !== null && (picked || isAnswer);
          return (
            <Pressable
              key={opt}
              onPress={() => choose(opt)}
              disabled={chosen !== null}
              style={[
                styles.option,
                showState && isAnswer && styles.optionRight,
                showState && picked && !isAnswer && styles.optionWrong,
              ]}
            >
              <Text style={styles.optionText}>{opt}</Text>
              {showState && isAnswer && <CheckCircle size={20} color={colors.success} weight="fill" />}
              {showState && picked && !isAnswer && <XCircle size={20} color={colors.danger} weight="fill" />}
            </Pressable>
          );
        })}
      </View>

      {chosen !== null && (
        <Button label={isLast ? '看成绩' : '下一题'} onPress={next} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md },
  progress: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '700' },
  promptCard: { alignItems: 'center', gap: spacing.sm },
  promptHint: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600' },
  prompt: { fontFamily: fontFamily.display, fontSize: 40, color: colors.fg, fontWeight: '700' },
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
  optionText: { fontFamily: fontFamily.display, fontSize: 24, color: colors.fg, fontWeight: '700' },
  empty: { alignItems: 'center', gap: spacing.md },
  emptyText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '600' },
  result: { alignItems: 'center', gap: spacing.sm },
  resultTitle: { fontFamily: fontFamily.display, fontSize: 24, color: colors.fg, fontWeight: '700' },
  resultScore: { fontFamily: fontFamily.display, fontSize: 40, color: colors.primaryStrong, fontWeight: '700' },
  resultSub: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600' },
  resultRow: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.sm },
});
