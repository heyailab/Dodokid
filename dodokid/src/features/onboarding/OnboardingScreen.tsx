/**
 * 引导：年龄选择（3-4 / 4-6）+ 多多 IP 引导。
 * 选择即创建儿童档案；创建前由 store 先写同意记录，不采集位置/麦克风/通讯录。
 */
import React, { useState } from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { ArrowRight } from 'phosphor-react-native';
import {
  colors,
  fontFamily,
  radius,
  shadow,
  spacing,
} from '../../design/tokens';
import type { AgeGroup } from '../../api/types';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { reportError } from '../../lib/errorToast';
import { DodoMascot, Button, Screen } from '../../shared/components';

const AGE_CARDS: { group: AgeGroup; label: string; desc: string; color: string }[] = [
  { group: '3-4', label: '3 - 4 岁', desc: '小小探索家', color: colors.module.book },
  { group: '4-6', label: '4 - 6 岁', desc: '快乐小学童', color: colors.module.math },
];

export function OnboardingScreen() {
  const createChild = useAuthStore((s) => s.createChild);
  const showToast = useUiStore((s) => s.show);
  const [name, setName] = useState('');
  const [ageGroup, setAgeGroup] = useState<AgeGroup>('3-4');
  const [submitting, setSubmitting] = useState(false);

  const start = async () => {
    setSubmitting(true);
    try {
      const child = await createChild(name.trim() || '宝宝', ageGroup);
      showToast(`欢迎 ${child.name} 加入多多世界！`, 'success');
    } catch (err) {
      reportError(err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <DodoMascot size={150} mood="happy" />
        <Text style={styles.title}>嗨，我是多多！</Text>
        <Text style={styles.sub}>先选一选宝宝的年纪吧～</Text>
      </View>

      <View style={styles.cards}>
        {AGE_CARDS.map((c) => {
          const selected = ageGroup === c.group;
          return (
            <Pressable
              key={c.group}
              onPress={() => setAgeGroup(c.group)}
              style={[
                styles.ageCard,
                {
                  backgroundColor: selected ? c.color : colors.surface,
                  borderColor: selected ? c.color : colors.border,
                  transform: [{ scale: selected ? 1.02 : 1 }],
                },
              ]}
            >
              <Text style={[styles.ageLabel, { color: selected ? '#FFFFFF' : colors.fg }]}>
                {c.label}
              </Text>
              <Text style={[styles.ageDesc, { color: selected ? '#FFFFFF' : colors.fg2 }]}>
                {c.desc}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <View style={styles.nameBox}>
        <Text style={styles.label}>宝宝叫什么名字？</Text>
        <TextInput
          value={name}
          onChangeText={setName}
          placeholder="选填，默认“宝宝”"
          placeholderTextColor={colors.fg2}
          maxLength={12}
          style={styles.input}
        />
      </View>

      <Text style={styles.consent}>
        开始即代表家长同意《儿童隐私保护政策》，我们不会收集位置、麦克风与通讯录。
      </Text>

      <Button
        label="和多多一起玩"
        variant="accent"
        size="lg"
        fullWidth
        loading={submitting}
        icon={<ArrowRight size={20} color={colors.accentInk} weight="bold" />}
        onPress={start}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.x2l },
  title: { fontFamily: fontFamily.display, fontSize: 30, color: colors.fg, fontWeight: '700' },
  sub: { fontFamily: fontFamily.body, fontSize: 15, color: colors.fg2, fontWeight: '600' },
  cards: { flexDirection: 'row', gap: spacing.md, marginTop: spacing.x3l },
  ageCard: {
    flex: 1,
    borderRadius: radius.xl,
    borderWidth: 2,
    padding: spacing.x2l,
    alignItems: 'center',
    gap: spacing.xs,
    ...shadow.soft,
  },
  ageLabel: { fontFamily: fontFamily.display, fontSize: 24, fontWeight: '700' },
  ageDesc: { fontFamily: fontFamily.body, fontSize: 13, fontWeight: '600' },
  nameBox: { marginTop: spacing.x3l, gap: spacing.sm },
  label: { fontFamily: fontFamily.body, fontSize: 15, color: colors.fg, fontWeight: '700' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 16,
    color: colors.fg,
    fontFamily: fontFamily.body,
    fontWeight: '600',
  },
  consent: {
    fontFamily: fontFamily.body,
    fontSize: 12,
    color: colors.fg2,
    marginTop: spacing.lg,
    lineHeight: 18,
  },
});
