/**
 * 护眼计时条（儿童模式顶部常驻）。
 * 颜色随用量递进：正常 primary → 临近 warn → 达限 danger。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Clock } from 'phosphor-react-native';
import { useEyeCareStore } from '../../store/eyeCareStore';
import { colors, fontFamily, radius, spacing } from '../../design/tokens';
import { ProgressBar } from './ProgressBar';

function fmt(sec: number): string {
  const m = Math.floor(sec / 60);
  return `${m}`;
}

export function EyeCareTimerBar() {
  const used = useEyeCareStore((s) => s.dailyUsedSec);
  const limit = useEyeCareStore((s) => s.dailyLimitSec);
  const ratio = limit > 0 ? used / limit : 0;
  const color = ratio >= 1 ? colors.danger : ratio >= 0.85 ? colors.warn : colors.primary;
  const remain = Math.max(0, limit - used);

  return (
    <View style={styles.wrap} accessibilityLabel={`今日已用 ${fmt(used)} 分钟，上限 ${fmt(limit)} 分钟`}>
      <View style={styles.head}>
        <Clock size={16} color={color} weight="bold" />
        <Text style={[styles.text, { color: colors.fg2 }]}>
          护眼 · 已用 {fmt(used)} 分 / 剩 {fmt(remain)} 分
        </Text>
      </View>
      <ProgressBar value={ratio} color={color} height={8} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    gap: spacing.xs,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  text: {
    fontFamily: fontFamily.body,
    fontWeight: '600',
    fontSize: 12,
    borderRadius: radius.sm,
  },
});
