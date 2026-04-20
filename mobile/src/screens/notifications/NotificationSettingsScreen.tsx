import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, Switch, TouchableOpacity,
  ActivityIndicator, Alert, Platform, Linking,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import {
  getNotificationSettings,
  updateNotificationSettings,
  NotificationSettings,
} from '../../api/notifications';

function parseTime(hhmm: string): Date {
  const [h, m] = hhmm ? hhmm.split(':').map(Number) : [0, 0];
  const d = new Date();
  d.setHours(h, m, 0, 0);
  return d;
}

function formatTime(d: Date): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export default function NotificationSettingsScreen() {
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

  const openSystemSettings = async () => {
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
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>푸시 알림</Text>
      <View style={styles.row}>
        <View style={styles.rowText}>
          <Text style={styles.label}>푸시 알림 받기</Text>
          <Text style={styles.desc}>새 주문 시 알림을 전송합니다</Text>
        </View>
        <Switch
          value={settings.push_enabled}
          onValueChange={togglePush}
          trackColor={{ false: '#ddd', true: '#FF6000' }}
          thumbColor="#fff"
          disabled={saving}
        />
      </View>

      <Text style={styles.sectionTitle}>방해 금지 시간</Text>
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
          <TouchableOpacity style={styles.timeRow} onPress={() => setPickerTarget('start')}>
            <Text style={styles.label}>시작 시간</Text>
            <Text style={styles.timeValue}>{settings.quiet_start}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.timeRow} onPress={() => setPickerTarget('end')}>
            <Text style={styles.label}>종료 시간</Text>
            <Text style={styles.timeValue}>{settings.quiet_end}</Text>
          </TouchableOpacity>
        </>
      )}

      <Text style={styles.sectionTitle}>시스템</Text>
      <TouchableOpacity style={styles.row} onPress={openSystemSettings}>
        <Text style={styles.label}>시스템 알림 설정으로 이동</Text>
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>

      {pickerTarget !== null && (
        <DateTimePicker
          mode="time"
          display={Platform.OS === 'ios' ? 'spinner' : 'default'}
          value={parseTime(
            pickerTarget === 'start'
              ? (settings.quiet_start || '22:00')
              : (settings.quiet_end || '08:00')
          )}
          onChange={handleTimeChange}
          is24Hour
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 6, textTransform: 'uppercase',
  },
  row: {
    backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ebebeb',
  },
  rowDisabled: { opacity: 0.45 },
  rowText: { flex: 1, marginRight: 12 },
  timeRow: {
    backgroundColor: '#fff', flexDirection: 'row', justifyContent: 'space-between',
    alignItems: 'center', padding: 16,
    borderBottomWidth: 1, borderColor: '#ebebeb',
  },
  label: { fontSize: 15, color: '#222' },
  textDisabled: { color: '#aaa' },
  desc: { fontSize: 12, color: '#aaa', marginTop: 2 },
  timeValue: { fontSize: 15, color: '#FF6000', fontWeight: '700' },
  arrow: { fontSize: 22, color: '#bbb' },
});
