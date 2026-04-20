import React, { useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { apiClient } from '../../api/client';

interface DeviceToken {
  id: number;
  fcm_token: string;
  platform: string;
  device_name: string;
  updated_at: string;
}

interface FCMStatus {
  user_id: number;
  token_count: number;
  device_tokens: DeviceToken[];
  settings: {
    found: boolean;
    push_enabled: boolean;
    quiet_start: string;
    quiet_end: string;
  };
}

const REFRESH_INTERVAL = 60_000;

function formatToken(token: string) {
  if (token.length <= 20) return token;
  return token.slice(0, 12) + '...' + token.slice(-8);
}

function formatDate(str: string) {
  if (!str) return '-';
  const d = new Date(str.replace(' ', 'T') + (str.includes('Z') ? '' : 'Z'));
  if (isNaN(d.getTime())) return str;
  return d.toLocaleString('ko-KR', {
    month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
}

export default function FCMDebugScreen() {
  const [status, setStatus] = useState<FCMStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(REFRESH_INTERVAL / 1000);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countdownRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetch = async () => {
    try {
      const res = await apiClient.get('/api/debug/fcm-status');
      setStatus(res.data);
      setLastUpdated(new Date());
    } catch {
      // keep previous data on error
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    setLoading(true);
    setCountdown(REFRESH_INTERVAL / 1000);
    fetch();
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      fetch();
      setCountdown(REFRESH_INTERVAL / 1000);
    }, REFRESH_INTERVAL);
  };

  useEffect(() => {
    fetch();
    timerRef.current = setInterval(() => {
      fetch();
      setCountdown(REFRESH_INTERVAL / 1000);
    }, REFRESH_INTERVAL);

    countdownRef.current = setInterval(() => {
      setCountdown(prev => (prev > 1 ? prev - 1 : REFRESH_INTERVAL / 1000));
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  if (loading && !status) {
    return <View style={styles.center}><ActivityIndicator color="#FF6000" size="large" /></View>;
  }

  const s = status!;

  return (
    <ScrollView style={styles.container}>
      {/* 상단 상태 바 */}
      <View style={styles.statusBar}>
        <Text style={styles.statusBarText}>
          마지막 갱신: {lastUpdated ? lastUpdated.toLocaleTimeString('ko-KR') : '-'}
        </Text>
        <View style={styles.statusBarRight}>
          <Text style={styles.countdownText}>{countdown}s</Text>
          <TouchableOpacity style={styles.refreshBtn} onPress={refresh} disabled={loading}>
            <Text style={styles.refreshBtnText}>{loading ? '...' : '새로고침'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* 사용자 정보 */}
      <Text style={styles.sectionTitle}>사용자</Text>
      <View style={styles.card}>
        <Row label="User ID" value={String(s.user_id)} />
      </View>

      {/* 알림 설정 */}
      <Text style={styles.sectionTitle}>알림 설정</Text>
      <View style={styles.card}>
        <Row label="DB 레코드 존재" value={s.settings.found ? '✅ 있음' : '⚠️ 없음 (기본값)'} />
        <Divider />
        <Row label="푸시 알림" value={s.settings.push_enabled ? '✅ ON' : '🔕 OFF'} />
        <Divider />
        <Row
          label="방해 금지"
          value={
            s.settings.quiet_start && s.settings.quiet_end
              ? `🌙 ${s.settings.quiet_start} ~ ${s.settings.quiet_end}`
              : '미설정'
          }
        />
      </View>

      {/* FCM 토큰 */}
      <Text style={styles.sectionTitle}>
        등록된 디바이스 토큰 ({s.token_count}개)
      </Text>
      <View style={styles.card}>
        {s.device_tokens.length === 0 ? (
          <View style={styles.emptyRow}>
            <Text style={styles.emptyText}>⚠️ 등록된 토큰 없음</Text>
            <Text style={styles.emptyDesc}>앱이 FCM 토큰을 서버에 전송하지 않았거나{'\n'}로그아웃 후 미등록 상태입니다.</Text>
          </View>
        ) : (
          s.device_tokens.map((t, i) => (
            <React.Fragment key={t.id}>
              {i > 0 && <View style={[styles.divider, { marginLeft: 0 }]} />}
              <View style={styles.tokenCard}>
                <View style={styles.tokenHeader}>
                  <Text style={styles.tokenPlatform}>
                    {t.platform === 'android' ? '🤖 Android' : t.platform === 'ios' ? '🍎 iOS' : t.platform || '?'}
                  </Text>
                  <Text style={styles.tokenDevice}>{t.device_name || '-'}</Text>
                </View>
                <Text style={styles.tokenValue} numberOfLines={1} ellipsizeMode="middle">
                  {formatToken(t.fcm_token)}
                </Text>
                <Text style={styles.tokenDate}>업데이트: {formatDate(t.updated_at)}</Text>
              </View>
            </React.Fragment>
          ))
        )}
      </View>

      {/* 플로우 체크 */}
      <Text style={styles.sectionTitle}>FCM 플로우 상태</Text>
      <View style={styles.card}>
        <FlowItem
          step="1"
          label="FCM 토큰 발급"
          ok={s.token_count > 0}
          okText="토큰 등록됨"
          failText="토큰 없음 — 앱 재실행 필요"
        />
        <Divider />
        <FlowItem
          step="2"
          label="서버 토큰 저장"
          ok={s.token_count > 0}
          okText={`${s.token_count}개 저장됨`}
          failText="서버에 토큰 미전달"
        />
        <Divider />
        <FlowItem
          step="3"
          label="알림 설정 저장"
          ok={s.settings.found}
          okText="설정 레코드 존재"
          failText="설정 없음 (기본값 적용 중)"
        />
        <Divider />
        <FlowItem
          step="4"
          label="푸시 수신 가능"
          ok={s.token_count > 0 && s.settings.push_enabled}
          okText="정상"
          failText={
            s.token_count === 0
              ? '토큰 미등록'
              : '푸시 알림 OFF 상태'
          }
        />
      </View>

      <View style={{ height: 40 }} />
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function Divider() {
  return <View style={styles.divider} />;
}

function FlowItem({
  step, label, ok, okText, failText,
}: {
  step: string; label: string; ok: boolean; okText: string; failText: string;
}) {
  return (
    <View style={styles.flowRow}>
      <View style={[styles.stepBadge, ok ? styles.stepOk : styles.stepFail]}>
        <Text style={styles.stepNum}>{step}</Text>
      </View>
      <View style={styles.flowText}>
        <Text style={styles.flowLabel}>{label}</Text>
        <Text style={[styles.flowStatus, ok ? styles.flowOk : styles.flowFail]}>
          {ok ? okText : failText}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },

  statusBar: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 10,
    borderBottomWidth: 1, borderColor: '#ebebeb',
  },
  statusBarText: { fontSize: 12, color: '#888' },
  statusBarRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  countdownText: { fontSize: 12, color: '#FF6000', fontWeight: '700', minWidth: 28, textAlign: 'right' },
  refreshBtn: {
    backgroundColor: '#FF6000', borderRadius: 6,
    paddingHorizontal: 10, paddingVertical: 4,
  },
  refreshBtnText: { fontSize: 12, color: '#fff', fontWeight: '600' },

  sectionTitle: {
    fontSize: 11, fontWeight: '700', color: '#888', letterSpacing: 0.5,
    paddingHorizontal: 16, paddingTop: 20, paddingBottom: 8, textTransform: 'uppercase',
  },
  card: {
    backgroundColor: '#fff',
    borderTopWidth: 1, borderBottomWidth: 1, borderColor: '#ebebeb',
  },
  divider: { height: 1, backgroundColor: '#f2f2f2', marginLeft: 16 },

  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 13,
  },
  rowLabel: { fontSize: 14, color: '#555' },
  rowValue: { fontSize: 14, color: '#222', fontWeight: '500', maxWidth: '60%', textAlign: 'right' },

  emptyRow: { padding: 20, alignItems: 'center' },
  emptyText: { fontSize: 15, color: '#e05' , fontWeight: '600', marginBottom: 6 },
  emptyDesc: { fontSize: 12, color: '#aaa', textAlign: 'center', lineHeight: 18 },

  tokenCard: { paddingHorizontal: 16, paddingVertical: 12 },
  tokenHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tokenPlatform: { fontSize: 13, fontWeight: '600', color: '#333' },
  tokenDevice: { fontSize: 12, color: '#888' },
  tokenValue: { fontSize: 12, color: '#555', fontFamily: 'monospace', marginBottom: 2 },
  tokenDate: { fontSize: 11, color: '#aaa' },

  flowRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
  },
  stepBadge: {
    width: 28, height: 28, borderRadius: 14,
    justifyContent: 'center', alignItems: 'center', marginRight: 12,
  },
  stepOk: { backgroundColor: '#34C759' },
  stepFail: { backgroundColor: '#FF3B30' },
  stepNum: { fontSize: 13, fontWeight: '700', color: '#fff' },
  flowText: { flex: 1 },
  flowLabel: { fontSize: 14, color: '#222', fontWeight: '500' },
  flowStatus: { fontSize: 12, marginTop: 2 },
  flowOk: { color: '#34C759' },
  flowFail: { color: '#FF3B30' },
});
