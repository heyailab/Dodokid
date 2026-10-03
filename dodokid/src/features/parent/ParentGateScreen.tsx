/**
 * 家长锁验证：生物 / 密码级（非算术题）。
 * 未通过不暴露任何设置/退出/外链。验证成功：置 gatePassed；
 * 若因护眼达限进入，则同时解除阻断（unblock）。
 */
import React, { useState } from 'react';
import { StyleSheet, Text, TextInput, View } from 'react-native';
import { Fingerprint, LockKey, Warning } from 'phosphor-react-native';
import { colors, fontFamily, radius, shadow, spacing } from '../../design/tokens';
import { parentApi } from '../../api/parent';
import { useAuthStore } from '../../store/authStore';
import { useEyeCareStore } from '../../store/eyeCareStore';
import { useUiStore } from '../../store/uiStore';
import { reportError } from '../../lib/errorToast';
import { Button, Card, DodoMascot, Screen } from '../../shared/components';

const REASON_TEXT: Record<string, string> = {
  eyeCare: '今天的使用时间到了，请家长验证后继续。',
  parentCenter: '家长中心需要验证身份才能进入。',
  settings: '设置需要验证身份才能修改。',
};

export function ParentGateScreen({ route, navigation }: { route: { params?: { reason?: string } }; navigation: any }) {
  const reason = route.params?.reason ?? 'parentCenter';
  const setGatePassed = useAuthStore((s) => s.setGatePassed);
  const unblock = useEyeCareStore((s) => s.unblock);
  const showToast = useUiStore((s) => s.show);
  const [pwd, setPwd] = useState('');
  const [loading, setLoading] = useState(false);

  const succeed = () => {
    setGatePassed(true);
    if (reason === 'eyeCare') unblock();
    showToast('验证成功', 'success');
    navigation.goBack();
  };

  const verify = async (method: 'biometric' | 'password', payload?: string) => {
    setLoading(true);
    try {
      const res = await parentApi.verifyGate({ method, payload });
      if (res.ok) succeed();
      else showToast(res.hint ?? '验证未通过，请重试', 'danger');
    } catch (err) {
      reportError(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll contentStyle={styles.content}>
      <View style={styles.hero}>
        <DodoMascot size={120} mood="happy" />
        <Text style={styles.title}>家长验证</Text>
        <Text style={styles.sub}>{REASON_TEXT[reason] ?? REASON_TEXT.parentCenter}</Text>
      </View>

      <Card padding="lg" style={styles.card}>
        <Button
          label="使用指纹 / 面容验证"
          variant="primary"
          fullWidth
          icon={<Fingerprint size={20} color="#FFFFFF" weight="fill" />}
          loading={loading}
          onPress={() => verify('biometric')}
        />
        <View style={styles.divider}>
          <Text style={styles.dividerText}>或输入家长密码</Text>
        </View>
        <TextInput
          value={pwd}
          onChangeText={setPwd}
          placeholder="6 位数字密码"
          placeholderTextColor={colors.fg2}
          secureTextEntry
          keyboardType="numeric"
          maxLength={6}
          style={styles.input}
        />
        <Button
          label="验证"
          variant="accent"
          fullWidth
          loading={loading}
          disabled={pwd.length < 4}
          icon={<LockKey size={20} color={colors.accentInk} weight="bold" />}
          onPress={() => verify('password', pwd)}
        />
      </Card>

      <View style={styles.note}>
        <Warning size={16} color={colors.fg2} weight="bold" />
        <Text style={styles.noteText}>为保护孩子，验证未通过前不会显示任何设置。</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { gap: spacing.lg },
  hero: { alignItems: 'center', gap: spacing.sm, marginTop: spacing.x2l },
  title: { fontFamily: fontFamily.display, fontSize: 28, color: colors.fg, fontWeight: '700' },
  sub: { fontFamily: fontFamily.body, fontSize: 14, color: colors.fg2, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
  card: { gap: spacing.md, ...shadow.soft },
  divider: { alignItems: 'center' },
  dividerText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, fontWeight: '600' },
  input: {
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: 18,
    textAlign: 'center',
    color: colors.fg,
    fontFamily: fontFamily.body,
    fontWeight: '700',
    letterSpacing: 4,
  },
  note: { flexDirection: 'row', alignItems: 'center', gap: 6, justifyContent: 'center' },
  noteText: { fontFamily: fontFamily.body, fontSize: 12, color: colors.fg2, fontWeight: '600' },
});
