/** 儿童头像：首字母 + 主题色圆 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fontFamily, radius } from '../../design/tokens';

interface AvatarProps {
  name: string;
  color: string;
  size?: number;
}

export function Avatar({ name, color, size = 56 }: AvatarProps) {
  const initial = name.trim().charAt(0) || '宝';
  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: radius.pill, backgroundColor: color },
      ]}
    >
      <Text style={[styles.text, { fontSize: size * 0.4, color: '#FFFFFF' }]}>
        {initial}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { alignItems: 'center', justifyContent: 'center' },
  text: { fontFamily: fontFamily.display, fontWeight: '700' },
});
