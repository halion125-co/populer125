import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, ActivityIndicator, Switch
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useAuth } from '../../contexts/AuthContext';
import { getFCMToken } from '../../utils/secureStorage';
import { removeDeviceToken } from '../../api/notifications';
import { apiClient } from '../../api/client';

interface Profile {
  email: string;
  phone: string;
  nameKo: string;
  nameEn: string;
  vendorId: string;
  accessKey: string;
  secretKey?: string;
  zipcode: string;
  addressKo: string;
  addressDetailKo: string;
  addressEn: string;
  addressDetailEn: string;
  customsType: string;
  customsNumber: string;
  hasSecret?: boolean;
}

const FIELD_LABELS: { key: keyof Profile; label: string; secure?: boolean; readonly?: boolean }[] = [
  { key: 'nameKo', label: '이름 (한글)' },
  { key: 'nameEn', label: '이름 (영문)' },
  { key: 'email', label: '이메일' },
  { key: 'phone', label: '전화번호' },
  { key: 'zipcode', label: '우편번호', readonly: true },
  { key: 'addressKo', label: '주소 (한글)', readonly: true },
  { key: 'addressDetailKo', label: '상세주소 (한글)' },
  { key: 'addressEn', label: '주소 (영문)', readonly: true },
  { key: 'addressDetailEn', label: '상세주소 (영문)' },
  { key: 'customsNumber', label: '통관번호' },
  { key: 'vendorId', label: '쿠팡 Vendor ID' },
  { key: 'accessKey', label: '쿠팡 Access Key' },
  { key: 'secretKey', label: '쿠팡 Secret Key (변경 시만 입력)', secure: true },
];

export default function ProfileScreen() {
  const { logout } = useAuth();
  const navigation = useNavigation<any>();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Partial<Profile>>({});
  const [customsBusiness, setCustomsBusiness] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [pwForm, setPwForm] = useState({ current: '', next: '', confirm: '' });
  const [pwSaving, setPwSaving] = useState(false);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await apiClient.get('/api/profile');
      const p: Profile = res.data;
      setProfile(p);
      setForm({ ...p, secretKey: '' }); // secret key는 빈 값으로 시작
      setCustomsBusiness(p.customsType === 'business');
    } catch {
      Alert.alert('오류', '프로필을 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const payload: any = { ...form, customsType: customsBusiness ? 'business' : 'personal' };
      // 비어있는 secretKey는 전송하지 않음
      if (!payload.secretKey) delete payload.secretKey;
      await apiClient.put('/api/profile', payload);
      Alert.alert('저장 완료', '프로필이 업데이트되었습니다.');
      loadProfile();
    } catch (e: any) {
      Alert.alert('오류', e.response?.data?.message ?? '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordChange = async () => {
    if (!pwForm.current || !pwForm.next) {
      Alert.alert('알림', '현재 비밀번호와 새 비밀번호를 입력해주세요.');
      return;
    }
    if (pwForm.next.length < 6) {
      Alert.alert('알림', '새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    if (pwForm.next !== pwForm.confirm) {
      Alert.alert('알림', '새 비밀번호가 일치하지 않습니다.');
      return;
    }
    setPwSaving(true);
    try {
      await apiClient.put('/api/profile/password', {
        currentPassword: pwForm.current,
        newPassword: pwForm.next,
      });
      Alert.alert('완료', '비밀번호가 변경되었습니다.');
      setPwForm({ current: '', next: '', confirm: '' });
    } catch (e: any) {
      Alert.alert('오류', e.response?.data?.message ?? '비밀번호 변경에 실패했습니다.');
    } finally {
      setPwSaving(false);
    }
  };

  const handleLogout = async () => {
    Alert.alert('로그아웃', '로그아웃 하시겠습니까?', [
      { text: '취소', style: 'cancel' },
      {
        text: '로그아웃', style: 'destructive', onPress: async () => {
          try {
            const fcmToken = await getFCMToken();
            if (fcmToken) await removeDeviceToken(fcmToken);
          } catch { }
          await logout();
        }
      },
    ]);
  };

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FF6000" /></View>;
  }

  return (
    <ScrollView style={styles.container} keyboardShouldPersistTaps="handled">
      {/* 기본 정보 */}
      <Text style={styles.sectionTitle}>기본 정보</Text>
      <View style={styles.section}>
        {FIELD_LABELS.map(({ key, label, secure, readonly }) => (
          <View key={key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{label}</Text>
            <TextInput
              style={[styles.fieldInput, readonly && styles.fieldInputReadonly]}
              value={key === 'secretKey' ? (form.secretKey ?? '') : String(form[key] ?? '')}
              onChangeText={v => !readonly && setForm(f => ({ ...f, [key]: v }))}
              editable={!readonly}
              secureTextEntry={secure}
              placeholder={key === 'secretKey' ? (profile?.hasSecret ? '변경하지 않으려면 비워두세요' : '입력') : ''}
              placeholderTextColor="#bbb"
              autoCapitalize="none"
            />
          </View>
        ))}

        {/* 통관유형 */}
        <View style={styles.fieldRow}>
          <Text style={styles.fieldLabel}>통관유형</Text>
          <View style={styles.toggleRow}>
            <Text style={styles.toggleLabel}>개인</Text>
            <Switch
              value={customsBusiness}
              onValueChange={setCustomsBusiness}
              trackColor={{ true: '#FF6000' }}
            />
            <Text style={styles.toggleLabel}>사업자</Text>
          </View>
        </View>
      </View>

      <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>저장</Text>}
      </TouchableOpacity>

      {/* 비밀번호 변경 */}
      <Text style={styles.sectionTitle}>비밀번호 변경</Text>
      <View style={styles.section}>
        {[
          { key: 'current', label: '현재 비밀번호' },
          { key: 'next', label: '새 비밀번호 (6자 이상)' },
          { key: 'confirm', label: '새 비밀번호 확인' },
        ].map(f => (
          <View key={f.key} style={styles.fieldRow}>
            <Text style={styles.fieldLabel}>{f.label}</Text>
            <TextInput
              style={styles.fieldInput}
              value={pwForm[f.key as keyof typeof pwForm]}
              onChangeText={v => setPwForm(p => ({ ...p, [f.key]: v }))}
              secureTextEntry
              autoCapitalize="none"
            />
          </View>
        ))}
      </View>
      <TouchableOpacity style={styles.saveBtn} onPress={handlePasswordChange} disabled={pwSaving}>
        {pwSaving ? <ActivityIndicator color="#fff" /> : <Text style={styles.saveBtnText}>비밀번호 변경</Text>}
      </TouchableOpacity>

      {/* 알림 설정 */}
      <Text style={styles.sectionTitle}>앱 설정</Text>
      <View style={styles.section}>
        <TouchableOpacity style={styles.menuRow} onPress={() => navigation.navigate('NotificationSettings')}>
          <Text style={styles.menuText}>알림 설정</Text>
          <Text style={styles.arrow}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 로그아웃 */}
      <TouchableOpacity style={[styles.saveBtn, styles.logoutBtn]} onPress={handleLogout}>
        <Text style={styles.saveBtnText}>로그아웃</Text>
      </TouchableOpacity>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  sectionTitle: {
    fontSize: 12, fontWeight: '600', color: '#888',
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase',
  },
  section: { backgroundColor: '#fff', marginHorizontal: 0 },
  fieldRow: {
    paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  fieldLabel: { fontSize: 11, color: '#aaa', marginBottom: 4 },
  fieldInput: { fontSize: 15, color: '#333', paddingVertical: 2 },
  fieldInputReadonly: { color: '#bbb' },
  toggleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleLabel: { fontSize: 14, color: '#555' },
  saveBtn: {
    backgroundColor: '#FF6000', margin: 16, marginTop: 12,
    borderRadius: 8, padding: 14, alignItems: 'center',
  },
  saveBtnText: { color: '#fff', fontWeight: '600', fontSize: 15 },
  logoutBtn: { backgroundColor: '#e53935', marginTop: 4 },
  menuRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    padding: 16, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  menuText: { fontSize: 15, color: '#333' },
  arrow: { fontSize: 20, color: '#bbb' },
});
