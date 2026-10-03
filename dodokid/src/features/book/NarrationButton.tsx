/**
 * 绘本旁白播放（expo-audio）。按压播放/暂停。
 * 远程音频在生产环境由 mediaUrl 提供；mock 阶段无真实音频，静默失败不阻断阅读。
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Pause, Play } from 'phosphor-react-native';
import { useAudioPlayer } from 'expo-audio';
import { colors, fontFamily, radius, shadow, spacing } from '../../design/tokens';

interface Props {
  uri: string;
}

export function NarrationButton({ uri }: Props) {
  const player = useAudioPlayer(uri);
  const [playing, setPlaying] = useState(false);

  const toggle = () => {
    try {
      if (playing) {
        player.pause();
        setPlaying(false);
      } else {
        player.play();
        setPlaying(true);
      }
    } catch {
      setPlaying(false);
    }
  };

  return (
    <Pressable
      onPress={toggle}
      style={({ pressed }) => [
        styles.btn,
        { transform: [{ translateY: pressed ? 2 : 0 }] },
      ]}
    >
      <View style={styles.icon}>
        {playing ? (
          <Pause size={20} color="#FFFFFF" weight="fill" />
        ) : (
          <Play size={20} color="#FFFFFF" weight="fill" />
        )}
      </View>
      <Text style={styles.label}>{playing ? '暂停旁白' : '听多多讲'}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  btn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    // P0 无障碍：白字/白图标底色须 ≥4.5:1，primary(#12B5A6) 仅 2.57:1
    backgroundColor: colors.primaryStrong,
    borderRadius: radius.pill,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xl,
    ...shadow.raised,
  },
  icon: { width: 20, height: 20, alignItems: 'center', justifyContent: 'center' },
  label: { fontFamily: fontFamily.body, color: '#FFFFFF', fontWeight: '700', fontSize: 15 },
});
