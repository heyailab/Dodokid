/**
 * 英语启蒙模块（路线图 P2 第三个模块）：单词卡学习 + 看义选词小测。
 * - 按儿童年龄过滤单词卡；
 * - 卡片展示图标/英文/音标/中文，可听读音（音频资源就绪前为占位）；
 * - 浏览与得分分别回写进度；计入护眼计时。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight, Star } from 'phosphor-react-native';
import {
  colors,
  fontFamily,
  moduleStrongColor,
  radius,
  shadow,
  spacing,
} from '../../design/tokens';
import { useAuthStore } from '../../store/authStore';
import { useContentActivity } from '../../hooks/useContentActivity';
import { progressApi } from '../../api/progress';
import { reportError } from '../../lib/errorToast';
import { Button, Card, DodoMascot, EyeCareTimerBar, Screen } from '../../shared/components';
import { NarrationButton } from '../book/NarrationButton';
import { WordQuiz } from './WordQuiz';
import { WordIcon } from './WordIcon';
import { wordsForAge } from './englishData';
import { wrapIndex } from '../../shared/lib/quizCore';
import { useMediaBase } from '../../shared/lib/useMediaBase';
import { mediaUrl } from '../../shared/lib/mediaBase';

export function EnglishScreen({ navigation }: { navigation: any }) {
  useContentActivity();
  // 订阅基址变化：后台拉到真实域名后重渲染，下面的 mediaUrl 才会用上新值
  useMediaBase();
  const childId = useAuthStore((s) => s.currentChildId);
  const ageGroup = useAuthStore(
    (s) => s.children.find((c) => c.id === s.currentChildId)?.ageGroup,
  );
  const words = useMemo(() => wordsForAge(ageGroup), [ageGroup]);
  const [index, setIndex] = useState(0);
  const [mode, setMode] = useState<'browse' | 'quiz'>('browse');

  const word = words[index];

  useEffect(() => {
    if (!word || !childId) return;
    progressApi
      .upsert(childId, { contentId: `english:${word.id}`, pageIndex: index, completed: false, score: 0 })
      .catch(reportError);
  }, [word, index, childId]);

  if (words.length === 0) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <Card variant="warm" padding="x2l" style={styles.center}>
          <DodoMascot size={96} mood="happy" />
          <Text style={styles.emptyTitle}>这个年龄段正在准备单词卡～</Text>
          <Button label="返回" variant="ghost" onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  if (mode === 'quiz') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <EyeCareTimerBar />
        <Text style={styles.heading}>看义选词</Text>
        <WordQuiz
          words={words}
          onExit={() => setMode('browse')}
          onFinish={(score) => {
            if (childId) {
              progressApi
                .upsert(childId, { contentId: 'english:quiz', pageIndex: 0, completed: true, score })
                .catch(reportError);
            }
          }}
        />
      </Screen>
    );
  }

  const current = word!;
  const strong = moduleStrongColor('english');

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />

      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={24} color={colors.fg} weight="bold" />
        </Pressable>
        <Text style={styles.heading}>英语启蒙</Text>
        <Text style={styles.counter}>
          {index + 1} / {words.length}
        </Text>
      </View>

      <Card padding="x2l" style={styles.card}>
        <View style={[styles.chip, { backgroundColor: strong }]}>
          <WordIcon icon={current.icon} size={44} />
        </View>
        <Text style={styles.word}>{current.word}</Text>
        <Text style={styles.phonetic}>{current.phonetic}</Text>
        <Text style={styles.zh}>{current.zh}</Text>
      </Card>

      <NarrationButton uri={mediaUrl(current.audioKey)} />

      <View style={styles.nav}>
        <Pressable
          onPress={() => setIndex((i) => wrapIndex(i - 1, words.length))}
          hitSlop={12}
          style={styles.navBtn}
        >
          <ArrowLeft size={22} color={colors.primaryStrong} weight="bold" />
          <Text style={styles.navText}>上一个</Text>
        </Pressable>
        <Pressable
          onPress={() => setIndex((i) => wrapIndex(i + 1, words.length))}
          hitSlop={12}
          style={styles.navBtn}
        >
          <Text style={styles.navText}>下一个</Text>
          <ArrowRight size={22} color={colors.primaryStrong} weight="bold" />
        </Pressable>
      </View>

      <Button
        label="开始看义选词"
        icon={<Star size={18} color="#FFFFFF" weight="fill" />}
        onPress={() => setMode('quiz')}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { padding: 4 },
  heading: { fontFamily: fontFamily.display, fontSize: 26, color: colors.fg, fontWeight: '700', flex: 1 },
  counter: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '700' },
  card: { alignItems: 'center', gap: spacing.sm, minHeight: 240, justifyContent: 'center' },
  chip: {
    width: 84,
    height: 84,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  word: { fontFamily: fontFamily.display, fontSize: 40, color: colors.fg, fontWeight: '700' },
  phonetic: { fontFamily: fontFamily.body, fontSize: 15, color: colors.fg2, fontWeight: '600' },
  zh: { fontFamily: fontFamily.body, fontSize: 17, color: colors.primaryStrong, fontWeight: '700' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  navBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: colors.surface,
    borderRadius: radius.pill,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.lg,
    ...shadow.soft,
  },
  navText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.primaryStrong, fontWeight: '700' },
  center: { alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontFamily: fontFamily.display, fontSize: 20, color: colors.fg, fontWeight: '700' },
});
