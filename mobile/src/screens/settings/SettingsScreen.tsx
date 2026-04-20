import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Switch,
  TouchableOpacity, Alert, ActivityIndicator, Linking, Platform,
} from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useNavigation } from '@react-navigation/native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getNotificationSettings,
  updateNotificationSettings,
  NotificationSettings,
} from '../../api/notifications';

const APP_VERSION = Constants.expoConfig?.version ?? '1.0.0';

function parseTime(hhmm: string): Date {
  const [h, m] = hhmm ? hhmm.split(':').map(Number) : [0, 0];
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function SettingsScreen() {
  const navigation = useNavigation<any>();
  const [settings, setSettings] = useState<NotificationSettings>({
    push_enabled: true,
    quiet_start: '',
    quiet_end: '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [pickerTarget, setPickerTarget] = useState<'start' | 'end' | null>(null);

  const quietEnabled = !!settings.quiet_start && !!settings.quiet_end;

  useEffect(() => {
    getNotificationSettings().then(setSettings).finally(() => setLoading(false));
  }, []);

  const save = async (next: NotificationSettings) => {
    setSaving(true);
    try {
      await updateNotificationSettings(next);
      setSettings(next);
    } catch (e: any) {
      const msg = e?.response?.data?.message ?? e?.message ?? '알 수 없는 오류';
      Alert.alert('설정 저장 실패', msg);
    } finally {
      setSaving(false);
    }
  };

  const togglePush = (v: boolean) => save({ ...settings, push_enabled: v });

  const toggleQuiet = (v: boolean) =>
    save({
      ...settings,
      quiet_start: v ? '22:00' : '',
      quiet_end: v ? '08:00' : '',
    });

  const handleTimeChange = (_: any, selected?: Date) => {
    const target = pickerTarget;
    setPickerTarget(null);
    if (!selected || !target) return;
    const timeStr = formatTime(selected);
    if (target === 'start') save({ ...settings, quiet_start: timeStr });
    else save({ ...settings, quiet_end: timeStr });
  };

  const openSystemNotificationSettings = async () => {
    try {
      if (Platform.OS === 'android') {
        await Linking.openSettings();
      } else {
        await Linking.openURL('app-settings:');
      }
    } catch {
      Alert.alert('오류', '설정 앱을 열 수 없습니다.');
    }
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator color="#FF6000" /></View>;
  }

  return (
    <ScrollView style={styles.container}>

      {/* ── 알림 설정 ── */}
      <Text style={styles.sectionTitle}>알림 설정</Text>

      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={() => navigation.navigate('NotificationHistory')}>
          <Text style={styles.label}>알림 발송 내역</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
        <View style={styles.divider} />

        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.label}>푸시 알림 받기</Text>
            <Text style={styles.desc}>새 주문 시 앱 알림을 전송합니다</Text>
          </View>
          <Switch
            value={settings.push_enabled}
            onValueChange={togglePush}
            trackColor={{ false: '#ddd', true: '#FF6000' }}
            thumbColor="#fff"
            disabled={saving}
          />
        </View>

        <View style={styles.divider} />

        <View style={[styles.row, !settings.push_enabled && styles.rowDisabled]}>
          <View style={styles.rowText}>
            <Text style={[styles.label, !settings.push_enabled && styles.textDisabled]}>방해 금지 사용</Text>
            <Text style={styles.desc}>설정 시간에는 푸시를 전송하지 않습니다</Text>
          </View>
          <Switch
            value={quietEnabled}
            onValueChange={toggleQuiet}
            trackColor={{ false: '#ddd', true: '#FF6000' }}
            thumbColor="#fff"
            disabled={saving || !settings.push_enabled}
          />
        </View>

        {quietEnabled && (
          <>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => setPickerTarget('start')}>
              <Text style={styles.label}>시작 시간</Text>
              <Text style={styles.timeValue}>{settings.quiet_start}</Text>
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity style={styles.row} onPress={() => setPickerTarget('end')}>
              <Text style={styles.label}>종료 시간</Text>
              <Text style={styles.timeValue}>{settings.quiet_end}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <Text style={styles.sectionTitle}>시스템</Text>
      <View style={styles.card}>
        <TouchableOpacity style={styles.row} onPress={openSystemNotificationSettings}>
          <Text style={styles.label}>시스템 알림 설정으로 이동</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* ── 앱 정보 ── */}
      <Text style={styles.sectionTitle}>앱 정보</Text>
      <View style={styles.card}>
        {[
          { label: '앱 이름', value: '로켓그로스' },
          { label: '버전', value: APP_VERSION },
          { label: '플랫폼', value: Platform.OS === 'android' ? 'Android' : 'iOS' },
          { label: '용도', value: '쿠팡 판매 관리' },
        ].map((item, i, arr) => (
          <React.Fragment key={item.label}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>{item.label}</Text>
              <Text style={styles.infoValue}>{item.value}</Text>
            </View>
            {i < arr.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── 기능 안내 ── */}
      <Text style={styles.sectionTitle}>주요 기능</Text>
      <View style={styles.card}>
        {[
          { icon: '📊', title: '대시보드', desc: '기간별 매출 현황 및 막대 그래프' },
          { icon: '🛒', title: '주문 내역', desc: '날짜별 쿠팡 주문 조회' },
          { icon: '🔔', title: '푸시 알림', desc: '신규 주문 발생 시 실시간 알림' },
          { icon: '🌙', title: '방해 금지', desc: '지정 시간대 알림 차단 (서버 처리)' },
          { icon: '🔄', title: '자동 로그인', desc: '앱 재시작 시 자동 인증 유지' },
          { icon: '👤', title: '프로필 관리', desc: '쿠팡 API 키 및 개인정보 설정' },
        ].map((f, i, arr) => (
          <React.Fragment key={f.title}>
            <View style={styles.featureRow}>
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.desc}>{f.desc}</Text>
              </View>
            </View>
            {i < arr.length - 1 && <View style={styles.divider} />}
          </React.Fragment>
        ))}
      </View>

      {/* ── 저작권 ── */}
      <View style={styles.copyright}>
        <Text style={styles.copyrightTitle}>로켓그로스</Text>
        <Text style={styles.copyrightText}>RocketGrowth — Coupang Sales Manager</Text>
        <Text style={styles.copyrightText}>Version {APP_VERSION}</Text>
        <Text style={styles.copyrightSep}>─────────────────────</Text>
        <Text style={styles.copyrightText}>© 2025 Populer Company</Text>
        <Text style={styles.copyrightText}>All rights reserved.</Text>
        <Text style={styles.copyrightSmall}>
          본 앱은 쿠팡 파트너스 API를 활용한{'\n'}
          판매 관리 전용 서비스입니다.
        </Text>
      </View>

      <View style={{ height: 40 }} />

      {/* 시간 피커 */}
      {pickerTarget !== null && (
        <DateTimePicker
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          value={parseTime(
            pickerTarget === 'start' ? (settings.quiet_start || '22:00') : (settings.quiet_end || '08:00')
          )}
          onChange={handleTimeChange}
          is24Hour
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderBottomWidth: 1,
    borderColor: '#ebebeb',
  },
  divider: { height: 1, backgroundColor: '#f2f2f2', marginLeft: 16 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14,
    minHeight: 52,
  },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, marginRight: 12 },

  label: { fontSize: 15, color: '#222' },
  textDisabled: { color: '#aaa' },
  desc: { fontSize: 12, color: '#aaa', marginTop: 2 },
  timeValue: { fontSize: 15, color: '#FF6000', fontWeight: '700' },
  arrow: { fontSize: 22, color: '#bbb' },

  infoRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', paddingHorizontal: 16, paddingVertical: 13,
  },
  infoLabel: { fontSize: 14, color: '#555' },
  infoValue: { fontSize: 14, color: '#333', fontWeight: '500' },

  featureRow: {
    flexDirection: 'row', alignItems: 'flex-start',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  featureIcon: { fontSize: 22, marginRight: 12, marginTop: 1 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 14, fontWeight: '600', color: '#333' },

  copyright: {
    alignItems: 'center', paddingVertical: 28, paddingHorizontal: 24,
  },
  copyrightTitle: {
    fontSize: 18, fontWeight: '700', color: '#FF6000', marginBottom: 4,
  },
  copyrightText: { fontSize: 13, color: '#888', marginTop: 2 },
  copyrightSep: { color: '#ddd', marginVertical: 10 },
  copyrightSmall: {
    fontSize: 11, color: '#bbb', textAlign: 'center', lineHeight: 17, marginTop: 8,
  },
});
