/**
 * 习惯养成：每日打卡 + 连续天数 + 星星/徽章墙 + 周报。
 * 打卡记录落到进度服务（contentId=habit:<id>），支持离线续算连续天数。
 */
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { CheckCircle, Circle, Star } from 'phosphor-react-native';
import { colors, fontFamily, moduleColor, radius, shadow, spacing } from '../../design/tokens';
import { progressApi } from '../../api/progress';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { useContentActivity } from '../../hooks/useContentActivity';
import { reportError } from '../../lib/errorToast';
import { useMilestones, useWeekReport } from '../../api/hooks';
import { Card, EyeCareTimerBar, Screen } from '../../shared/components';
import { computeStreak, todayKey } from './streak';

interface Habit {
  id: string;
  title: string;
  module: keyof typeof colors.module;
}
const HABITS: Habit[] = [
  { id: 'brush', title: '早晚刷牙', module: 'book' },
  { id: 'sleep', title: '按时睡觉', module: 'math' },
  { id: 'wash', title: '饭前洗手', module: 'literacy' },
  { id: 'read', title: '每天阅读', module: 'song' },
];

function dayKey(d: string): string {
  return d.slice(0, 10);
}

export function HabitScreen() {
  useContentActivity();
  const childId = useAuthStore((s) => s.currentChildId);
  const showToast = useUiStore((s) => s.show);
  const { data: milestones, isLoading: mLoad } = useMilestones(childId ?? '');
  const { data: report } = useWeekReport(childId ?? '');

  const [history, setHistory] = useState<Record<string, string[]>>({});
  const [checkedToday, setCheckedToday] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!childId) return;
    progressApi
      .list(childId)
      .then((items) => {
        const h: Record<string, string[]> = {};
        const today = todayKey();
        const ct: Record<string, boolean> = {};
        for (const it of items) {
          if (it.contentId.startsWith('habit:')) {
            const hid = it.contentId.slice(6);
            (h[hid] ??= []).push(dayKey(it.updatedAt));
            if (dayKey(it.updatedAt) === today) ct[hid] = true;
          }
        }
        setHistory(h);
        setCheckedToday(ct);
      })
      .catch((e) => reportError(e));
  }, [childId]);

  const toggle = async (habit: Habit) => {
    if (!childId) return;
    const today = todayKey();
    const was = !!checkedToday[habit.id];
    const nextToday = { ...checkedToday, [habit.id]: !was };
    const nextHist = { ...history };
    if (was) {
      nextHist[habit.id] = (nextHist[habit.id] ?? []).filter((d) => d !== today);
    } else {
      (nextHist[habit.id] ??= []).push(today);
    }
    setCheckedToday(nextToday);
    setHistory(nextHist);
    try {
      await progressApi.upsert(childId, {
        contentId: `habit:${habit.id}`,
        pageIndex: 0,
        completed: !was,
        score: 1,
      });
      showToast(was ? '取消啦，明天再接再厉' : '打卡成功，多多给你点赞！', was ? 'info' : 'success');
    } catch (e) {
      reportError(e);
    }
  };

  const allDates = useMemo(() => {
    const s = new Set<string>();
    Object.values(history).forEach((arr) => arr.forEach((d) => s.add(d)));
    return s;
  }, [history]);
  const streak = useMemo(() => computeStreak(allDates), [allDates]);
  const stars = useMemo(
    () => Object.values(history).reduce((n, arr) => n + arr.length, 0),
    [history],
  );

  if (!childId) return <Screen><View style={styles.center}><ActivityIndicator color={colors.primary} /></View></Screen>;

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />
      <View style={styles.streakRow}>
        <Card variant="warm" padding="lg" style={styles.streakCard}>
          <Star size={26} color={colors.accent} weight="fill" />
          <Text style={styles.streakNum}>{stars}</Text>
          <Text style={styles.streakLbl}>收集星星</Text>
        </Card>
        <Card variant="warm" padding="lg" style={styles.streakCard}>
          <CheckCircle size={26} color={colors.success} weight="fill" />
          <Text style={styles.streakNum}>{streak}</Text>
          <Text style={styles.streakLbl}>连续天数</Text>
        </Card>
      </View>

      <Text style={styles.section}>今日习惯</Text>
      {HABITS.map((h) => {
        const done = !!checkedToday[h.id];
        return (
          <Card key={h.id} padding="lg" style={styles.habit}>
            <View style={[styles.dot, { backgroundColor: moduleColor(h.module) }]} />
            <Text style={styles.habitTitle}>{h.title}</Text>
            <Pressable onPress={() => toggle(h)} hitSlop={12}>
              {done ? (
                <CheckCircle size={32} color={colors.success} weight="fill" />
              ) : (
                <Circle size={32} color={colors.fg2} weight="bold" />
              )}
            </Pressable>
          </Card>
        );
      })}

      <Text style={styles.section}>徽章墙</Text>
      {mLoad ? (
        <ActivityIndicator color={colors.primary} />
      ) : (
        <View style={styles.badges}>
          {(milestones ?? []).map((m) => {
            const unlocked = !!m.unlockedAt;
            return (
              <Card key={m.id} padding="md" style={[styles.badge, !unlocked && styles.badgeLocked]}>
                <Text style={styles.badgeTitle}>{m.title}</Text>
                <Text style={styles.badgeState}>{unlocked ? '已获得' : '未解锁'}</Text>
              </Card>
            );
          })}
        </View>
      )}

      {report && (
        <Card variant="warm" padding="lg" style={styles.report}>
          <Text style={styles.section}>本周小结</Text>
          <Text style={styles.reportText}>
            阅读 {Math.floor(report.readSec / 60)} 分钟 · 完成 {report.completedCount} 本 · 连续 {report.streakDays} 天
          </Text>
        </Card>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  streakRow: { flexDirection: 'row', gap: spacing.md },
  streakCard: { flex: 1, alignItems: 'center', gap: 2, ...shadow.soft },
  streakNum: { fontFamily: fontFamily.display, fontSize: 28, color: colors.fg, fontWeight: '700' },
  streakLbl: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, fontWeight: '600' },
  section: { fontFamily: fontFamily.display, fontSize: 20, color: colors.fg, fontWeight: '700', marginTop: spacing.sm },
  habit: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dot: { width: 14, height: 14, borderRadius: radius.pill },
  habitTitle: { flex: 1, fontFamily: fontFamily.body, fontSize: 16, color: colors.fg, fontWeight: '700' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  badge: { width: '47%', alignItems: 'center', gap: 2, ...shadow.soft },
  badgeLocked: { opacity: 0.55 },
  badgeTitle: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg, fontWeight: '700' },
  badgeState: { fontFamily: fontFamily.body, fontSize: 11, color: colors.fg2, fontWeight: '600' },
  report: { gap: spacing.xs },
  reportText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '600', lineHeight: 20 },
});
