import React, { useState, useEffect } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, ActivityIndicator, Alert,
  KeyboardAvoidingView, Platform, Switch
} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from '../../contexts/AuthContext';

const SAVED_EMAIL_KEY = 'saved_email';
const AUTO_LOGIN_KEY = 'auto_login';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [saveId, setSaveId] = useState(false);
  const [autoLogin, setAutoLogin] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    (async () => {
      const savedEmail = await SecureStore.getItemAsync(SAVED_EMAIL_KEY);
      const savedAutoLogin = await SecureStore.getItemAsync(AUTO_LOGIN_KEY);
      if (savedEmail) {
        setEmail(savedEmail);
        setSaveId(true);
      }
      if (savedAutoLogin === 'true') {
        setAutoLogin(true);
      }
    })();
  }, []);

  // 자동로그인 체크 시 ID저장도 자동 체크
  const handleAutoLogin = (v: boolean) => {
    setAutoLogin(v);
    if (v) setSaveId(true);
  };

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      Alert.alert('알림', '이메일과 비밀번호를 입력해주세요.');
      return;
    }
    setLoading(true);
    try {
      await login(email.trim().toLowerCase(), password, autoLogin);

      // ID 저장 처리 (자동로그인 플래그는 AuthContext.login 에서 저장)
      if (saveId) {
        await SecureStore.setItemAsync(SAVED_EMAIL_KEY, email.trim().toLowerCase());
      } else {
        await SecureStore.deleteItemAsync(SAVED_EMAIL_KEY);
      }
    } catch (e: any) {
      Alert.alert('로그인 실패', e.response?.data?.message ?? '이메일 또는 비밀번호를 확인해주세요.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <Text style={styles.title}>로켓그로스</Text>
      <Text style={styles.subtitle}>쿠팡 판매 관리</Text>

      <TextInput
        style={styles.input}
        placeholder="이메일"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoComplete="email"
      />
      <TextInput
        style={styles.input}
        placeholder="비밀번호"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="password"
      />

      {/* ID저장 / 자동로그인 */}
      <View style={styles.optionRow}>
        <TouchableOpacity style={styles.checkRow} onPress={() => setSaveId(!saveId)}>
          <View style={[styles.checkbox, saveId && styles.checkboxChecked]}>
            {saveId && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.optionText}>ID 저장</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.checkRow} onPress={() => handleAutoLogin(!autoLogin)}>
          <View style={[styles.checkbox, autoLogin && styles.checkboxChecked]}>
            {autoLogin && <Text style={styles.checkmark}>✓</Text>}
          </View>
          <Text style={styles.optionText}>자동 로그인</Text>
        </TouchableOpacity>
      </View>

      <TouchableOpacity style={styles.button} onPress={handleLogin} disabled={loading}>
        {loading ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonText}>로그인</Text>
        )}
      </TouchableOpacity>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: '#fff' },
  title: { fontSize: 28, fontWeight: '700', textAlign: 'center', color: '#FF6000', marginBottom: 4 },
  subtitle: { fontSize: 14, textAlign: 'center', color: '#888', marginBottom: 40 },
  input: {
    borderWidth: 1, borderColor: '#ddd', borderRadius: 8,
    padding: 14, marginBottom: 12, fontSize: 15,
  },
  optionRow: {
    flexDirection: 'row', justifyContent: 'flex-start',
    gap: 24, marginBottom: 20, marginTop: 4,
  },
  checkRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  checkbox: {
    width: 20, height: 20, borderRadius: 4,
    borderWidth: 1.5, borderColor: '#ccc',
    justifyContent: 'center', alignItems: 'center',
  },
  checkboxChecked: { backgroundColor: '#FF6000', borderColor: '#FF6000' },
  checkmark: { color: '#fff', fontSize: 12, fontWeight: '700' },
  optionText: { fontSize: 14, color: '#555' },
  button: {
    backgroundColor: '#FF6000', borderRadius: 8,
    padding: 16, alignItems: 'center', marginTop: 4,
  },
  buttonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
