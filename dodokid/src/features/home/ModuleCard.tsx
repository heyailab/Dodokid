/**
 * 首页模块入口卡片（糖果圆润，模块色块 + 中性底标签区）。
 * 无障碍（P0）：白色图标落在 moduleStrong 深色 chip（≥4.7:1）；
 * 标签文字置于中性 surface 底（fg 对比 ≥10:1），不再直接压浅模块色（原 1.44–2.51:1 不达标）。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import {
  BookOpen,
  Calculator,
  CalendarCheck,
  GameController,
  MusicNotes,
  PuzzlePiece,
  Translate,
} from 'phosphor-react-native';
import {
  colors,
  fontFamily,
  moduleStrongColor,
  radius,
  shadow,
  spacing,
  type ModuleKey,
} from '../../design/tokens';

const ICONS: Record<ModuleKey, React.ReactNode> = {
  book: <BookOpen size={28} color="#FFFFFF" weight="fill" />,
  habit: <CalendarCheck size={28} color="#FFFFFF" weight="fill" />,
  song: <MusicNotes size={28} color="#FFFFFF" weight="fill" />,
  literacy: <PuzzlePiece size={28} color="#FFFFFF" weight="fill" />,
  math: <Calculator size={28} color="#FFFFFF" weight="fill" />,
  english: <Translate size={28} color="#FFFFFF" weight="fill" />,
  puzzle: <GameController size={28} color="#FFFFFF" weight="fill" />,
};

interface ModuleCardProps {
  module: ModuleKey;
  label: string;
  color: string;
  onPress: () => void;
}

export function ModuleCard({ module, label, color, onPress }: ModuleCardProps) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { transform: [{ translateY: pressed ? 2 : 0 }] },
      ]}
    >
      <View style={[styles.colorArea, { backgroundColor: color }]}>
        <View style={[styles.iconChip, { backgroundColor: moduleStrongColor(module) }]}>
          {ICONS[module]}
        </View>
      </View>
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '47%',
    aspectRatio: 1.15,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
    ...shadow.soft,
  },
  colorArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 白图标落在 moduleStrong 深色 chip 上（≥4.7:1），而非浅色模块标签色（原 1.44–2.95:1 不达标）
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // 标签在 neutral surface 底上：fg(#3A3A3A) vs surface(#FFFFFF) ≈ 10:1
  label: {
    fontFamily: fontFamily.display,
    fontSize: 17,
    color: colors.fg,
    fontWeight: '700',
    textAlign: 'center',
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.xs,
  },
});
