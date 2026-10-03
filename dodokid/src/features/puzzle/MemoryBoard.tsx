/**
 * 益智游戏 — 记忆翻牌牌面（纯展示组件）。
 * 只接收状态与回调，不含游戏逻辑，便于独立渲染测试。
 *
 * 无障碍（P0）：卡面白图标一律落在 moduleStrong 深色底上（白底 ≥4.7:1）；
 * 配对的卡额外加 success 描边区分，而不是降低不透明度（避免对比度被削弱）。
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Sparkle } from 'phosphor-react-native';
import {
  colors,
  fontFamily,
  moduleStrongColor,
  radius,
  shadow,
  spacing,
} from '../../design/tokens';
import { isFaceUp, type BoardState } from './memoryLogic';
import { MemoryFace } from './MemoryFace';

interface Props {
  state: BoardState;
  columns: number;
  onFlip: (index: number) => void;
}

export function MemoryBoard({ state, columns, onFlip }: Props) {
  const strong = moduleStrongColor('puzzle');
  const tileWidth = `${Math.floor(100 / columns) - 2}%` as const;

  return (
    <View style={styles.grid}>
      {state.cards.map((card, index) => {
        const faceUp = isFaceUp(state, index);
        return (
          <Pressable
            key={card.id}
            testID={`memory-card-${index}`}
            accessibilityLabel={faceUp ? `已翻开的卡片 ${index + 1}` : `未翻开的卡片 ${index + 1}`}
            onPress={() => onFlip(index)}
            style={[
              styles.tile,
              { width: tileWidth },
              faceUp ? { backgroundColor: strong } : styles.tileDown,
              card.matched && styles.tileMatched,
            ]}
          >
            {faceUp ? (
              <MemoryFace face={card.face} size={30} />
            ) : (
              <Sparkle size={26} color={strong} weight="fill" />
            )}
          </Pressable>
        );
      })}
    </View>
  );
}

/** 牌面下方的状态条：已配对数 + 翻牌次数 */
export function MemoryHud({ state, pairs }: { state: BoardState; pairs: number }) {
  return (
    <View style={styles.hud}>
      <Text style={styles.hudText}>
        已配对 {state.matchedPairs} / {pairs}
      </Text>
      <Text style={styles.hudText}>翻牌 {state.flips} 次</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: spacing.md,
  },
  tile: {
    aspectRatio: 1,
    borderRadius: radius.lg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow.soft,
  },
  tileDown: { backgroundColor: colors.surface },
  tileMatched: { borderWidth: 2, borderColor: colors.success },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  hudText: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '700' },
});
