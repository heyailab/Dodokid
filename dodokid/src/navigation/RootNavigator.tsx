/**
 * Root 导航装配（入口只做装配，零业务逻辑）。
 * - 冷启动：bootstrap 回填令牌/档案；
 * - 未引导 → Onboarding；已引导 → 底部 Tab + 绘本阅读器/设置/家长锁；
 * - 全局护眼计时器 + 达限阻断层 + Toast。
 */
import React, { useEffect, useRef } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { NavigationContainer, NavigationProp, useNavigation } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { colors, fontFamily } from '../design/tokens';
import { useAppBootstrap } from '../hooks/useAppBootstrap';
import { useEyeCareTicker } from '../hooks/useEyeCareTicker';
import { useAuthStore } from '../store/authStore';
import { useEyeCareStore } from '../store/eyeCareStore';
import { EyeCareBlockedScreen, Toast } from '../shared/components';
import { TabNavigator } from './TabNavigator';
import { OnboardingScreen } from '../features/onboarding/OnboardingScreen';
import { BookReaderScreen } from '../features/book/BookReaderScreen';
import { LiteracyScreen } from '../features/literacy/LiteracyScreen';
import { MathScreen } from '../features/math/MathScreen';
import { EnglishScreen } from '../features/english/EnglishScreen';
import { MemoryScreen } from '../features/puzzle/MemoryScreen';
import { SettingsScreen } from '../features/settings/SettingsScreen';
import { ParentGateScreen } from '../features/parent/ParentGateScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

function BootScreen() {
  return (
    <View style={styles.boot}>
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.bootText}>多多正在准备…</Text>
    </View>
  );
}

function RootStack() {
  const navigation = useNavigation<NavigationProp<RootStackParamList>>();
  const bootstrapped = useAuthStore((s) => s.bootstrapped);
  const onboarded = useAuthStore((s) => s.onboarded);
  const isBlocked = useEyeCareStore((s) => s.isBlocked);
  const skipFirstGuard = useRef(true);

  /**
   * 护眼阻断必须显式重置导航栈（P0 / AC-04「不可跳过」）。
   *
   * 为什么不能只靠条件渲染：`BookReader` / `Literacy` / `Math` / `English` 是**并列声明的顶层路由**。
   * 原实现只把底部 Tab 在 MainTabs ↔ Blocked 之间切换，已压栈的内容页仍被声明且保持聚焦，
   * 儿童达限后可继续玩，且 `useContentActivity` 仍在计时。
   *
   * 为什么下方再也不让 isBlocked 影响 Stack.Screen 的声明：若「改变子元素列表」与「派发 reset」
   * 落在同一次提交，React Navigation 对子元素变化的重算会与本次 reset 竞争，偶发把 reset 覆盖掉
   * （实测现象：单跑通过、并行全量跑失败）。因此让声明列表**保持稳定**，只由本 effect 决定聚焦路由，
   * 阻断与解除阻断走同一条确定性路径。
   */
  useEffect(() => {
    if (!bootstrapped || !onboarded) return; // 导航器尚未渲染，不派发动作
    if (skipFirstGuard.current) {
      // 首个「已挂载导航器」的提交由 initialRouteName 决定路由，避免在容器 ready 前派发
      skipFirstGuard.current = false;
      return;
    }
    navigation.reset({ index: 0, routes: [{ name: isBlocked ? 'Blocked' : 'MainTabs' }] });
  }, [bootstrapped, onboarded, isBlocked, navigation]);

  if (!bootstrapped) return <BootScreen />;

  return (
    <Stack.Navigator
      initialRouteName={!onboarded ? 'Onboarding' : isBlocked ? 'Blocked' : 'MainTabs'}
      screenOptions={{ headerShown: false, animation: 'slide_from_right' }}
    >
      {!onboarded ? (
        <Stack.Screen name="Onboarding" component={OnboardingScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={TabNavigator} />
          {/* 达限阻断屏：栈被 reset 为单路由，无返回路径，仅留家长验证入口 */}
          <Stack.Screen name="Blocked">
            {() => (
              <EyeCareBlockedScreen
                onParentVerify={() => navigation.navigate('ParentGate', { reason: 'eyeCare' })}
              />
            )}
          </Stack.Screen>
          <Stack.Screen name="BookReader" component={BookReaderScreen} />
          <Stack.Screen name="Literacy" component={LiteracyScreen} />
          <Stack.Screen name="Math" component={MathScreen} />
          <Stack.Screen name="English" component={EnglishScreen} />
          <Stack.Screen name="Puzzle" component={MemoryScreen} />
          <Stack.Screen name="Settings" component={SettingsScreen} />
          <Stack.Screen
            name="ParentGate"
            component={ParentGateScreen}
            options={{ presentation: 'modal', animation: 'fade' }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export function RootNavigator() {
  useAppBootstrap();
  useEyeCareTicker();
  return (
    <NavigationContainer>
      <RootStack />
      <Toast />
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 12 },
  bootText: { fontFamily: fontFamily.body, color: colors.fg2, fontWeight: '600', fontSize: 15 },
});
