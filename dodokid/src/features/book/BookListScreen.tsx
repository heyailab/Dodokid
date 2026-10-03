/**
 * 内容/绘本列表：按年龄路由（仅展示该龄内容 + 试读样章）。
 * module 参数可收窄到具体模块；无结果给友好空态。
 */
import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { colors, fontFamily, spacing, type ModuleKey } from '../../design/tokens';
import { useContentList } from '../../api/hooks';
import { useContentActivity } from '../../hooks/useContentActivity';
import { useAuthStore } from '../../store/authStore';
import { Card, DodoMascot, Screen } from '../../shared/components';
import { BookCard } from './BookCard';
import type { AgeGroup } from '../../api/types';

interface Props {
  route: { params?: { ageGroup?: AgeGroup; module?: ModuleKey } };
  navigation: any;
}

const MODULE_LABEL: Record<ModuleKey, string> = {
  book: '绘本共读',
  habit: '习惯养成',
  song: '儿歌音频',
  literacy: '识字认知',
  math: '数学启蒙',
  english: '英语启蒙',
  puzzle: '益智游戏',
};

export function BookListScreen({ route, navigation }: Props) {
  useContentActivity();
  const ageGroup = route.params?.ageGroup;
  const module = route.params?.module;
  const childAge = useAuthStore(
    (s) => s.children.find((c) => c.id === s.currentChildId)?.ageGroup,
  );
  const effectiveAge = ageGroup ?? childAge;

  const { data, isLoading } = useContentList(effectiveAge);
  const list = (data ?? []).filter((b) => (module ? b.module === module : true));

  return (
    <Screen scroll contentStyle={styles.content}>
      <Text style={styles.heading}>{module ? MODULE_LABEL[module] : '内容库'}</Text>
      <Text style={styles.sub}>
        {effectiveAge ? `${effectiveAge} 岁适龄内容` : '全部内容'}，试读样章随时可读
      </Text>

      {isLoading ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : list.length === 0 ? (
        <Card variant="warm" padding="x2l" style={styles.empty}>
          <DodoMascot size={96} mood="happy" />
          <Text style={styles.emptyTitle}>这个模块正在上新～</Text>
          <Text style={styles.emptySub}>先去读读试读样章吧！</Text>
        </Card>
      ) : (
        <FlatList
          data={list}
          keyExtractor={(i) => i.id}
          renderItem={({ item }) => (
            <BookCard item={item} onPress={() => navigation.navigate('BookReader', { id: item.id })} />
          )}
          contentContainerStyle={styles.list}
          scrollEnabled={false}
          ItemSeparatorComponent={() => <View style={{ height: spacing.md }} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.sm },
  heading: { fontFamily: fontFamily.display, fontSize: 28, color: colors.fg, fontWeight: '700' },
  sub: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600', marginBottom: spacing.md },
  center: { paddingVertical: spacing.x4l, alignItems: 'center' },
  list: { gap: spacing.md, paddingBottom: spacing.x2l },
  empty: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.x2l },
  emptyTitle: { fontFamily: fontFamily.display, fontSize: 20, color: colors.fg, fontWeight: '700' },
  emptySub: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600' },
});
