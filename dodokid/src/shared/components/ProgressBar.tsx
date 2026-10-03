/** 通用线性进度条 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../../design/tokens';

interface ProgressBarProps {
  value: number; // 0..1
  color?: string;
  height?: number;
}

export function ProgressBar({ value, color = colors.primary, height = 10 }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  return (
    <View style={[styles.track, { height }]}>
      <View
        style={[
          styles.fill,
          { width: `${clamped * 100}%`, backgroundColor: color },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    backgroundColor: colors.border,
    borderRadius: radius.pill,
    overflow: 'hidden',
  },
  fill: { height: '100%', borderRadius: radius.pill },
});
