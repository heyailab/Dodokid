/** Claymorphism 卡片：圆润、厚底柔影、浅描边 */
import React from 'react';
import { StyleSheet, View, type StyleProp, ViewStyle } from 'react-native';
import { colors, radius, shadow, spacing } from '../../design/tokens';

interface CardProps {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  padding?: keyof typeof spacing;
  variant?: 'surface' | 'warm';
}

export function Card({ children, style, padding = 'lg', variant = 'surface' }: CardProps) {
  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: variant === 'warm' ? colors.surfaceWarm : colors.surface,
          padding: spacing[padding],
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
});
