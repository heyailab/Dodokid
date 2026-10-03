/**
 * 原创吉祥物 IP「多多(Dodo)」渡渡鸟 —— 纯 RN View 绘制，零外部依赖，无 emoji。
 * 跨屏引导用。mood: happy（睁眼）/ sleep（闭眼，护眼达限时）。
 */
import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '../../design/tokens';

interface DodoMascotProps {
  size?: number;
  mood?: 'happy' | 'sleep';
}

export function DodoMascot({ size = 120, mood = 'happy' }: DodoMascotProps) {
  const s = size / 120; // 缩放基准
  return (
    <View style={{ width: size, height: size }} accessibilityRole="image">
      {/* 身体 */}
      <View
        style={[
          styles.body,
          { width: 84 * s, height: 92 * s, left: 18 * s, top: 22 * s, borderRadius: 60 * s, backgroundColor: colors.primary },
        ]}
      />
      {/* 肚皮 */}
      <View
        style={[
          styles.belly,
          { width: 52 * s, height: 56 * s, left: 34 * s, top: 46 * s, borderRadius: 40 * s, backgroundColor: colors.primarySoft },
        ]}
      />
      {/* 头顶呆毛 */}
      <View
        style={[
          styles.tuft,
          { width: 10 * s, height: 22 * s, left: 60 * s, top: 4 * s, borderRadius: 6 * s, backgroundColor: colors.accent, transform: [{ rotate: '12deg' }] },
        ]}
      />
      {/* 眼睛 */}
      {mood === 'happy' ? (
        <View style={[styles.eyeWhite, { width: 22 * s, height: 22 * s, left: 40 * s, top: 34 * s, borderRadius: 11 * s }]}>
          <View style={[styles.eyeDot, { width: 9 * s, height: 9 * s, borderRadius: 5 * s }]} />
        </View>
      ) : (
        <View style={[styles.eyeClosed, { width: 22 * s, height: 5 * s, left: 40 * s, top: 44 * s, borderRadius: 3 * s, backgroundColor: colors.fg }]} />
      )}
      {/* 喙 */}
      <View
        style={[
          styles.beak,
          { width: 22 * s, height: 16 * s, left: 44 * s, top: 54 * s, borderRadius: 8 * s, backgroundColor: colors.accent },
        ]}
      />
      {/* 腮红 */}
      <View style={[styles.cheek, { width: 14 * s, height: 10 * s, left: 30 * s, top: 56 * s, borderRadius: 6 * s, backgroundColor: colors.surfaceWarm }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  body: { position: 'absolute' },
  belly: { position: 'absolute' },
  tuft: { position: 'absolute' },
  eyeWhite: {
    position: 'absolute',
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  eyeDot: { position: 'absolute', backgroundColor: colors.fg },
  eyeClosed: { position: 'absolute' },
  beak: { position: 'absolute' },
  cheek: { position: 'absolute', opacity: 0.8 },
});
