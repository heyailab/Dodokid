/** 模块内容标签（取 design token 模块色，仅作标签） */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, radius, spacing } from '../../design/tokens';
import { moduleColor, type ModuleKey } from '../../design/tokens';

interface ModuleBadgeProps {
  module: ModuleKey;
  label: string;
}

export function ModuleBadge({ module, label }: ModuleBadgeProps) {
  return (
    <View style={[styles.badge, { backgroundColor: moduleColor(module) }]}>
      <Text style={styles.text}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
  },
  text: {
    color: '#FFFFFF',
    fontFamily: fontFamily.body,
    fontWeight: '700',
    fontSize: 12,
  },
});
