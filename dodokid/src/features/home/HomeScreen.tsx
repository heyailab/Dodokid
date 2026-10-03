/**
 * 儿童模式首页：模块宫格 + 护眼计时条 + 多多 IP 引导。
 * 年龄路由：内容按当前儿童 ageGroup 过滤；试读样章始终可见（取自后台可配置的样章）。
 */
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { BookOpen } from 'phosphor-react-native';
import { colors, fontFamily, moduleColor, spacing, type ModuleKey } from '../../design/tokens';
import { useAuthStore } from '../../store/authStore';
import { useContentActivity } from '../../hooks/useContentActivity';
import { contentApi } from '../../api/content';
import {
  Avatar,
  Card,
  DodoMascot,
  EyeCareTimerBar,
  Screen,
} from '../../shared/components';
import { ModuleCard } from './ModuleCard';

const MODULES: { key: ModuleKey; label: string }[] = [
  { key: 'book', label: '绘本共读' },
  { key: 'habit', label: '习惯养成' },
  { key: 'song', label: '儿歌音频' },
  { key: 'literacy', label: '识字认知' },
  { key: 'math', label: '数学启蒙' },
  { key: 'english', label: '英语启蒙' },
  { key: 'puzzle', label: '益智游戏' },
];

export function HomeScreen({ navigation }: { navigation: any }) {
  useContentActivity();
  const child = useAuthStore((s) =>
    s.children.find((c) => c.id === s.currentChildId),
  );
  const ageGroup = child?.ageGroup;

  // v1.2.1：试读样章取自后台可配置接口；失败或无样章时回退到内置 'b-sleep'
  const { data: samples } = useQuery({
    queryKey: ['content', 'samples', ageGroup ?? 'all'],
    queryFn: () => contentApi.samples(ageGroup),
  });
  const sampleItem = samples && samples.length > 0 ? samples[0] : null;

  const openModule = (key: ModuleKey) => {
    // 识字认知 / 数学启蒙为独立互动模块（路线图 P2）；其余模块复用内容列表
    if (key === 'literacy') {
      navigation.navigate('Literacy');
      return;
    }
    if (key === 'math') {
      navigation.navigate('Math');
      return;
    }
    if (key === 'english') {
      navigation.navigate('English');
      return;
    }
    if (key === 'puzzle') {
      navigation.navigate('Puzzle');
      return;
    }
    navigation.navigate('BookList', { ageGroup: child?.ageGroup, module: key });
  };

  const openSample = () =>
    navigation.navigate('BookReader', { id: sampleItem?.id ?? 'b-sleep' });

  return (
    <Screen scroll contentStyle={styles.content}>
      <EyeCareTimerBar />
      <View style={styles.greet}>
        <View>
          <Text style={styles.hi}>{child ? `${child.name}，今天想玩什么？` : '今天想玩什么？'}</Text>
          <Text style={styles.tip}>和多多一起，开心学一点</Text>
        </View>
        {child && <Avatar name={child.name} color={child.avatarColor} size={52} />}
      </View>

      <Card variant="warm" padding="lg" style={styles.dodoCard}>
        <DodoMascot size={84} mood="happy" />
        <View style={styles.dodoText}>
          <Text style={styles.dodoTitle}>多多的小建议</Text>
          <Text style={styles.dodoSub}>每读完一本绘本，就能收集一颗小星星哦。</Text>
        </View>
      </Card>

      <View style={styles.grid}>
        {MODULES.map((m) => (
          <ModuleCard
            key={m.key}
            module={m.key}
            label={m.label}
            color={moduleColor(m.key)}
            onPress={() => openModule(m.key)}
          />
        ))}
      </View>

      <Card padding="lg" style={styles.sample}>
        <View style={styles.sampleLeft}>
          <BookOpen size={24} color={colors.primary} weight="fill" />
          <View>
            <Text style={styles.sampleTitle}>试读样章 · {sampleItem?.title ?? '多多睡觉啦'}</Text>
            <Text style={styles.sampleSub}>不用登录也能读一页看看～</Text>
          </View>
        </View>
        <Text style={styles.sampleGo} onPress={openSample}>
          去读 →
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  greet: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing.sm },
  hi: { fontFamily: fontFamily.display, fontSize: 22, color: colors.fg, fontWeight: '700' },
  tip: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600', marginTop: 2 },
  dodoCard: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  dodoText: { flex: 1 },
  dodoTitle: { fontFamily: fontFamily.body, fontWeight: '700', fontSize: 15, color: colors.fg },
  dodoSub: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, marginTop: 2, lineHeight: 18 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.md },
  sample: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sampleLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, flex: 1 },
  sampleTitle: { fontFamily: fontFamily.body, fontWeight: '700', fontSize: 15, color: colors.fg },
  sampleSub: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, marginTop: 2 },
  sampleGo: { fontFamily: fontFamily.display, fontSize: 16, color: colors.primary, fontWeight: '700' },
});
