/**
 * 绘本共读阅读器：分页阅读 + 跟读录音 + 互动问答 + 进度记录 + 试读样章入口。
 * - 进入即按已存进度续读；
 * - 翻页/跟读/答题都会回写进度（含得分）；
 * - 试读样章（sample）对所有儿童可读。
 */
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { ArrowLeft, ArrowRight, CheckCircle, Microphone } from 'phosphor-react-native';
import { colors, fontFamily, moduleColor, radius, shadow, spacing } from '../../design/tokens';
import { useContent } from '../../api/hooks';
import { progressApi } from '../../api/progress';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { useContentActivity } from '../../hooks/useContentActivity';
import { reportError } from '../../lib/errorToast';
import {
  Button,
  Card,
  EyeCareTimerBar,
  ProgressBar,
  Screen,
} from '../../shared/components';
import { NarrationButton } from './NarrationButton';
import { QuizCard } from './QuizCard';

export function BookReaderScreen({ route, navigation }: { route: { params: { id: string } }; navigation: any }) {
  useContentActivity();
  const id = route.params.id;
  const { data: content, isLoading } = useContent(id);
  const childId = useAuthStore((s) => s.currentChildId);
  const showToast = useUiStore((s) => s.show);

  const [pageIndex, setPageIndex] = useState(0);
  const [score, setScore] = useState(0);
  const [recording, setRecording] = useState(false);

  const persist = useCallback(
    async (page: number, completed: boolean, sc: number) => {
      if (!childId || !content) return;
      try {
        await progressApi.upsert(childId, {
          contentId: content.id,
          pageIndex: page,
          completed,
          score: sc,
        });
      } catch (err) {
        reportError(err);
      }
    },
    [childId, content],
  );

  // 续读：按已存进度定位
  useEffect(() => {
    if (!content || !childId) return;
    progressApi
      .snapshot(childId)
      .then((s) => {
        const it = s.items[content.id];
        if (it) setPageIndex(Math.min(it.pageIndex, content.pages.length - 1));
      })
      .catch(() => {});
  }, [content, childId]);

  if (isLoading || !content) {
    return (
      <Screen>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      </Screen>
    );
  }

  const pages = content.pages;
  const page = pages[pageIndex] ?? pages[0]!;
  const quiz = page.questions[0];
  const isLast = pageIndex >= pages.length - 1;
  const c = moduleColor(content.module);

  const go = (dir: 1 | -1) => {
    const next = Math.max(0, Math.min(pages.length - 1, pageIndex + dir));
    if (next === pageIndex) return;
    setPageIndex(next);
    void persist(next, next === pages.length - 1, score);
  };

  const onReadAloudEnd = () => {
    setRecording(false);
    const next = Math.min(100, score + 10);
    setScore(next);
    void persist(pageIndex, isLast, next);
    showToast('跟读完成，多多给你加 10 分！', 'success');
  };

  const onQuiz = (correct: boolean) => {
    if (correct) {
      const next = Math.min(100, score + 10);
      setScore(next);
      void persist(pageIndex, isLast, next);
      showToast('答对啦，真棒！', 'success');
    } else {
      showToast('再想想，多多相信你～', 'warn');
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={24} color={colors.fg} weight="bold" />
        </Pressable>
        <Text style={styles.title} numberOfLines={1}>{content.title}</Text>
        {content.sample && <View style={styles.sampleTag}><Text style={styles.sampleText}>试读</Text></View>}
      </View>

      <ProgressBar value={(pageIndex + 1) / pages.length} color={c} height={8} />

      <Card padding="lg" style={styles.page}>
        <View style={[styles.cover, { backgroundColor: c }]}>
          <Text style={styles.coverText}>第 {pageIndex + 1} 页</Text>
        </View>
        <Text style={styles.pageText}>{page.text}</Text>
        <NarrationButton uri={page.audioUrl} />
      </Card>

      {quiz && <QuizCard question={quiz} onAnswered={onQuiz} />}

      <Pressable
        onPressIn={() => setRecording(true)}
        onPressOut={onReadAloudEnd}
        style={({ pressed }) => [
          styles.readBtn,
          { backgroundColor: recording ? colors.accentStrong : colors.accent, transform: [{ translateY: pressed ? 2 : 0 }] },
        ]}
      >
        <Microphone size={22} color={colors.accentInk} weight="fill" />
        <Text style={styles.readLabel}>{recording ? '说给多多听…松手完成' : '按住跟读'}</Text>
      </Pressable>

      <View style={styles.nav}>
        <Button label="上一页" variant="ghost" onPress={() => go(-1)} disabled={pageIndex === 0} />
        {isLast ? (
          <View style={styles.done}>
            <CheckCircle size={20} color={colors.success} weight="fill" />
            <Text style={styles.doneText}>读完啦</Text>
          </View>
        ) : (
          <Button label="下一页" variant="primary" onPress={() => go(1)} icon={<ArrowRight size={20} color="#FFFFFF" weight="bold" />} />
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { padding: spacing.xs },
  title: { flex: 1, fontFamily: fontFamily.display, fontSize: 20, color: colors.fg, fontWeight: '700' },
  sampleTag: { backgroundColor: colors.primarySoft, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 3 },
  sampleText: { fontFamily: fontFamily.body, fontSize: 11, fontWeight: '700', color: colors.primaryStrong },
  page: { gap: spacing.md },
  cover: { height: 180, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  coverText: { fontFamily: fontFamily.display, fontSize: 22, color: '#FFFFFF', fontWeight: '700' },
  pageText: { fontFamily: fontFamily.body, fontSize: 17, color: colors.fg, lineHeight: 26, fontWeight: '600' },
  readBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    ...shadow.raised,
  },
  readLabel: { fontFamily: fontFamily.body, color: colors.accentInk, fontWeight: '700', fontSize: 16 },
  nav: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  done: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  doneText: { fontFamily: fontFamily.body, fontWeight: '700', color: colors.success, fontSize: 15 },
});
