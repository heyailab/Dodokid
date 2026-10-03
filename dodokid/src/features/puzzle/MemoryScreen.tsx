/**
 * 益智游戏（路线图 P2 第四个模块）：记忆翻牌。
 * - 分龄难度：3-4 岁 4 组 / 4-6 岁 6 组（见 memoryData）；
 * - 游戏状态机由 memoryLogic 纯函数驱动，本屏只做编排、计时与进度回写；
 * - 计入护眼计时（AC-21：达限由 RootNavigator 统一 reset 到阻断屏，本屏无需自处理）；
 * - 清盘后按翻牌次数折算百分制回写（contentId=`puzzle:memory`）。
 */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft } from 'phosphor-react-native';
import { colors, fontFamily, spacing } from '../../design/tokens';
import { useAuthStore } from '../../store/authStore';
import { useContentActivity } from '../../hooks/useContentActivity';
import { progressApi } from '../../api/progress';
import { reportError } from '../../lib/errorToast';
import { Card, EyeCareTimerBar, Screen } from '../../shared/components';
import { MemoryBoard, MemoryHud } from './MemoryBoard';
import { MemoryResult } from './MemoryResult';
import {
  createBoard,
  flipCard,
  isCleared,
  resolveMismatch,
  scoreFor,
  starFor,
  type BoardState,
} from './memoryLogic';
import { levelFor } from './memoryData';

/** 异面卡展示时长：够看清两张图案，又不至于让 3-4 岁等得不耐烦 */
const MISMATCH_DELAY_MS = 900;
const PROGRESS_ID = 'puzzle:memory';

export function MemoryScreen({ navigation }: { navigation: any }) {
  useContentActivity();
  const childId = useAuthStore((s) => s.currentChildId);
  const ageGroup = useAuthStore(
    (s) => s.children.find((c) => c.id === s.currentChildId)?.ageGroup,
  );
  const level = useMemo(() => levelFor(ageGroup), [ageGroup]);
  const [state, setState] = useState<BoardState>(() => createBoard(levelFor(ageGroup)));
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 清盘与否由牌面状态派生（不用额外 state，避免 effect 内同步 setState 的级联渲染）
  const cleared = isCleared(state);

  // 两张异面：短暂展示后自动翻回（锁定期间禁止再翻，见 memoryLogic.flipCard）
  useEffect(() => {
    if (!state.locked) return;
    timer.current = setTimeout(() => setState((s) => resolveMismatch(s)), MISMATCH_DELAY_MS);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [state.locked]);

  // 清盘后回写一次进度（按翻牌次数折算百分制）。
  // 清盘后已无可翻的卡，state 不再变化，故本 effect 只会触发一次。
  useEffect(() => {
    if (!cleared || !childId) return;
    progressApi
      .upsert(childId, {
        contentId: PROGRESS_ID,
        pageIndex: 0,
        completed: true,
        score: scoreFor(state.flips, level),
      })
      .catch(reportError);
  }, [cleared, childId, level, state.flips]);

  const flip = (index: number) => setState((s) => flipCard(s, index));

  const restart = () => setState(createBoard(level));

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />

      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={24} color={colors.fg} weight="bold" />
        </Pressable>
        <Text style={styles.heading}>记忆翻牌</Text>
      </View>

      <Card padding="lg">
        {cleared ? (
          <MemoryResult
            stars={starFor(state.flips, level)}
            flips={state.flips}
            pairs={level.pairs}
            onRestart={restart}
            onExit={() => navigation.goBack()}
          />
        ) : (
          <View style={styles.play}>
            <MemoryHud state={state} pairs={level.pairs} />
            <MemoryBoard state={state} columns={level.columns} onFlip={flip} />
            <Text style={styles.tip}>翻开两张一样的图案，就能配对成功</Text>
          </View>
        )}
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { padding: 4 },
  heading: {
    fontFamily: fontFamily.display,
    fontSize: 26,
    color: colors.fg,
    fontWeight: '700',
    flex: 1,
  },
  play: { gap: spacing.md },
  tip: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.fg2,
    fontWeight: '600',
    textAlign: 'center',
  },
});
