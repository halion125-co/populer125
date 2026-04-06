import { useState, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { formatKST } from '../lib/formatters';

interface BatchLog {
  id: number;
  jobType: string;
  triggeredBy: string;
  status: string;
  message: string;
  recordCount: number;
  startedAt: string;
  finishedAt: string;
}

const JOB_DEFS = [
  { jobType: 'products',  jobName: '상품관리 동기화', hasDate: false },
  { jobType: 'orders',    jobName: '주문관리 동기화', hasDate: true  },
  { jobType: 'inventory', jobName: '재고관리 동기화', hasDate: false },
];

const statusBadge = (status: string) => {
  if (status === 'success') return <span className="px-2 py-0.5 rounded text-xs bg-green-100 text-green-700">성공</span>;
  if (status === 'failed')  return <span className="px-2 py-0.5 rounded text-xs bg-red-100 text-red-700">실패</span>;
  if (status === 'running') return <span className="px-2 py-0.5 rounded text-xs bg-blue-100 text-blue-700 animate-pulse">실행중</span>;
  return null;
};

export default function BatchPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [selectedJobType, setSelectedJobType] = useState<string>('');
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  const [orderFrom, setOrderFrom] = useState(yesterday);
  const [orderTo, setOrderTo] = useState(yesterday);

  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['batchLogs', selectedJobType],
    queryFn: async () => {
      const params = selectedJobType ? { jobType: selectedJobType } : {};
      const res = await apiClient.get('/api/batch/logs', { params });
      return res.data.data as BatchLog[];
    },
    // running 상태인 작업이 있을 때만 3초 폴링
    refetchInterval: (query) => {
      const data = query.state.data as BatchLog[] | undefined;
      return data?.some((l) => l.status === 'running') ? 3000 : false;
    },
  });

  const runMutation = useMutation({
    mutationFn: async (jobType: string) => {
      const params = jobType === 'orders'
        ? { fromDate: orderFrom, toDate: orderTo }
        : {};
      await apiClient.post(`/api/batch/jobs/${jobType}/run`, {}, { params });
    },
    onMutate: (jobType: string) => {
      setRunningJobs((prev) => new Set(prev).add(jobType));
    },
    onSuccess: () => {
      // 즉시 로그 갱신
      queryClient.invalidateQueries({ queryKey: ['batchLogs'] });
    },
    onError: (_: unknown, jobType: string) => {
      setRunningJobs((prev) => { const s = new Set(prev); s.delete(jobType); return s; });
    },
  });

  const logs = logsData || [];

  // running이 끝나면 runningJobs에서 제거
  useEffect(() => {
    const stillRunning = new Set(logs.filter((l) => l.status === 'running').map((l) => l.jobType));
    setRunningJobs((prev) => {
      const next = new Set(prev);
      prev.forEach((jt) => { if (!stillRunning.has(jt)) next.delete(jt); });
      return next;
    });
  }, [logs]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* 헤더 */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate({ to: '/' })} className="text-gray-400 hover:text-gray-600 text-sm">← 홈</button>
          <h1 className="text-lg font-bold text-gray-800">배치 관리</h1>
        </div>
        <p className="text-xs text-gray-400">매일 KST 00:00 자동 실행 (전일자 데이터)</p>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">

        {/* 배치 작업 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-5 py-4 border-b">
            <h2 className="font-semibold text-gray-700">배치 작업</h2>
          </div>
          <div className="divide-y divide-gray-100">
            {JOB_DEFS.map((job) => {
              const isRunning = runningJobs.has(job.jobType);
              return (
                <div key={job.jobType} className="px-5 py-4 flex items-center justify-between">
                  <span className="text-sm font-medium text-gray-800">{job.jobName}</span>
                  <div className="flex items-center gap-2">
                    {job.hasDate && (
                      <>
                        <input
                          type="date"
                          value={orderFrom}
                          onChange={(e) => setOrderFrom(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-700"
                        />
                        <span className="text-xs text-gray-400">~</span>
                        <input
                          type="date"
                          value={orderTo}
                          onChange={(e) => setOrderTo(e.target.value)}
                          className="border border-gray-300 rounded px-2 py-1 text-xs text-gray-700"
                        />
                      </>
                    )}
                    <button
                      onClick={() => runMutation.mutate(job.jobType)}
                      disabled={isRunning}
                      className="px-4 py-1.5 bg-blue-600 text-white text-xs rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1.5"
                    >
                      {isRunning && <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />}
                      {isRunning ? '실행중...' : '수동 실행'}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* 실행 로그 */}
        <div className="bg-white rounded-lg shadow-sm border">
          <div className="px-5 py-4 border-b flex items-center justify-between">
            <h2 className="font-semibold text-gray-700">실행 로그</h2>
            <div className="flex gap-1.5">
              {(['', 'products', 'orders', 'inventory'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setSelectedJobType(t)}
                  className={`px-3 py-1 text-xs rounded border ${
                    selectedJobType === t
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {t === '' ? '전체' : t === 'products' ? '상품' : t === 'orders' ? '주문' : '재고'}
                </button>
              ))}
            </div>
          </div>
          {logsLoading ? (
            <div className="p-6 text-center text-gray-400 text-sm">로딩 중...</div>
          ) : logs.length === 0 ? (
            <div className="p-6 text-center text-gray-400 text-sm">실행 로그가 없습니다.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-500 text-xs">
                <tr>
                  <th className="px-5 py-3 text-left">작업</th>
                  <th className="px-5 py-3 text-left">시작</th>
                  <th className="px-5 py-3 text-left">완료</th>
                  <th className="px-5 py-3 text-left">구분</th>
                  <th className="px-5 py-3 text-left">상태</th>
                  <th className="px-5 py-3 text-left">건수</th>
                  <th className="px-5 py-3 text-left">메시지</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50">
                    <td className="px-5 py-3 font-medium text-gray-700 whitespace-nowrap">
                      {JOB_DEFS.find((j) => j.jobType === log.jobType)?.jobName || log.jobType}
                    </td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{formatKST(log.startedAt)}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs whitespace-nowrap">{formatKST(log.finishedAt)}</td>
                    <td className="px-5 py-3">
                      <span className={`px-2 py-0.5 rounded text-xs ${log.triggeredBy === 'manual' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                        {log.triggeredBy === 'manual' ? '수동' : '자동'}
                      </span>
                    </td>
                    <td className="px-5 py-3">{statusBadge(log.status)}</td>
                    <td className="px-5 py-3 text-gray-600">{log.recordCount > 0 ? `${log.recordCount}건` : '-'}</td>
                    <td className="px-5 py-3 text-gray-500 text-xs">{log.message || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
