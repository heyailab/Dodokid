/**
 * 家长中心（严格家长锁）。
 * 未过锁：仅展示验证入口，不暴露设置/退出/外链（防误触绕过）。
 * 已过锁：每日时长上限、儿童档案、周报、设置入口、退出登录。
 */
import React, { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { Clock, Gear, LockKey, LockOpen, SignOut, UserCircle, Users } from 'phosphor-react-native';
import { colors, fontFamily, radius, shadow, spacing } from '../../design/tokens';
import { parentApi } from '../../api/parent';
import { childApi } from '../../api/child';
import { useAuthStore } from '../../store/authStore';
import { useEyeCareStore } from '../../store/eyeCareStore';
import { useUiStore } from '../../store/uiStore';
import { useContentActivity } from '../../hooks/useContentActivity';
import { reportError } from '../../lib/errorToast';
import { useParentSettings, useWeekReport } from '../../api/hooks';
import { Avatar, Button, Card, EyeCareTimerBar, Screen } from '../../shared/components';

const LIMIT_OPTIONS = [20, 40, 60, 90];

export function ParentCenterScreen({ navigation }: { navigation: any }) {
  useContentActivity();
  const gatePassed = useAuthStore((s) => s.gatePassed);
  const setGatePassed = useAuthStore((s) => s.setGatePassed);
  const children = useAuthStore((s) => s.children);
  const currentChildId = useAuthStore((s) => s.currentChildId);
  const switchChild = useAuthStore((s) => s.switchChild);
  const refreshChildren = useAuthStore((s) => s.refreshChildren);
  const logout = useAuthStore((s) => s.logout);
  const setLimit = useEyeCareStore((s) => s.setLimit);
  const showToast = useUiStore((s) => s.show);

  const { data: settings, isLoading } = useParentSettings();
  const { data: report } = useWeekReport(currentChildId ?? '');

  const [saving, setSaving] = useState(false);

  if (!gatePassed) {
    return (
      <Screen contentStyle={styles.content}>
        <EyeCareTimerBar />
        <View style={styles.locked}>
          <LockKey size={48} color={colors.fg2} weight="fill" />
          <Text style={styles.lockedTitle}>家长中心已上锁</Text>
          <Text style={styles.lockedSub}>需要家长验证才能进入，保护孩子的安全。</Text>
          <Button
            label="家长验证"
            variant="accent"
            icon={<LockKey size={20} color={colors.accentInk} weight="bold" />}
            onPress={() => navigation.navigate('ParentGate', { reason: 'parentCenter' })}
          />
        </View>
      </Screen>
    );
  }

  const currentMin = settings ? Math.round(settings.timeLimitSec / 60) : 40;

  const pickLimit = async (min: number) => {
    setSaving(true);
    try {
      await parentApi.updateTimeLimit({ timeLimitSec: min * 60 });
      setLimit(min * 60);
      showToast(`每日时长已设为 ${min} 分钟`, 'success');
    } catch (e) {
      reportError(e);
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await childApi.remove(id);
      await refreshChildren();
      showToast('已删除该儿童档案', 'info');
    } catch (e) {
      reportError(e);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />
      <View style={styles.head}>
        <Text style={styles.headTitle}>家长中心</Text>
        <Pressable onPress={() => setGatePassed(false)} style={styles.lockBtn}>
          <LockOpen size={20} color={colors.primary} weight="bold" />
          <Text style={styles.lockBtnText}>锁定</Text>
        </Pressable>
      </View>

      <Card padding="lg" style={styles.card}>
        <View style={styles.cardHead}>
          <Clock size={22} color={colors.primary} weight="fill" />
          <Text style={styles.cardTitle}>每日使用时长上限</Text>
        </View>
        {isLoading ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <View style={styles.limits}>
            {LIMIT_OPTIONS.map((m) => {
              const on = currentMin === m;
              return (
                <Pressable
                  key={m}
                  disabled={saving}
                  onPress={() => pickLimit(m)}
                  style={[styles.limitChip, { backgroundColor: on ? colors.primaryStrong : colors.surfaceWarm }]}
                >
                  <Text style={[styles.limitText, { color: on ? '#FFFFFF' : colors.fg }]}>{m} 分</Text>
                </Pressable>
              );
            })}
          </View>
        )}
      </Card>

      <Card padding="lg" style={styles.card}>
        <View style={styles.cardHead}>
          <Users size={22} color={colors.primary} weight="fill" />
          <Text style={styles.cardTitle}>儿童档案</Text>
        </View>
        {children.map((c) => (
          <View key={c.id} style={styles.childRow}>
            <Avatar name={c.name} color={c.avatarColor} size={44} />
            <View style={styles.childInfo}>
              <Text style={styles.childName}>{c.name}</Text>
              <Text style={styles.childAge}>{c.ageGroup} 岁</Text>
            </View>
            {c.id === currentChildId ? (
              <Text style={styles.currentTag}>当前</Text>
            ) : (
              <View style={styles.childActions}>
                <Pressable hitSlop={10} onPress={() => switchChild(c.id)}>
                  <UserCircle size={26} color={colors.fg2} weight="bold" />
                </Pressable>
                <Pressable hitSlop={10} onPress={() => remove(c.id)}>
                  <Text style={styles.delText}>删除</Text>
                </Pressable>
              </View>
            )}
          </View>
        ))}
      </Card>

      {report && (
        <Card variant="warm" padding="lg" style={styles.card}>
          <Text style={styles.cardTitle}>本周报告</Text>
          <Text style={styles.reportText}>
            阅读 {Math.floor(report.readSec / 60)} 分钟 · 完成 {report.completedCount} 本 · 连续 {report.streakDays} 天
          </Text>
        </Card>
      )}

      <Button
        label="设置 / 关于"
        variant="ghost"
        fullWidth
        icon={<Gear size={20} color={colors.fg} weight="bold" />}
        onPress={() => navigation.navigate('Settings')}
      />
      <Button
        label="退出登录"
        variant="ghost"
        fullWidth
        icon={<SignOut size={20} color={colors.danger} weight="bold" />}
        onPress={() => logout()}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: 80 },
  lockedTitle: { fontFamily: fontFamily.display, fontSize: 24, color: colors.fg, fontWeight: '700' },
  lockedSub: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { fontFamily: fontFamily.display, fontSize: 26, color: colors.fg, fontWeight: '700' },
  lockBtn: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  lockBtnText: { fontFamily: fontFamily.body, fontWeight: '700', color: colors.primary, fontSize: 14 },
  card: { gap: spacing.md, ...shadow.soft },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  cardTitle: { fontFamily: fontFamily.body, fontSize: 16, color: colors.fg, fontWeight: '700' },
  limits: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  limitChip: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.pill },
  limitText: { fontFamily: fontFamily.body, fontWeight: '700', fontSize: 14 },
  childRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  childInfo: { flex: 1 },
  childName: { fontFamily: fontFamily.body, fontSize: 15, color: colors.fg, fontWeight: '700' },
  childAge: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, fontWeight: '600' },
  currentTag: { fontFamily: fontFamily.body, fontWeight: '700', color: colors.primary, fontSize: 13 },
  childActions: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  delText: { fontFamily: fontFamily.body, fontWeight: '700', color: colors.danger, fontSize: 13 },
  reportText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '600', lineHeight: 20 },
});
