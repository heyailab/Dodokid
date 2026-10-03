/**
 * 护眼达限阻断屏（P0 不可跳过）。
 * 作为独立全屏路由渲染：达限即切换到本屏，卸载所有内容屏 → 自动停止当前内容。
 * 仅暴露「家长验证」入口（弹出家长锁 Modal），儿童无法关闭或绕过。
 * 温和晚安提示 + 睡眠态多多 IP。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { LockKey } from 'phosphor-react-native';
import { colors, fontFamily, radius, spacing } from '../../design/tokens';
import { DodoMascot } from './DodoMascot';
import { Button } from './Button';

interface Props {
  onParentVerify: () => void;
}

export function EyeCareBlockedScreen({ onParentVerify }: Props) {
  return (
    <View style={styles.backdrop}>
      <View style={styles.card}>
        <DodoMascot size={132} mood="sleep" />
        <Text style={styles.title}>今天玩够啦</Text>
        <Text style={styles.sub}>
          多多也困了，早点休息，明天再一起玩吧。{'\n'}需要继续？请家长验证。
        </Text>
        <Button
          label="家长验证"
          variant="accent"
          fullWidth
          icon={<LockKey size={20} color={colors.accentInk} weight="bold" />}
          onPress={onParentVerify}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.primarySoft,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.x3l,
  },
  card: {
    width: '100%',
    backgroundColor: colors.surface,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.x3l,
    alignItems: 'center',
    gap: spacing.md,
  },
  title: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.fg,
    fontWeight: '700',
  },
  sub: {
    fontFamily: fontFamily.body,
    fontSize: 15,
    color: colors.fg2,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: spacing.sm,
  },
});
