import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Books, CalendarCheck, House, LockKey } from 'phosphor-react-native';
import type { BottomTabNavigationOptions } from '@react-navigation/bottom-tabs';
import { colors, fontFamily, radius } from '../design/tokens';
import { HomeScreen } from '../features/home/HomeScreen';
import { BookListScreen } from '../features/book/BookListScreen';
import { HabitScreen } from '../features/habit/HabitScreen';
import { ParentCenterScreen } from '../features/parent/ParentCenterScreen';
import type { TabParamList } from './types';

const Tab = createBottomTabNavigator<TabParamList>();

function tabIcon(route: keyof TabParamList) {
  function Glyph({
    focused,
    size,
  }: {
    focused: boolean;
    color: string;
    size: number;
  }) {
    const c = focused ? colors.primary : colors.fg2;
    if (route === 'Home') return <House size={size} color={c} weight="fill" />;
    if (route === 'BookList') return <Books size={size} color={c} weight="fill" />;
    if (route === 'Habit') return <CalendarCheck size={size} color={c} weight="fill" />;
    return <LockKey size={size} color={c} weight="fill" />;
  }
  Glyph.displayName = `TabGlyph-${route}`;
  return Glyph;
}

const screenOptions: BottomTabNavigationOptions = {
  headerShown: false,
  tabBarActiveTintColor: colors.primary,
  tabBarInactiveTintColor: colors.fg2,
  tabBarStyle: {
    backgroundColor: colors.surface,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    height: 64,
    paddingBottom: 8,
  },
  tabBarLabelStyle: { fontFamily: fontFamily.body, fontWeight: '600', fontSize: 12 },
};

export function TabNavigator() {
  return (
    <Tab.Navigator screenOptions={screenOptions}>
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: '首页', tabBarIcon: tabIcon('Home') }} />
      <Tab.Screen name="BookList" component={BookListScreen} options={{ title: '绘本', tabBarIcon: tabIcon('BookList') }} />
      <Tab.Screen name="Habit" component={HabitScreen} options={{ title: '习惯', tabBarIcon: tabIcon('Habit') }} />
      <Tab.Screen name="Parent" component={ParentCenterScreen} options={{ title: '家长', tabBarIcon: tabIcon('Parent') }} />
    </Tab.Navigator>
  );
}
