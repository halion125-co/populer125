import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { formatKST } from '../lib/formatters';

interface UserFCM {
  user_id: number;
  email: string;
  token_count: number;
  platforms: string;
  last_seen: string;
  push_enabled: number;
  quiet_start: string;
  quiet_end: string;
}

interface PushHistory {
  id: number;
  user_id: number;
  email: string;
  title: string;
  total_qty: number;
  total_amount: number;
  detail_json: string;
  sent_at: string;
}

function formatAmount(v: number) {
  return v.toLocaleString('ko-KR') + '원';
}

export default function FCMMonitorPage() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<'status' | 'history'>('status');

  const { data, isLoading, dataUpdatedAt, refetch, isFetching } = useQuery({
    queryKey: ['fcmMonitor'],
    queryFn: async () => {
      const res = await apiClient.get('/api/admin/fcm-monitor');
      return res.data as { users: UserFCM[]; history: PushHistory[] };
    },
    refetchInterval: 60_000,
  });

  const users: UserFCM[] = data?.users ?? [];
  const history: PushHistory[] = data?.history ?? [];
  const lastUpdated = dataUpdatedAt ? new Date(dataUpdatedAt).toLocaleTimeString('ko-KR') : '-';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: '/batch' })} className="text-gray-400 hover:text-gray-600 text-sm">← 배치 관리</button>
          <h1 className="text-lg font-bold text-gray-800">🔔 FCM 푸시 모니터링</h1>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">마지막 갱신: {lastUpdated} · 1분마다 자동 갱신</span>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="px-3 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50"
          >
            {isFetching ? '갱신 중...' : '새로고침'}
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 py-6 space-y-6">

        {/* 플로우 설명 */}
        <div className="bg-white rounded-lg border shadow-sm px-5 py-4">
          <p className="text-xs text-gray-500 mb-3 font-semibold uppercase tracking-wide">푸시 알림 플로우</p>
          <div className="flex items-center gap-2 flex-wrap">
            {[
              { icon: '📱', label: '앱 실행', desc: 'FCM 토큰 발급' },
              { icon: '→', label: '', desc: '' },
              { icon: '🖥️', label: '서버 저장', desc: 'device_tokens 테이블' },
              { icon: '→', label: '', desc: '' },
              { icon: '🔥', label: 'FCM 발송', desc: 'Firebase → 기기' },
              { icon: '→', label: '', desc: '' },
              { icon: '🔔', label: 'OS 배너', desc: '잠금화면/상단 표시' },
            ].map((s, i) =>
              s.icon === '→'
                ? <span key={i} className="text-gray-300 text-lg font-bold">→</span>
                : (
                  <div key={i} className="flex flex-col items-center bg-gray-50 rounded-lg px-4 py-2 min-w-[90px]">
                    <span className="text-xl">{s.icon}</span>
                    <span className="text-xs font-semibold text-gray-700 mt-1">{s.label}</span>
                    <span className="text-[10px] text-gray-400 text-center">{s.desc}</span>
                  </div>
                )
            )}
          </div>
        </div>

        {/* 탭 */}
        <div className="flex gap-2">
          {(['status', 'history'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm rounded border font-medium ${
                tab === t ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
              }`}
            >
              {t === 'status' ? '📱 토큰 / 설정 현황' : '📜 발송 이력 (최근 100건)'}
            </button>
          ))}
        </div>

        {isLoading ? (
          <div className="bg-white rounded-lg border shadow-sm p-10 text-center text-gray-400">로딩 중...</div>
        ) : tab === 'status' ? (
          /* ── 토큰/설정 현황 ── */
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-5 py-3 border-b bg-gray-50">
              <p className="text-xs text-gray-500">총 {users.length}명 · 각 사용자별 FCM 토큰 등록 상태 및 알림 설정</p>
            </div>
            {users.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">등록된 사용자가 없습니다.</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {users.map((u) => {
                  const hasToken = u.token_count > 0;
                  const pushOn = u.push_enabled === 1;
                  const quietSet = !!u.quiet_start && !!u.quiet_end;
                  const canReceive = hasToken && pushOn;

                  return (
                    <div key={u.user_id} className="px-5 py-4">
                      {/* 유저 정보 행 */}
                      <div className="flex items-center justify-between mb-3">
                        <div>
                          <span className="font-semibold text-gray-800 text-sm">{u.email}</span>
                          <span className="ml-2 text-xs text-gray-400">ID: {u.user_id}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          {canReceive
                            ? <span className="px-2.5 py-1 rounded-full text-xs bg-green-100 text-green-700 font-semibold">✅ 수신 가능</span>
                            : <span className="px-2.5 py-1 rounded-full text-xs bg-red-100 text-red-700 font-semibold">❌ 수신 불가</span>
                          }
                        </div>
                      </div>

                      {/* 플로우 단계 체크 */}
                      <div className="flex flex-wrap gap-3 text-xs">
                        {/* Step 1 */}
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded px-3 py-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${hasToken ? 'bg-green-500' : 'bg-red-400'}`}>1</span>
                          <div>
                            <div className="font-medium text-gray-700">토큰 등록</div>
                            <div className="text-gray-400">
                              {hasToken
                                ? `${u.token_count}개 · ${u.platforms || '-'}`
                                : '미등록'}
                            </div>
                          </div>
                        </div>

                        {/* Step 2 */}
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded px-3 py-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${hasToken ? 'bg-green-500' : 'bg-red-400'}`}>2</span>
                          <div>
                            <div className="font-medium text-gray-700">서버 저장</div>
                            <div className="text-gray-400">
                              {hasToken ? `최근: ${formatKST(u.last_seen, '-')}` : '없음'}
                            </div>
                          </div>
                        </div>

                        {/* Step 3 */}
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded px-3 py-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${pushOn ? 'bg-green-500' : 'bg-red-400'}`}>3</span>
                          <div>
                            <div className="font-medium text-gray-700">FCM 발송 조건</div>
                            <div className="text-gray-400">
                              푸시 {pushOn ? 'ON' : 'OFF'}
                              {quietSet ? ` · 방해금지 ${u.quiet_start}~${u.quiet_end}` : ''}
                            </div>
                          </div>
                        </div>

                        {/* Step 4 */}
                        <div className="flex items-center gap-1.5 bg-gray-50 rounded px-3 py-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${canReceive ? 'bg-green-500' : 'bg-gray-300'}`}>4</span>
                          <div>
                            <div className="font-medium text-gray-700">OS 배너</div>
                            <div className="text-gray-400">
                              {canReceive ? '조건 충족' : '앱 권한 별도 확인'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* ── 발송 이력 ── */
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="px-5 py-3 border-b bg-gray-50">
              <p className="text-xs text-gray-500">최근 100건 · 서버에서 FCM으로 발송한 내역</p>
            </div>
            {history.length === 0 ? (
              <div className="p-8 text-center text-gray-400 text-sm">발송 이력이 없습니다.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-gray-500 text-xs">
                    <tr>
                      <th className="px-5 py-3 text-left">발송 시각</th>
                      <th className="px-5 py-3 text-left">사용자</th>
                      <th className="px-5 py-3 text-left">제목</th>
                      <th className="px-5 py-3 text-right">수량</th>
                      <th className="px-5 py-3 text-right">금액</th>
                      <th className="px-5 py-3 text-left">상세</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {history.map((h) => {
                      let details: string[] = [];
                      try { details = JSON.parse(h.detail_json); } catch {}
                      return (
                        <tr key={h.id} className="hover:bg-gray-50">
                          <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{formatKST(h.sent_at)}</td>
                          <td className="px-5 py-3 text-gray-700 text-xs">{h.email}</td>
                          <td className="px-5 py-3 text-gray-800 font-medium text-xs">{h.title}</td>
                          <td className="px-5 py-3 text-right text-gray-600 text-xs">{h.total_qty}개</td>
                          <td className="px-5 py-3 text-right text-gray-600 text-xs whitespace-nowrap">{formatAmount(h.total_amount)}</td>
                          <td className="px-5 py-3 text-gray-400 text-xs">
                            {details.length > 0
                              ? <span title={details.join('\n')}>{details[0]}{details.length > 1 ? ` 외 ${details.length - 1}건` : ''}</span>
                              : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
