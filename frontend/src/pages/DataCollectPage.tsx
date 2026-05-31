import { useState, useEffect, useCallback, useRef } from 'react';
import { apiClient } from '../lib/api';
import Layout from '../components/Layout';

interface AIMessage {
  role: 'user' | 'assistant';
  content: string;
}

interface AnalyzeResponse {
  answer: string;
  rowCount: number;
  model: string;
}

interface DownloadJob {
  id: number;
  source: string;
  reportType: string;
  targetDateFrom: string;
  targetDateTo: string;
  status: 'pending' | 'running' | 'success' | 'failed';
  errorCode: string;
  message: string;
  recordCount: number;
  startedAt: string | null;
  finishedAt: string | null;
  createdAt: string;
}

const SOURCE_LABELS: Record<string, string> = {
  wing: 'Wing',
  jikku: '직꾸',
};

const REPORT_TYPE_LABELS: Record<string, string> = {
  rocket_growth_inventory_status: '로켓그로스 재고현황',
  jikku_order_status: '주문현황',
  jikku_inbound_history: '입고내역',
  jikku_inventory_status: '재고현황',
};

const STATUS_STYLE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  running: 'bg-blue-100 text-blue-700',
  success: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-600',
};

const STATUS_LABEL: Record<string, string> = {
  pending: '대기',
  running: '실행중',
  success: '완료',
  failed: '실패',
};

const TODAY = new Date().toISOString().slice(0, 10);
const MONTH_AGO = new Date(Date.now() - 30 * 86400_000).toISOString().slice(0, 10);

type DownloadTarget = {
  source: string;
  reportType: string;
  label: string;
};

const DOWNLOAD_TARGETS: DownloadTarget[] = [
  { source: 'wing', reportType: 'rocket_growth_inventory_status', label: 'Wing — 로켓그로스 재고현황' },
  { source: 'jikku', reportType: 'jikku_order_status', label: '직꾸 — 주문현황' },
  { source: 'jikku', reportType: 'jikku_inbound_history', label: '직꾸 — 입고내역' },
  { source: 'jikku', reportType: 'jikku_inventory_status', label: '직꾸 — 재고현황' },
];

export default function DataCollectPage() {
  const [jobs, setJobs] = useState<DownloadJob[]>([]);
  const [jobsLoading, setJobsLoading] = useState(false);

  const [selectedTarget, setSelectedTarget] = useState(DOWNLOAD_TARGETS[0]);
  const [fromDate, setFromDate] = useState(MONTH_AGO);
  const [toDate, setToDate] = useState(TODAY);
  const [running, setRunning] = useState(false);
  const [runMsg, setRunMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI 분석
  const [aiTarget, setAiTarget] = useState(DOWNLOAD_TARGETS[0]);
  const [aiMessages, setAiMessages] = useState<AIMessage[]>([]);
  const [aiInput, setAiInput] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef<HTMLDivElement>(null);

  const fetchJobs = useCallback(async () => {
    setJobsLoading(true);
    try {
      const res = await apiClient.get<DownloadJob[]>('/api/external-download/jobs');
      setJobs(res.data);
    } catch {
      // ignore
    } finally {
      setJobsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  const handleRun = async () => {
    setRunning(true);
    setRunMsg(null);
    try {
      const res = await apiClient.post<{ code: string; recordCount: number; message: string }>(
        `/api/external-download/${selectedTarget.source}/${selectedTarget.reportType}`,
        { fromDate, toDate }
      );
      setRunMsg({
        type: res.data.code === 'SUCCESS' ? 'success' : 'error',
        text: res.data.code === 'SUCCESS'
          ? `완료 — ${res.data.recordCount}건 저장`
          : `실패: ${res.data.message}`,
      });
      await fetchJobs();
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setRunMsg({ type: 'error', text: axiosErr.response?.data?.message || '요청 실패' });
    } finally {
      setRunning(false);
    }
  };

  const fmt = (s: string | null) => s ? new Date(s).toLocaleString('ko-KR', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '-';

  const handleAiSend = async () => {
    const question = aiInput.trim();
    if (!question || aiLoading) return;

    const userMsg: AIMessage = { role: 'user', content: question };
    setAiMessages(prev => [...prev, userMsg]);
    setAiInput('');
    setAiLoading(true);

    try {
      const res = await apiClient.post<AnalyzeResponse>('/api/ai/analyze', {
        source: aiTarget.source,
        reportType: aiTarget.reportType,
        question,
      });
      setAiMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      const errMsg = axiosErr.response?.data?.message || 'AI 분석 요청 실패';
      setAiMessages(prev => [...prev, { role: 'assistant', content: `오류: ${errMsg}` }]);
    } finally {
      setAiLoading(false);
      setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    }
  };

  return (
    <Layout>
      <div className="space-y-6">
        <h1 className="text-xl font-bold text-gray-800">데이터 수집</h1>

        {/* 다운로드 실행 카드 */}
        <div className="bg-white rounded-lg shadow p-5 space-y-4">
          <h2 className="text-sm font-semibold text-gray-700">엑셀 다운로드 실행</h2>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">수집 대상</label>
              <select
                value={`${selectedTarget.source}|${selectedTarget.reportType}`}
                onChange={e => {
                  const [source, reportType] = e.target.value.split('|');
                  setSelectedTarget(DOWNLOAD_TARGETS.find(t => t.source === source && t.reportType === reportType) || DOWNLOAD_TARGETS[0]);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {DOWNLOAD_TARGETS.map(t => (
                  <option key={`${t.source}|${t.reportType}`} value={`${t.source}|${t.reportType}`}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">시작일</label>
              <input
                type="date"
                value={fromDate}
                onChange={e => setFromDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">종료일</label>
              <input
                type="date"
                value={toDate}
                onChange={e => setToDate(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleRun}
              disabled={running}
              className="px-5 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 font-medium text-sm"
            >
              {running ? '실행 중...' : '다운로드 실행'}
            </button>
            {running && (
              <span className="text-xs text-gray-500 animate-pulse">브라우저 자동화 실행 중 — 최대 5분 소요될 수 있습니다.</span>
            )}
          </div>

          {runMsg && (
            <div className={`p-3 rounded-md text-sm ${runMsg.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-600'}`}>
              {runMsg.text}
            </div>
          )}

          <div className="text-xs text-gray-400 bg-gray-50 rounded p-3 space-y-1">
            <p>외부 계정(Wing/직꾸)이 설정되어 있어야 합니다. — <a href="/profile" className="text-blue-500 hover:underline">내 정보 &gt; 외부 계정</a></p>
            <p>추가 인증(CAPTCHA·OTP)이 감지되면 자동화가 중단되고 실패로 기록됩니다.</p>
          </div>
        </div>

        {/* Job 이력 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">수집 이력</h2>
            <button
              onClick={fetchJobs}
              disabled={jobsLoading}
              className="text-xs text-blue-500 hover:text-blue-700 disabled:text-gray-400"
            >
              {jobsLoading ? '로딩 중...' : '새로고침'}
            </button>
          </div>

          {jobs.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-gray-400">
              수집 이력이 없습니다.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs text-gray-500">
                  <tr>
                    <th className="px-4 py-2 text-left">출처</th>
                    <th className="px-4 py-2 text-left">리포트</th>
                    <th className="px-4 py-2 text-left">기간</th>
                    <th className="px-4 py-2 text-left">상태</th>
                    <th className="px-4 py-2 text-right">건수</th>
                    <th className="px-4 py-2 text-left">완료시각</th>
                    <th className="px-4 py-2 text-left">메시지</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {jobs.map(job => (
                    <tr key={job.id} className="hover:bg-gray-50">
                      <td className="px-4 py-2 font-medium text-gray-700">
                        {SOURCE_LABELS[job.source] || job.source}
                      </td>
                      <td className="px-4 py-2 text-gray-600">
                        {REPORT_TYPE_LABELS[job.reportType] || job.reportType}
                      </td>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                        {job.targetDateFrom && job.targetDateTo
                          ? `${job.targetDateFrom} ~ ${job.targetDateTo}`
                          : '-'}
                      </td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_STYLE[job.status] || 'bg-gray-100 text-gray-600'}`}>
                          {STATUS_LABEL[job.status] || job.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-right text-gray-700">
                        {job.status === 'success' ? job.recordCount.toLocaleString() : '-'}
                      </td>
                      <td className="px-4 py-2 text-gray-500 whitespace-nowrap">
                        {fmt(job.finishedAt)}
                      </td>
                      <td className="px-4 py-2 text-gray-400 text-xs max-w-[200px] truncate">
                        {job.errorCode ? `[${job.errorCode}] ` : ''}{job.message}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* AI 분석 */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-5 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">AI 데이터 분석</h2>
            <p className="text-xs text-gray-400 mt-0.5">수집된 데이터를 기반으로 GPT에게 질문하세요.</p>
          </div>

          {/* 분석 대상 선택 */}
          <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
            <label className="text-xs font-medium text-gray-600 mr-2">분석 대상</label>
            <select
              value={`${aiTarget.source}|${aiTarget.reportType}`}
              onChange={e => {
                const [source, reportType] = e.target.value.split('|');
                setAiTarget(DOWNLOAD_TARGETS.find(t => t.source === source && t.reportType === reportType) || DOWNLOAD_TARGETS[0]);
              }}
              className="px-2 py-1 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {DOWNLOAD_TARGETS.map(t => (
                <option key={`${t.source}|${t.reportType}`} value={`${t.source}|${t.reportType}`}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>

          {/* 대화 내역 */}
          <div className="px-5 py-4 space-y-4 max-h-[500px] overflow-y-auto">
            {aiMessages.length === 0 && (
              <div className="text-center py-8 text-sm text-gray-400 space-y-2">
                <p>수집된 데이터에 대해 자유롭게 질문하세요.</p>
                <div className="flex flex-wrap justify-center gap-2 mt-3">
                  {[
                    '재고 소진 위험 상품 TOP 10 알려줘',
                    '판매수량 대비 재고가 부족한 상품은?',
                    '보관기간이 긴 상품을 정리해줘',
                    '지난 30일 매출 상위 상품은?',
                  ].map(q => (
                    <button
                      key={q}
                      onClick={() => setAiInput(q)}
                      className="px-3 py-1.5 text-xs bg-gray-100 hover:bg-blue-50 hover:text-blue-600 text-gray-600 rounded-full border border-gray-200 transition-colors"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {aiMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-lg px-4 py-3 text-sm whitespace-pre-wrap ${
                  msg.role === 'user'
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-100 text-gray-800'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {aiLoading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-lg px-4 py-3 text-sm text-gray-500 animate-pulse">
                  분석 중...
                </div>
              </div>
            )}
            <div ref={aiBottomRef} />
          </div>

          {/* 입력창 */}
          <div className="px-5 py-3 border-t border-gray-100 flex gap-2">
            <input
              type="text"
              value={aiInput}
              onChange={e => setAiInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleAiSend()}
              placeholder="질문을 입력하세요 (Enter로 전송)"
              className="flex-1 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={aiLoading}
            />
            <button
              onClick={handleAiSend}
              disabled={aiLoading || !aiInput.trim()}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-300 text-sm font-medium whitespace-nowrap"
            >
              전송
            </button>
            {aiMessages.length > 0 && (
              <button
                onClick={() => setAiMessages([])}
                className="px-3 py-2 text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-md"
              >
                초기화
              </button>
            )}
          </div>
        </div>

      </div>
    </Layout>
  );
}
