/**
 * 厚底柔和投影按钮（Claymorphism）。
 * - 最小点击热区 56px；
 * - press 时 translateY(+2) + 投影收缩；
 * - 图标只用 phosphor-react-native（由调用方传入已渲染的图标元素）。
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  PressableStateCallbackType,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { colors, fontFamily, hitMin, radius, shadow, spacing } from '../../design/tokens';

type Variant = 'primary' | 'accent' | 'success' | 'ghost';
type Size = 'md' | 'lg';

interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  icon?: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  testID?: string;
}

function bgFor(variant: Variant): string {
  switch (variant) {
    case 'accent':
      return colors.accent;
    case 'success':
      return colors.success;
    case 'ghost':
      return colors.surface;
    default:
      // P0 无障碍：primary 实心按钮白字底色用 primaryStrong（白字对比 4.95:1 ≥ 4.5:1），
      // 品牌薄荷青 primary(#12B5A6) 白字仅 2.57:1，禁止承载白字。
      return colors.primaryStrong;
  }
}
function fgFor(variant: Variant): string {
  if (variant === 'accent') return colors.accentInk;
  if (variant === 'ghost') return colors.fg;
  return '#FFFFFF';
}

export function Button({
  label,
  onPress,
  variant = 'primary',
  size = 'md',
  icon,
  disabled,
  loading,
  fullWidth,
  testID,
}: ButtonProps) {
  const height = size === 'lg' ? hitMin + 4 : hitMin;

  const base: ViewStyle = {
    minHeight: height,
    backgroundColor: bgFor(variant),
    borderRadius: radius.pill,
    paddingHorizontal: spacing.x2l,
    borderWidth: variant === 'ghost' ? 1.5 : 0,
    borderColor: variant === 'ghost' ? colors.border : 'transparent',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  };

  const pressedStyle = (state: PressableStateCallbackType): ViewStyle => ({
    transform: [{ translateY: state.pressed ? 2 : 0 }],
    ...(state.pressed ? shadow.pressed : shadow.raised),
    opacity: disabled ? 0.55 : 1,
  });

  return (
    <Pressable
      testID={testID}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        base,
        pressedStyle({ pressed }),
        fullWidth ? { width: '100%' } : {},
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fgFor(variant)} />
      ) : (
        <View style={styles.row}>
          {icon}
          <Text
            style={[
              styles.label,
              { color: fgFor(variant), fontSize: size === 'lg' ? 18 : 16 },
            ]}
          >
            {label}
          </Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  label: {
    fontFamily: fontFamily.body,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
});
