/**
 * 数学启蒙模块（路线图 P2 第二个模块）：玩法选择 → 三类练习（数一数 / 比大小 / 算一算）。
 * - 按儿童年龄决定难度（mathData.rangeFor）；
 * - 练习得分回写进度（contentId=`math:<kind>`）；
 * - 计入护眼计时（内容消费路由）。
 */
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowLeft, Calculator, PlusCircle, Scales } from 'phosphor-react-native';
import { colors, fontFamily, moduleStrongColor, radius, shadow, spacing } from '../../design/tokens';
import { useAuthStore } from '../../store/authStore';
import { useContentActivity } from '../../hooks/useContentActivity';
import { progressApi } from '../../api/progress';
import { reportError } from '../../lib/errorToast';
import { Card, EyeCareTimerBar, Screen } from '../../shared/components';
import { MATH_ACTIVITIES, rangeFor, type MathKind } from './mathData';
import { MathPractice } from './MathPractice';

const ICONS: Record<MathKind, React.ReactNode> = {
  count: <Calculator size={24} color="#FFFFFF" weight="fill" />,
  compare: <Scales size={24} color="#FFFFFF" weight="fill" />,
  add: <PlusCircle size={24} color="#FFFFFF" weight="fill" />,
};

export function MathScreen({ navigation }: { navigation: any }) {
  useContentActivity();
  const childId = useAuthStore((s) => s.currentChildId);
  const ageGroup = useAuthStore(
    (s) => s.children.find((c) => c.id === s.currentChildId)?.ageGroup,
  );
  const [kind, setKind] = useState<MathKind | null>(null);
  const range = rangeFor(ageGroup);

  const finish = (score: number) => {
    if (!childId || !kind) return;
    progressApi
      .upsert(childId, { contentId: `math:${kind}`, pageIndex: 0, completed: true, score })
      .catch(reportError);
  };

  if (kind) {
    return (
      <Screen scroll contentStyle={styles.content}>
        <EyeCareTimerBar />
        <MathPractice
          kind={kind}
          age={ageGroup}
          onFinish={finish}
          onExit={() => setKind(null)}
        />
      </Screen>
    );
  }

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />

      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12} style={styles.back}>
          <ArrowLeft size={24} color={colors.fg} weight="bold" />
        </Pressable>
        <Text style={styles.heading}>数学启蒙</Text>
      </View>
      <Text style={styles.sub}>
        {ageGroup ? `${ageGroup} 岁难度` : '基础难度'} · 每次 {range.sessionSize} 题
      </Text>

      <View style={styles.list}>
        {MATH_ACTIVITIES.map((a) => (
          <Pressable key={a.kind} onPress={() => setKind(a.kind)}>
            <Card padding="lg" style={styles.item}>
              <View style={[styles.chip, { backgroundColor: moduleStrongColor('math') }]}>
                {ICONS[a.kind]}
              </View>
              <View style={styles.itemText}>
                <Text style={styles.itemTitle}>{a.label}</Text>
                <Text style={styles.itemDesc}>{a.desc}</Text>
              </View>
            </Card>
          </Pressable>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  top: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  back: { padding: 4 },
  heading: { fontFamily: fontFamily.display, fontSize: 26, color: colors.fg, fontWeight: '700' },
  sub: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600', marginBottom: spacing.md },
  list: { gap: spacing.md },
  item: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  chip: {
    width: 46,
    height: 46,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    ...shadow.soft,
  },
  itemText: { flex: 1, gap: 2 },
  itemTitle: { fontFamily: fontFamily.display, fontSize: 18, color: colors.fg, fontWeight: '700' },
  itemDesc: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2 },
});
