import React from 'react';
import { Text, TouchableOpacity } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import DashboardScreen from '../screens/main/DashboardScreen';
import OrdersScreen from '../screens/main/OrdersScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import NotificationSettingsScreen from '../screens/notifications/NotificationSettingsScreen';
import NotificationHistoryScreen from '../screens/notifications/NotificationHistoryScreen';
import NotificationDetailScreen from '../screens/notifications/NotificationDetailScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';

const Tab = createBottomTabNavigator();
const DashboardStack = createNativeStackNavigator();
const OrdersStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

function SettingsButton({ navigation }: { navigation: any }) {
  return (
    <TouchableOpacity
      onPress={() => navigation.navigate('Settings')}
      style={{ marginRight: 14 }}
      hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
    >
      <Text style={{ fontSize: 22 }}>⚙️</Text>
    </TouchableOpacity>
  );
}

function DashboardStackNav() {
  return (
    <DashboardStack.Navigator>
      <DashboardStack.Screen
        name="DashboardMain"
        component={DashboardScreen}
        options={({ navigation }) => ({
          title: '대시보드',
          headerRight: () => <SettingsButton navigation={navigation} />,
        })}
      />
      <DashboardStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정' }}
      />
      <DashboardStack.Screen
        name="NotificationHistory"
        component={NotificationHistoryScreen}
        options={{ title: '알림 발송 내역' }}
      />
      <DashboardStack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{ title: '알림 상세' }}
      />
    </DashboardStack.Navigator>
  );
}

function OrdersStackNav() {
  return (
    <OrdersStack.Navigator>
      <OrdersStack.Screen
        name="OrdersMain"
        component={OrdersScreen}
        options={({ navigation }) => ({
          title: '주문 내역',
          headerRight: () => <SettingsButton navigation={navigation} />,
        })}
      />
      <OrdersStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정' }}
      />
      <OrdersStack.Screen
        name="NotificationHistory"
        component={NotificationHistoryScreen}
        options={{ title: '알림 발송 내역' }}
      />
      <OrdersStack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{ title: '알림 상세' }}
      />
    </OrdersStack.Navigator>
  );
}

function ProfileStackNav() {
  return (
    <ProfileStack.Navigator>
      <ProfileStack.Screen
        name="ProfileMain"
        component={ProfileScreen}
        options={({ navigation }) => ({
          title: '프로필',
          headerRight: () => <SettingsButton navigation={navigation} />,
        })}
      />
      <ProfileStack.Screen
        name="NotificationSettings"
        component={NotificationSettingsScreen}
        options={{ title: '알림 설정' }}
      />
      <ProfileStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: '설정' }}
      />
      <ProfileStack.Screen
        name="NotificationHistory"
        component={NotificationHistoryScreen}
        options={{ title: '알림 발송 내역' }}
      />
      <ProfileStack.Screen
        name="NotificationDetail"
        component={NotificationDetailScreen}
        options={{ title: '알림 상세' }}
      />
    </ProfileStack.Navigator>
  );
}

export default function AppTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        tabBarActiveTintColor: '#FF6000',
        tabBarInactiveTintColor: '#999',
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackNav}
        options={{
          title: '대시보드',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>📊</Text>,
        }}
      />
      <Tab.Screen
        name="Orders"
        component={OrdersStackNav}
        options={{
          title: '주문',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>🛒</Text>,
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackNav}
        options={{
          title: '프로필',
          tabBarIcon: () => <Text style={{ fontSize: 20 }}>👤</Text>,
        }}
      />
    </Tab.Navigator>
  );
}
