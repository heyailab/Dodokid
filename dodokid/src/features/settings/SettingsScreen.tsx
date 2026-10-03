/**
 * 设置 / 关于：隐私政策、删除数据入口、偏好、版本信息。
 * 仅在家长锁通过后可达；未过锁时给验证入口（防绕过）。
 */
import React, { useEffect, useState } from 'react';
import { Linking, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { ArrowLeft, Info, LockKey, ShieldCheck, Trash } from 'phosphor-react-native';
import { colors, fontFamily, shadow, spacing } from '../../design/tokens';
import { systemApi } from '../../api/system';
import { childApi } from '../../api/child';
import { useAuthStore } from '../../store/authStore';
import { useUiStore } from '../../store/uiStore';
import { reportError } from '../../lib/errorToast';
import { Button, Card, Screen } from '../../shared/components';
import type { VersionInfo } from '../../api/types';

export function SettingsScreen({ navigation }: { navigation: any }) {
  const gatePassed = useAuthStore((s) => s.gatePassed);
  const childId = useAuthStore((s) => s.currentChildId);
  const logout = useAuthStore((s) => s.logout);
  const showToast = useUiStore((s) => s.show);
  const [version, setVersion] = useState<VersionInfo | null>(null);
  const [audio, setAudio] = useState(true);
  const [confirmDel, setConfirmDel] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    systemApi
      .getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  if (!gatePassed) {
    return (
      <Screen contentStyle={styles.content}>
        <View style={styles.locked}>
          <LockKey size={44} color={colors.fg2} weight="fill" />
          <Text style={styles.lockedTitle}>设置已上锁</Text>
          <Button label="家长验证" variant="accent" onPress={() => navigation.navigate('ParentGate', { reason: 'settings' })} />
        </View>
      </Screen>
    );
  }

  const openPrivacy = async () => {
    try {
      const p = await systemApi.getPrivacyPolicy();
      await Linking.openURL(p.url);
    } catch (e) {
      reportError(e);
    }
  };

  const toggleAudio = async (v: boolean) => {
    setAudio(v);
    if (!childId) return;
    try {
      await systemApi.updatePreferences({ childId, audioNarration: v });
    } catch (e) {
      reportError(e);
    }
  };

  const deleteData = async () => {
    if (!childId) return;
    setBusy(true);
    try {
      await childApi.remove(childId);
      showToast('儿童数据已删除', 'info');
      await logout();
    } catch (e) {
      reportError(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.top}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={12}>
          <ArrowLeft size={24} color={colors.fg} weight="bold" />
        </Pressable>
        <Text style={styles.headTitle}>设置 / 关于</Text>
        <View style={{ width: 24 }} />
      </View>

      <Card padding="lg" style={styles.card}>
        <Pressable style={styles.row} onPress={openPrivacy}>
          <ShieldCheck size={22} color={colors.primary} weight="fill" />
          <Text style={styles.rowText}>隐私政策</Text>
        </Pressable>
        <View style={styles.row}>
          <Text style={styles.rowText}>绘本旁白语音</Text>
          <Switch value={audio} onValueChange={toggleAudio} thumbColor={audio ? colors.primary : '#FFFFFF'} trackColor={{ false: colors.border, true: colors.primarySoft }} />
        </View>
      </Card>

      <Card padding="lg" style={[styles.card, styles.dangerCard]}>
        <Text style={styles.dangerTitle}>删除数据</Text>
        <Text style={styles.dangerSub}>将删除当前儿童的全部进度与档案，且不可恢复。</Text>
        {!confirmDel ? (
          <Button label="删除当前儿童数据" variant="ghost" onPress={() => setConfirmDel(true)} icon={<Trash size={20} color={colors.danger} weight="bold" />} />
        ) : (
          <View style={styles.confirmRow}>
            <Button label="取消" variant="ghost" onPress={() => setConfirmDel(false)} />
            <Button label="确认删除" variant="primary" loading={busy} onPress={deleteData} />
          </View>
        )}
      </Card>

      <Card variant="warm" padding="lg" style={styles.card}>
        <View style={styles.row}>
          <Info size={22} color={colors.fg2} weight="fill" />
          <Text style={styles.rowText}>关于 DodoKid</Text>
        </View>
        <Text style={styles.version}>
          版本 {version?.current ?? '1.0.0'}
          {version?.forceUpdate ? '（需更新）' : ''}
        </Text>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.md },
  locked: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, paddingBottom: 80 },
  lockedTitle: { fontFamily: fontFamily.display, fontSize: 22, color: colors.fg, fontWeight: '700' },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headTitle: { fontFamily: fontFamily.display, fontSize: 24, color: colors.fg, fontWeight: '700' },
  card: { gap: spacing.md, ...shadow.soft },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.md },
  rowText: { fontFamily: fontFamily.body, fontSize: 16, color: colors.fg, fontWeight: '700', flex: 1 },
  dangerCard: { borderColor: colors.danger, borderWidth: 1.5 },
  dangerTitle: { fontFamily: fontFamily.display, fontSize: 18, color: colors.danger, fontWeight: '700' },
  dangerSub: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600', lineHeight: 18 },
  confirmRow: { flexDirection: 'row', gap: spacing.md },
  version: { fontFamily: fontFamily.body, fontSize: 13, color: colors.fg2, fontWeight: '600' },
});
