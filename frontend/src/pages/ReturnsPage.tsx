import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/api';
import { formatKST } from '../lib/formatters';
import type { ReturnItem, ReturnsResponse } from '../types/returns';
import { RETURN_STATUSES } from '../types/returns';
import type { RevenueItem, RevenueResponse } from '../types/revenue';
import Layout from '../components/Layout';

// ─── 반품 탭 ────────────────────────────────────────────────────

const ReturnsTab = () => {
  const queryClient = useQueryClient();

  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return {
      from: from.toISOString().slice(0, 16),
      to: to.toISOString().slice(0, 16),
    };
  });
  const [status, setStatus] = useState('');
  const [searchParams, setSearchParams] = useState({
    from: new Date(Date.now() - 7 * 86400000).toISOString().slice(0, 16),
    to: new Date().toISOString().slice(0, 16),
    status: '',
  });

  const { data: apiResponse, isLoading, isFetching, error } = useQuery({
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
  const lastSyncedAt = apiResponse?.lastSyncedAt || '';

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/coupang/sync/returns'),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['returns'] }),
  });

  const handleSearch = () => setSearchParams({ from: dateRange.from, to: dateRange.to, status });

  const handleQuickDate = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const newFrom = from.toISOString().slice(0, 16);
    const newTo = to.toISOString().slice(0, 16);
    setDateRange({ from: newFrom, to: newTo });
    setSearchParams({ from: newFrom, to: newTo, status });
  };

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">반품 내역을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <div className="flex items-center gap-3">
          {lastSyncedAt && (
            <span className="text-xs text-gray-400">마지막 동기화: {formatKST(lastSyncedAt)}</span>
          )}
        </div>
        <button
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm disabled:opacity-60 flex items-center gap-2"
        >
          {syncMutation.isPending && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
          {syncMutation.isPending ? '동기화 중...' : '동기화'}
        </button>
      </div>

      {syncMutation.isError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
          동기화 실패: {(syncMutation.error as Error)?.message}
        </div>
      )}

      {/* 검색 조건 */}
      <div className="mb-6 bg-white p-5 rounded-lg shadow">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">조회 시작</label>
            <input type="datetime-local" value={dateRange.from}
              onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-gray-400 pb-2">~</span>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">조회 종료</label>
            <input type="datetime-local" value={dateRange.to}
              onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">상태</label>
            <select value={status} onChange={e => setStatus(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {RETURN_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <button onClick={handleSearch}
            className="px-5 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 font-medium"
          >
            조회
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <span className="text-xs text-gray-500 self-center">빠른 선택:</span>
          {[{ label: '오늘', days: 0 }, { label: '최근 3일', days: 3 }, { label: '최근 7일', days: 7 }, { label: '최근 30일', days: 30 }].map(({ label, days }) => (
            <button key={label} onClick={() => handleQuickDate(days)}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >{label}</button>
          ))}
        </div>
        {!lastSyncedAt && (
          <p className="mt-2 text-xs text-orange-600">동기화된 데이터가 없습니다. "동기화" 버튼을 눌러 데이터를 가져오세요.</p>
        )}
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

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          조회 실패: {(error as Error).message}
        </div>
      )}

      {returnItems.length === 0 && !isLoading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">조회된 반품 내역이 없습니다</p>
          {!lastSyncedAt
            ? <p className="text-gray-400 text-sm mt-2">먼저 동기화 버튼을 눌러 데이터를 가져오세요.</p>
            : <p className="text-gray-400 text-sm mt-2">기간 또는 상태 조건을 변경하여 다시 조회해보세요</p>
          }
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
                  {['접수번호', '주문번호', '상태', '상품명 / 옵션명', '옵션ID', '반품수량', '반품사유', '접수일시', '반품완료일시'].map(h => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {returnItems.map((item, idx) => (
                  <tr key={item.receiptId ?? idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap font-mono">{item.receiptId}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap font-mono">{item.orderId}</td>
                    <td className="px-4 py-3 whitespace-nowrap"><StatusBadge s={String(item.status || '')} /></td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      <div className="max-w-xs truncate">{item.productName || '-'}</div>
                      {item.itemName && <div className="max-w-xs truncate text-xs text-gray-400 mt-0.5">{item.itemName}</div>}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap font-mono">{item.vendorItemId || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 text-center">{item.returnCount || item.quantity || '-'}</td>
                    <td className="px-4 py-3 text-sm text-gray-700"><div className="max-w-xs truncate">{item.returnReason || '-'}</div></td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatKST(item.createdAt ?? '')}</td>
                    <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{formatKST(item.returnedAt ?? '')}</td>
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
    </div>
  );
};

// ─── 정산 탭 ────────────────────────────────────────────────────

const fmt = (n: number) => n.toLocaleString('ko-KR');

const RevenueTab = () => {
  const queryClient = useQueryClient();

  const today = new Date().toISOString().slice(0, 10);
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);

  const [dateRange, setDateRange] = useState({ from: thirtyDaysAgo, to: today });
  const [saleType, setSaleType] = useState('');
  const [searchParams, setSearchParams] = useState({ from: thirtyDaysAgo, to: today, saleType: '' });
  const [syncRange, setSyncRange] = useState({ from: thirtyDaysAgo, to: today });
  const [expandedOrders, setExpandedOrders] = useState<Set<string>>(new Set());

  const { data: apiResponse, isLoading, isFetching, error } = useQuery({
    queryKey: ['revenue', searchParams.from, searchParams.to, searchParams.saleType],
    queryFn: async () => {
      const params: Record<string, string> = { from: searchParams.from, to: searchParams.to };
      if (searchParams.saleType) params.saleType = searchParams.saleType;
      const response = await apiClient.get<RevenueResponse>('/api/coupang/revenue', { params });
      return response.data;
    },
    retry: 1,
    staleTime: 2 * 60 * 1000,
  });

  const revenueItems: RevenueItem[] = apiResponse?.data || [];
  const lastSyncedAt = apiResponse?.lastSyncedAt || '';

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/coupang/sync/revenue', { from: syncRange.from, to: syncRange.to }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['revenue'] }),
  });

  const handleSearch = () => setSearchParams({ from: dateRange.from, to: dateRange.to, saleType });

  const handleQuickDate = (days: number) => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - days);
    const newFrom = from.toISOString().slice(0, 10);
    const newTo = to.toISOString().slice(0, 10);
    setDateRange({ from: newFrom, to: newTo });
    setSearchParams({ from: newFrom, to: newTo, saleType });
  };

  const toggleExpand = (key: string) => {
    setExpandedOrders(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  // 합계 계산
  const totalSettlement = revenueItems.reduce((sum, r) =>
    sum + r.items.reduce((s, it) => s + it.settlementAmount, 0), 0);
  const saleSettlement = revenueItems.filter(r => r.saleType === 'SALE').reduce((sum, r) =>
    sum + r.items.reduce((s, it) => s + it.settlementAmount, 0), 0);
  const refundSettlement = revenueItems.filter(r => r.saleType === 'REFUND').reduce((sum, r) =>
    sum + r.items.reduce((s, it) => s + it.settlementAmount, 0), 0);

  const SaleTypeBadge = ({ t }: { t: string }) => (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
      t === 'SALE' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
    }`}>
      {t === 'SALE' ? '주문' : '반품'}
    </span>
  );

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">정산 내역을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* 동기화 패널 */}
      <div className="mb-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm font-medium text-blue-800 mb-2">매출내역 동기화 (최대 31일)</p>
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">시작일</label>
            <input type="date" value={syncRange.from}
              max={syncRange.to}
              onChange={e => setSyncRange(r => ({ ...r, from: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-gray-400 pb-2">~</span>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">종료일</label>
            <input type="date" value={syncRange.to}
              min={syncRange.from}
              onChange={e => setSyncRange(r => ({ ...r, to: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <button
            onClick={() => syncMutation.mutate()}
            disabled={syncMutation.isPending}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm disabled:opacity-60 flex items-center gap-2"
          >
            {syncMutation.isPending && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            {syncMutation.isPending ? '동기화 중...' : '동기화'}
          </button>
          {lastSyncedAt && (
            <span className="text-xs text-gray-400 self-end pb-2">마지막 동기화: {formatKST(lastSyncedAt)}</span>
          )}
        </div>
        {syncMutation.isError && (
          <p className="mt-2 text-xs text-red-600">동기화 실패: {(syncMutation.error as Error)?.message}</p>
        )}
        {syncMutation.isSuccess && (
          <p className="mt-2 text-xs text-green-600">동기화 완료</p>
        )}
        {!lastSyncedAt && (
          <p className="mt-2 text-xs text-orange-600">동기화된 데이터가 없습니다. 기간을 선택하고 동기화 버튼을 눌러주세요.</p>
        )}
      </div>

      {/* 조회 조건 */}
      <div className="mb-6 bg-white p-5 rounded-lg shadow">
        <div className="flex flex-wrap items-end gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">매출인식일 시작</label>
            <input type="date" value={dateRange.from}
              onChange={e => setDateRange(d => ({ ...d, from: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <span className="text-gray-400 pb-2">~</span>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">매출인식일 종료</label>
            <input type="date" value={dateRange.to}
              onChange={e => setDateRange(d => ({ ...d, to: e.target.value }))}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">유형</label>
            <select value={saleType} onChange={e => setSaleType(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">전체</option>
              <option value="SALE">주문</option>
              <option value="REFUND">반품</option>
            </select>
          </div>
          <button onClick={handleSearch}
            className="px-5 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 font-medium"
          >
            조회
          </button>
        </div>
        <div className="flex gap-2 mt-3">
          <span className="text-xs text-gray-500 self-center">빠른 선택:</span>
          {[{ label: '최근 7일', days: 7 }, { label: '최근 14일', days: 14 }, { label: '최근 30일', days: 30 }].map(({ label, days }) => (
            <button key={label} onClick={() => handleQuickDate(days)}
              className="px-3 py-1 text-xs border border-gray-300 rounded hover:bg-gray-50"
            >{label}</button>
          ))}
        </div>
      </div>

      {/* 합계 카드 */}
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">총 정산금액</p>
          <p className={`text-2xl font-bold ${totalSettlement >= 0 ? 'text-blue-600' : 'text-red-600'}`}>
            {fmt(Math.round(totalSettlement))}원
          </p>
          <p className="text-xs text-gray-400 mt-1">총 {apiResponse?.total ?? 0}건</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">주문 정산합계</p>
          <p className="text-2xl font-bold text-green-600">{fmt(Math.round(saleSettlement))}원</p>
          <p className="text-xs text-gray-400 mt-1">{revenueItems.filter(r => r.saleType === 'SALE').length}건</p>
        </div>
        <div className="bg-white p-4 rounded-lg shadow">
          <p className="text-sm text-gray-500">반품 정산합계</p>
          <p className="text-2xl font-bold text-red-600">{fmt(Math.round(refundSettlement))}원</p>
          <p className="text-xs text-gray-400 mt-1">{revenueItems.filter(r => r.saleType === 'REFUND').length}건</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-4 text-sm text-red-600">
          조회 실패: {(error as Error).message}
        </div>
      )}

      {revenueItems.length === 0 && !isLoading ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <p className="text-gray-500 text-lg">조회된 정산 내역이 없습니다</p>
          {!lastSyncedAt
            ? <p className="text-gray-400 text-sm mt-2">먼저 동기화 버튼을 눌러 데이터를 가져오세요.</p>
            : <p className="text-gray-400 text-sm mt-2">기간 또는 유형 조건을 변경하여 다시 조회해보세요</p>
          }
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap w-8"></th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">매출인식일</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">주문번호</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">유형</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">결제완료일</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase whitespace-nowrap">정산금액 합계</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase whitespace-nowrap">지급예정일</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {revenueItems.map((item) => {
                  const key = `${item.orderId}-${item.saleType}-${item.recognitionDate}`;
                  const isExpanded = expandedOrders.has(key);
                  const itemTotal = item.items.reduce((s, it) => s + it.settlementAmount, 0);

                  return (
                    <>
                      <tr key={key} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleExpand(key)}>
                        <td className="px-4 py-3 text-gray-400 text-center">
                          {item.items.length > 0 ? (isExpanded ? '▼' : '▶') : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{item.recognitionDate}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap font-mono">{item.orderId || '-'}</td>
                        <td className="px-4 py-3 whitespace-nowrap"><SaleTypeBadge t={item.saleType} /></td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{item.saleDate}</td>
                        <td className={`px-4 py-3 text-sm font-medium text-right whitespace-nowrap ${itemTotal >= 0 ? 'text-gray-900' : 'text-red-600'}`}>
                          {fmt(Math.round(itemTotal))}원
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 whitespace-nowrap">{item.settlementDate}</td>
                      </tr>
                      {isExpanded && item.items.map((it, idx) => (
                        <tr key={`${key}-item-${idx}`} className="bg-gray-50">
                          <td className="px-4 py-2"></td>
                          <td colSpan={2} className="px-4 py-2 text-xs text-gray-600">
                            <div className="font-medium">{it.productName || '-'}</div>
                            {it.vendorItemName && <div className="text-gray-400 mt-0.5">{it.vendorItemName}</div>}
                            {it.externalSellerSkuCode && <div className="text-gray-400">SKU: {it.externalSellerSkuCode}</div>}
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-500">수량: {it.quantity}</td>
                          <td className="px-4 py-2 text-xs text-gray-500">판매가: {fmt(it.salePrice)}원</td>
                          <td className="px-4 py-2 text-xs text-right">
                            <div className={`font-medium ${it.settlementAmount >= 0 ? 'text-gray-800' : 'text-red-600'}`}>
                              {fmt(Math.round(it.settlementAmount))}원
                            </div>
                            <div className="text-gray-400">수수료 {it.serviceFeeRatio}% ({fmt(Math.round(it.serviceFee))}원)</div>
                          </td>
                          <td className="px-4 py-2 text-xs text-gray-400">매출액: {fmt(Math.round(it.saleAmount))}원</td>
                        </tr>
                      ))}
                    </>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 text-sm text-gray-500">
            총 <span className="font-semibold text-gray-800">{apiResponse?.total ?? 0}</span>건 /
            정산합계 <span className={`font-semibold ${totalSettlement >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{fmt(Math.round(totalSettlement))}원</span>
            <span className="ml-4 text-xs text-gray-400">{searchParams.from} ~ {searchParams.to}</span>
          </div>
        </div>
      )}
    </div>
  );
};

// ─── 메인 페이지 ─────────────────────────────────────────────────

const ReturnsPage = () => {
  const [activeTab, setActiveTab] = useState<'returns' | 'revenue'>('returns');

  return (
    <Layout>
      <div>
        {/* 탭 */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex gap-6">
            <button
              onClick={() => setActiveTab('returns')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'returns'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              반품 목록
            </button>
            <button
              onClick={() => setActiveTab('revenue')}
              className={`py-3 px-1 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'revenue'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              정산 내역
            </button>
          </nav>
        </div>

        {activeTab === 'returns' ? <ReturnsTab /> : <RevenueTab />}
      </div>
    </Layout>
  );
};

export default ReturnsPage;
