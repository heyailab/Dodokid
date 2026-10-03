/** 全局 Toast：读取 uiStore，自动隐藏 */
import React, { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useUiStore, type ToastKind } from '../../store/uiStore';
import { colors, fontFamily, radius, spacing } from '../../design/tokens';

const kindColor: Record<ToastKind, string> = {
  info: colors.info,
  success: colors.success,
  warn: colors.warn,
  danger: colors.danger,
};

export function Toast() {
  const message = useUiStore((s) => s.message);
  const kind = useUiStore((s) => s.kind);
  const seq = useUiStore((s) => s.seq);
  const hide = useUiStore((s) => s.hide);

  useEffect(() => {
    if (!message) return;
    const id = setTimeout(() => hide(), 2600);
    return () => clearTimeout(id);
  }, [message, seq, hide]);

  if (!message) return null;

  return (
    <View style={styles.wrap} pointerEvents="none">
      <View style={[styles.bubble, { borderLeftColor: kindColor[kind] }]}>
        <Text style={[styles.text, { color: colors.fg }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 90,
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    zIndex: 50,
  },
  bubble: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    borderLeftWidth: 5,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    maxWidth: '90%',
    ...{
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.16,
      shadowRadius: 10,
      elevation: 6,
    },
  },
  text: { fontFamily: fontFamily.body, fontWeight: '600', fontSize: 14, textAlign: 'center' },
});
