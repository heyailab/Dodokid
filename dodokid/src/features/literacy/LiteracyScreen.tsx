/**
 * 识字认知模块（路线图 P2 首个模块）：字卡学习 + 认读小测。
 * - 按儿童年龄过滤字卡（年龄路由）；
 * - 点卡片翻面看组词/例句，可听读音；
 * - 每张字卡浏览即回写进度，小测得分单独回写；
 * - 计入护眼计时（内容消费路由）。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight, ArrowsClockwise, SpeakerHigh, Star } from 'phosphor-react-native';
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
import { LiteracyQuiz } from './LiteracyQuiz';
import { cardsForAge, splitHighlight } from './literacyData';
import { wrapIndex } from './quiz';
import { useMediaBase } from '../../shared/lib/useMediaBase';
import { mediaUrl } from '../../shared/lib/mediaBase';

export function LiteracyScreen({ navigation }: { navigation: any }) {
  useContentActivity();
  // 订阅基址变化：后台拉到真实域名后重渲染，下面的 mediaUrl 才会用上新值
  useMediaBase();
  const childId = useAuthStore((s) => s.currentChildId);
  const ageGroup = useAuthStore(
    (s) => s.children.find((c) => c.id === s.currentChildId)?.ageGroup,
  );
  const cards = useMemo(() => cardsForAge(ageGroup), [ageGroup]);
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [mode, setMode] = useState<'browse' | 'quiz'>('browse');

  const card = cards[index];

  // 进度回写：浏览到某张字卡即记录（离线时由 progressApi 自行降级）
  useEffect(() => {
    if (!card || !childId) return;
    progressApi
      .upsert(childId, { contentId: `literacy:${card.id}`, pageIndex: index, completed: false, score: 0 })
      .catch(reportError);
  }, [card, index, childId]);

  if (cards.length === 0) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <Card variant="warm" padding="x2l" style={styles.empty}>
          <DodoMascot size={96} mood="happy" />
          <Text style={styles.emptyTitle}>这个年龄段正在准备字卡～</Text>
          <Button label="返回" variant="ghost" onPress={() => navigation.goBack()} />
        </Card>
      </Screen>
    );
  }

  if (mode === 'quiz') {
    return (
      <Screen scroll contentStyle={styles.content}>
        <EyeCareTimerBar />
        <Text style={styles.heading}>认读小测</Text>
        <LiteracyQuiz
          cards={cards}
          onExit={() => setMode('browse')}
          onFinish={(score) => {
            if (childId) {
              progressApi
                .upsert(childId, { contentId: 'literacy:quiz', pageIndex: 0, completed: true, score })
                .catch(reportError);
            }
          }}
        />
      </Screen>
    );
  }

  const current = card!;
  const strong = moduleStrongColor('literacy');
  const segments = splitHighlight(current.sentence);

  const go = (dir: 1 | -1) => {
    setFlipped(false);
    setIndex((i) => wrapIndex(i + dir, cards.length));
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />

      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={24} color={colors.fg} weight="bold" />
        </Pressable>
        <Text style={styles.heading}>识字认知</Text>
        <Text style={styles.counter}>
          {index + 1} / {cards.length}
        </Text>
      </View>

      <Pressable onPress={() => setFlipped((f) => !f)}>
        <Card padding="x2l" style={styles.card}>
          <View style={[styles.chip, { backgroundColor: strong }]}>
            <SpeakerHigh size={16} color="#FFFFFF" weight="fill" />
          </View>
          <Text style={styles.char}>{current.char}</Text>
          <Text style={styles.pinyin}>{current.pinyin}</Text>

          {flipped && (
            <View style={styles.cardBack}>
              <Text style={styles.word}>组词：{current.word}</Text>
              <View style={styles.sentenceRow}>
                {segments.map((seg, i) => (
                  <Text
                    key={`${seg.text}-${i}`}
                    style={seg.highlight ? styles.sentenceHi : styles.sentence}
                  >
                    {seg.text}
                  </Text>
                ))}
              </View>
            </View>
          )}

          <Text style={styles.flipHint}>{flipped ? '点卡片收起' : '点卡片看组词和例句'}</Text>
        </Card>
      </Pressable>

      <View style={styles.row}>
        <NarrationButton uri={mediaUrl(current.audioKey)} />
        <Button
          label="翻面"
          variant="ghost"
          icon={<ArrowsClockwise size={18} color={colors.fg} weight="bold" />}
          onPress={() => setFlipped((f) => !f)}
        />
      </View>

      <View style={styles.nav}>
        <Pressable onPress={() => go(-1)} hitSlop={12} style={styles.navBtn}>
          <ArrowLeft size={22} color={colors.primaryStrong} weight="bold" />
          <Text style={styles.navText}>上一张</Text>
        </Pressable>
        <Pressable onPress={() => go(1)} hitSlop={12} style={styles.navBtn}>
          <Text style={styles.navText}>下一张</Text>
          <ArrowRight size={22} color={colors.primaryStrong} weight="bold" />
        </Pressable>
      </View>

      <Button
        label="开始认读小测"
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
  card: { alignItems: 'center', gap: spacing.sm, minHeight: 260, justifyContent: 'center' },
  chip: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 26,
    height: 26,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  char: { fontFamily: fontFamily.display, fontSize: 96, color: colors.fg, fontWeight: '700' },
  pinyin: { fontFamily: fontFamily.body, fontSize: 18, color: colors.primaryStrong, fontWeight: '700' },
  cardBack: { alignItems: 'center', gap: 6, marginTop: spacing.sm },
  word: { fontFamily: fontFamily.body, fontSize: 15, color: colors.fg, fontWeight: '700' },
  sentenceRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  sentence: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2 },
  sentenceHi: { fontFamily: fontFamily.body, fontSize: 14, color: colors.primaryStrong, fontWeight: '700' },
  flipHint: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, marginTop: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
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
  empty: { alignItems: 'center', gap: spacing.md },
  emptyTitle: { fontFamily: fontFamily.display, fontSize: 20, color: colors.fg, fontWeight: '700' },
});
