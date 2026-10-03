/** 互动问答卡片（绘本末页） */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Check, X } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../../design/tokens';
import type { QuizQuestion } from '../../api/types';

interface Props {
  question: QuizQuestion;
  onAnswered: (correct: boolean) => void;
}

export function QuizCard({ question, onAnswered }: Props) {
  const [picked, setPicked] = useState<number | null>(null);
  const [done, setDone] = useState(false);

  const choose = (i: number) => {
    if (done) return;
    setPicked(i);
    setDone(true);
    onAnswered(i === question.answerIndex);
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.prompt}>{question.prompt}</Text>
      <View style={styles.options}>
        {question.options.map((o, i) => {
          const correct = i === question.answerIndex;
          const wrongPick = done && picked === i && !correct;
          const showCorrect = done && correct;
          const bg = showCorrect ? colors.success : wrongPick ? colors.danger : colors.surface;
          return (
            <Pressable
              key={i}
              accessibilityRole="button"
              accessibilityLabel={o.label}
              accessibilityState={{ selected: picked === i, disabled: done }}
              disabled={done}
              onPress={() => choose(i)}
              style={[styles.option, { backgroundColor: bg, borderColor: done ? bg : colors.border }]}
            >
              <Text style={[styles.optText, { color: done ? '#FFFFFF' : colors.fg }]}>
                {o.label}
              </Text>
              {showCorrect && <Check size={18} color="#FFFFFF" weight="bold" />}
              {wrongPick && <X size={18} color="#FFFFFF" weight="bold" />}
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.md, marginTop: spacing.lg },
  prompt: { fontFamily: fontFamily.display, fontSize: 18, color: colors.fg, fontWeight: '700' },
  options: { gap: spacing.sm },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
  },
  optText: { fontFamily: fontFamily.body, fontWeight: '700', fontSize: 15 },
});
