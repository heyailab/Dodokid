/** 内容卡片（封面用模块色占位，生产环境替换为远程 coverUrl） */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ArrowDown, BookOpen, CheckCircle, Trash } from 'phosphor-react-native';
import {
  colors,
  fontFamily,
  moduleColor,
  moduleStrongColor,
  radius,
  shadow,
  spacing,
  type ModuleKey,
} from '../../design/tokens';
import type { ContentItem } from '../../api/types';
import { useDownload } from '../../hooks/useDownload';
import { ModuleBadge } from '../../shared/components';

interface BookCardProps {
  item: ContentItem;
  onPress: () => void;
}

export function BookCard({ item, onPress }: BookCardProps) {
  const c = moduleColor(item.module);
  const strong = moduleStrongColor(item.module as ModuleKey);
  const dl = useDownload(item);
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.card, { transform: [{ translateY: pressed ? 2 : 0 }] }]}
    >
      <View style={[styles.cover, { backgroundColor: c }]}>
        {/* 白图标落在 moduleStrong 深色 chip 上（≥4.7:1），保证非文本对比 ≥3:1 */}
        <View style={[styles.iconChip, { backgroundColor: strong }]}>
          <BookOpen size={28} color="#FFFFFF" weight="fill" />
        </View>
        {item.sample && <View style={styles.sampleTag}><Text style={styles.sampleText}>试读</Text></View>}
        {dl.isDownloaded && (
          <View style={styles.downTag}>
            <CheckCircle size={14} color="#FFFFFF" weight="fill" />
          </View>
        )}
      </View>
      <View style={styles.body}>
        <ModuleBadge module={item.module as ModuleKey} label={item.title} />
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text>
        <View style={styles.foot}>
          <Text style={styles.pages}>{item.pageCount} 页 · 共读 + 跟读</Text>
          {dl.isDownloaded ? (
            <Pressable
              hitSlop={10}
              onPress={(e) => { e.stopPropagation(); void dl.remove(); }}
              style={styles.dlBtn}
            >
              <Trash size={16} color={colors.fg2} weight="bold" />
            </Pressable>
          ) : (
            <Pressable
              hitSlop={10}
              disabled={dl.isDownloading}
              onPress={(e) => { e.stopPropagation(); void dl.download(); }}
              style={styles.dlBtn}
            >
              <ArrowDown size={16} color={colors.primary} weight="bold" />
            </Pressable>
          )}
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    padding: spacing.md,
    gap: spacing.md,
    ...shadow.soft,
  },
  cover: {
    width: 84,
    height: 84,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconChip: {
    width: 48,
    height: 48,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sampleTag: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  sampleText: { fontFamily: fontFamily.body, fontSize: 10, fontWeight: '700', color: colors.fg },
  downTag: {
    position: 'absolute',
    bottom: 6,
    right: 6,
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: 3,
  },
  body: { flex: 1, gap: 4 },
  title: { fontFamily: fontFamily.display, fontSize: 17, color: colors.fg, fontWeight: '700' },
  summary: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, lineHeight: 17 },
  foot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 2 },
  pages: { fontFamily: fontFamily.body, fontSize: 11, color: colors.fg2, fontWeight: '600' },
  dlBtn: { padding: 4 },
});
