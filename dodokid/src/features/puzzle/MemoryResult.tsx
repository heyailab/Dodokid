/**
 * 益智游戏 — 结算卡片。
 *
 * 防沉迷（AC-21）：结算页**不得**提供无冷却的「再来一局」。
 * 这里给「再来一局」加 5 秒冷却，冷却期间按钮禁用并显示倒计时，
 * 同时给出护眼提示 —— 用交互成本换取「停止一下」的缓冲，而不是靠文案劝阻。
 */
import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Star } from 'phosphor-react-native';
import { colors, fontFamily, spacing } from '../../design/tokens';
import { Button, Card } from '../../shared/components';

/** 冷却秒数：既要挡住连点，又不能长到让儿童失去耐心 */
export const RESTART_COOLDOWN_SEC = 5;

const STAR_SLOTS = [0, 1, 2];

interface Props {
  stars: number;
  flips: number;
  pairs: number;
  onRestart: () => void;
  onExit: () => void;
}

export function MemoryResult({ stars, flips, pairs, onRestart, onExit }: Props) {
  const [left, setLeft] = useState(RESTART_COOLDOWN_SEC);

  useEffect(() => {
    const id = setInterval(() => {
      setLeft((n) => (n > 0 ? n - 1 : 0));
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const cooled = left > 0;

  return (
    <Card padding="x2l" style={styles.card}>
      <Text style={styles.title}>全部配对成功！</Text>

      <View style={styles.stars}>
        {STAR_SLOTS.map((i) => (
          <Star
            key={i}
            size={30}
            weight={i < stars ? 'fill' : 'regular'}
            color={i < stars ? colors.accent : colors.border}
          />
        ))}
      </View>

      <Text style={styles.line}>
        翻牌 {flips} 次 · 共 {pairs} 组
      </Text>
      <Text style={styles.hint}>先歇一会儿，眼睛也要放假哦</Text>

      <Button
        label={cooled ? `再来一局（${left}s）` : '再来一局'}
        disabled={cooled}
        onPress={onRestart}
      />
      <Button label="回到首页" variant="ghost" onPress={onExit} />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { alignItems: 'center', gap: spacing.sm },
  title: { fontFamily: fontFamily.display, fontSize: 24, color: colors.fg, fontWeight: '700' },
  stars: { flexDirection: 'row', gap: spacing.sm, marginVertical: spacing.xs },
  line: { fontFamily: fontFamily.body, fontSize: 15, color: colors.fg2, fontWeight: '700' },
  hint: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, marginBottom: spacing.sm },
});
