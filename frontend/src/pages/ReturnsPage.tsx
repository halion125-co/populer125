import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import type { ReturnItem, ReturnsResponse } from '../types/returns';
import { RETURN_STATUSES } from '../types/returns';

const ReturnsPage = () => {
  const navigate = useNavigate();

  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return {
      from: from.toISOString().slice(0, 16), // YYYY-MM-DDTHH:MM
      to: to.toISOString().slice(0, 16),
    };
  });
  const [status, setStatus] = useState('');
  const [searchParams, setSearchParams] = useState({
    from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 16),
    to: new Date().toISOString().slice(0, 16),
    status: '',
  });

  const { data: apiResponse, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['returns', searchParams.from, searchParams.to, searchParams.status],
    queryFn: async () => {
      const params: Record<string, string> = {
        createdAtFrom: searchParams.from,
        createdAtTo: searchParams.to,
      };
      if (searchParams.status) params.status = searchParams.status;
      const response = await apiClient.get<ReturnsResponse>('/api/coupang/returns', { params });
      return response.data;
    },
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });

  const returnItems: ReturnItem[] = apiResponse?.data || [];

  // 검색 실행
  const handleSearch = () => {
    setSearchParams({ from: dateRange.from, to: dateRange.to, status });
  };

  const handleQuickDate = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const newFrom = from.toISOString().slice(0, 16);
    const newTo = to.toISOString().slice(0, 16);
    setDateRange({ from: newFrom, to: newTo });
    setSearchParams({ from: newFrom, to: newTo, status });
  };

  // raw 필드에서 핵심 값 추출 (API 응답 구조 미확정이므로 유연하게)
  const getField = (item: ReturnItem, ...keys: string[]): string => {
    for (const key of keys) {
      const val = item[key];
      if (val !== undefined && val !== null && val !== '') return String(val);
    }
    return '-';
  };

  const formatDateTime = (val: string | undefined) => {
    if (!val) return '-';
    // timestamp (ms) 또는 ISO 문자열 처리
    const num = Number(val);
    if (!isNaN(num) && num > 1000000000000) {
      const d = new Date(num);
      return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}:${String(d.getSeconds()).padStart(2,'0')}`;
    }
    if (val.includes('T') || val.includes('-')) {
      return val.replace('T', ' ').slice(0, 19);
    }
    return val;
  };

  // 상태 배지
  const StatusBadge = ({ s }: { s: string }) => {
    const colors: Record<string, string> = {
      UC: 'bg-yellow-100 text-yellow-800',
      RU: 'bg-blue-100 text-blue-800',
      CC: 'bg-gray-100 text-gray-700',
      PR: 'bg-purple-100 text-purple-800',
    };
    const found = RETURN_STATUSES.find(r => r.value === s);
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${colors[s] || 'bg-gray-100 text-gray-700'}`}>
        {found ? found.label : (s || '-')}
      </span>
    );
  };

  // raw JSON에서 표시할 주요 필드 목록 (API 응답 구조에 맞게 자동 표시)
  const columns = useMemo(() => {
    if (returnItems.length === 0) return [];
    const first = returnItems[0];
    // 핵심 필드 우선 정렬
    const priority = ['receiptId', 'orderId', 'status', 'statusName', 'productName', 'vendorItemId', 'returnCount', 'salesQuantity', 'quantity', 'returnReason', 'createdAt', 'cancelledAt', 'returnedAt'];
    const keys = Object.keys(first);
    const sorted = [
      ...priority.filter(k => keys.includes(k)),
      ...keys.filter(k => !priority.includes(k)),
    ];
    return sorted.slice(0, 12); // 최대 12컬럼
  }, [returnItems]);

  const colLabels: Record<string, string> = {
    receiptId: '접수번호',
    orderId: '주문번호',
    status: '상태코드',
    statusName: '상태명',
    productName: '상품명',
    vendorItemId: '옵션ID',
    returnCount: '반품수량',
    salesQuantity: '판매수량',
    quantity: '수량',
    returnReason: '반품사유',
    returnReasonCode: '사유코드',
    createdAt: '접수일시',
    cancelledAt: '취소일시',
    returnedAt: '반품일시',
  };

  const dateFields = new Set(['createdAt', 'cancelledAt', 'returnedAt']);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">반품 내역을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate({ to: '/' })} className="text-blue-600 hover:text-blue-800 font-medium">
              &larr; 뒤로
            </button>
            <h1 className="text-2xl font-bold text-gray-800">반품 관리</h1>
          </div>
          <button
            onClick={() => refetch()}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            새로고침
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 검색 조건 */}
        <div className="mb-6 bg-white p-5 rounded-lg shadow">
          <div className="flex flex-wrap items-end gap-4">
            {/* 기간 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">조회 시작</label>
              <input
                type="datetime-local"
                value={dateRange.from}
                onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <span className="text-gray-400 pb-2">~</span>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">조회 종료</label>
              <input
                type="datetime-local"
                value={dateRange.to}
                onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 상태 */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
              <select
                value={status}
                onChange={e => setStatus(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {RETURN_STATUSES.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
            </div>

            {/* 조회 버튼 */}
            <button
              onClick={handleSearch}
              className="px-5 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 font-medium"
            >
              조회
            </button>
          </div>

          {/* 빠른 날짜 선택 */}
          <div className="flex gap-2 mt-3">
            <span className="text-xs text-gray-500 self-center">빠른 선택:</span>
            {[
              { label: '오늘', days: 0 },
              { label: '최근 3일', days: 3 },
              { label: '최근 7일', days: 7 },
              { label: '최근 30일', days: 30 },
            ].map(({ label, days }) => (
              <button
                key={label}
                onClick={() => handleQuickDate(days)}
                className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 반품건수</p>
            <p className="text-2xl font-bold text-blue-600">{apiResponse?.total ?? 0}</p>
          </div>
          {RETURN_STATUSES.filter(s => s.value).map(s => (
            <div key={s.value} className="bg-white p-4 rounded-lg shadow">
              <p className="text-sm text-gray-500">{s.label}</p>
              <p className="text-2xl font-bold text-gray-700">
                {returnItems.filter(i => i.status === s.value || i.statusName === s.value).length}
              </p>
            </div>
          ))}
        </div>

        {/* Error */}
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
            조회 실패: {(error as Error).message}
          </div>
        )}

        {/* Table */}
        {returnItems.length === 0 && !isLoading ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">조회된 반품 내역이 없습니다</p>
            <p className="text-gray-400 text-sm mt-2">기간 또는 상태 조건을 변경하여 다시 조회해보세요</p>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            {isFetching && (
              <div className="bg-blue-50 border-b border-blue-100 px-4 py-2 text-sm text-blue-600 flex items-center gap-2">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                조회 중...
              </div>
            )}
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    {columns.length > 0 ? (
                      columns.map(col => (
                        <th key={col} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                          {colLabels[col] || col}
                        </th>
                      ))
                    ) : (
                      <>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">접수번호</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">주문번호</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상태</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">접수일시</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {returnItems.map((item, idx) => (
                    <tr key={item.receiptId ?? idx} className="hover:bg-gray-50">
                      {columns.length > 0 ? (
                        columns.map(col => (
                          <td key={col} className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">
                            {col === 'status' || col === 'statusName' ? (
                              <StatusBadge s={String(item[col] || '')} />
                            ) : dateFields.has(col) ? (
                              formatDateTime(item[col] as string)
                            ) : col === 'productName' ? (
                              <div className="max-w-xs">{getField(item, col)}</div>
                            ) : (
                              getField(item, col)
                            )}
                          </td>
                        ))
                      ) : (
                        <>
                          <td className="px-4 py-3">{getField(item, 'receiptId')}</td>
                          <td className="px-4 py-3">{getField(item, 'orderId')}</td>
                          <td className="px-4 py-3"><StatusBadge s={getField(item, 'status', 'statusName')} /></td>
                          <td className="px-4 py-3">{getField(item, 'productName')}</td>
                          <td className="px-4 py-3">{formatDateTime(item.createdAt)}</td>
                        </>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
              총 <span className="font-semibold text-gray-800">{apiResponse?.total ?? 0}</span>건
              <span className="ml-4 text-xs text-gray-400">
                {searchParams.from.replace('T', ' ')} ~ {searchParams.to.replace('T', ' ')}
              </span>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ReturnsPage;
