import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import { formatKST } from '../lib/formatters';
import type { InventoryItem, InventoryResponse } from '../types/inventory';

const PAGE_SIZE = 20;

interface Filters {
  productName: string;
  optionName: string;
  stockStatus: 'all' | 'in_stock' | 'out_of_stock';
  mappedOnly: 'all' | 'true' | 'false';
  createdAtFrom: string;
  createdAtTo: string;
}

const initialFilters: Filters = {
  productName: '',
  optionName: '',
  stockStatus: 'all',
  mappedOnly: 'all',
  createdAtFrom: '',
  createdAtTo: '',
};

interface AlertItem {
  alertType: 'new' | 'out_of_stock';
  vendorItemId: number;
  productName: string;
  itemName: string;
  stockQuantity: number;
  salesLast30Days: number;
  alertAt: string;
}

const InventoryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [showFilters, setShowFilters] = useState(false);
  const [page, setPage] = useState(1);
  const [filterInput, setFilterInput] = useState<Filters>(initialFilters);
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  // 재고 목록 조회
  const { data: apiResponse, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['inventory', page, appliedFilters],
    queryFn: async () => {
      const params: Record<string, string> = { page: String(page), pageSize: String(PAGE_SIZE) };
      if (appliedFilters.productName) params.productName = appliedFilters.productName;
      if (appliedFilters.optionName) params.optionName = appliedFilters.optionName;
      if (appliedFilters.stockStatus !== 'all') params.stockStatus = appliedFilters.stockStatus;
      if (appliedFilters.mappedOnly !== 'all') params.mappedOnly = appliedFilters.mappedOnly;
      if (appliedFilters.createdAtFrom) params.createdAtFrom = appliedFilters.createdAtFrom;
      if (appliedFilters.createdAtTo) params.createdAtTo = appliedFilters.createdAtTo;
      const response = await apiClient.get<InventoryResponse>('/api/coupang/inventory', { params });
      return response.data;
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  // 최근 7일 알림 (신규+품절 통합)
  const { data: alertsData } = useQuery({
    queryKey: ['inventoryAlerts'],
    queryFn: async () => {
      const res = await apiClient.get<{ code: string; items: AlertItem[] }>('/api/coupang/inventory/alerts');
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/coupang/sync/inventory'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
      queryClient.invalidateQueries({ queryKey: ['inventoryAlerts'] });
    },
  });

  const items = apiResponse?.data || [];
  const totalPages = apiResponse?.totalPages || 1;
  const total = apiResponse?.total || 0;
  const totalAll = apiResponse?.totalAll ?? 0;
  const totalInStock = apiResponse?.totalInStock ?? 0;
  const totalOutOfStock = apiResponse?.totalOutOfStock ?? 0;
  const lastSyncedAt = apiResponse?.lastSyncedAt || '';
  const alertItems = alertsData?.items || [];

  const hasActiveFilters = Object.entries(appliedFilters).some(([, v]) => v !== '' && v !== 'all');
  const hasPendingChanges = JSON.stringify(filterInput) !== JSON.stringify(appliedFilters);

  const handleSearch = () => { setAppliedFilters({ ...filterInput }); setPage(1); };
  const handleReset = () => { setFilterInput(initialFilters); setAppliedFilters(initialFilters); setPage(1); };
  const handlePageChange = (p: number) => { setPage(p); window.scrollTo({ top: 0, behavior: 'smooth' }); };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">재고 정보를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      {/* 헤더 */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => navigate({ to: '/' })} className="text-blue-600 hover:text-blue-800 font-medium">&larr; 뒤로</button>
            <h1 className="text-2xl font-bold text-gray-800">재고 관리</h1>
            {lastSyncedAt && <span className="text-xs text-gray-400">마지막 동기화: {formatKST(lastSyncedAt)}</span>}
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
      </header>

      {error && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600 flex items-center justify-between">
            재고 정보를 불러올 수 없습니다.
            <button onClick={() => refetch()} className="ml-4 underline">다시 시도</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">

        {/* 전체 통계 */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">전체 SKU</p>
            <p className="text-2xl font-bold text-blue-600">{totalAll.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">재고 있음</p>
            <p className="text-2xl font-bold text-green-600">{totalInStock.toLocaleString()}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">품절</p>
            <p className="text-2xl font-bold text-red-600">{totalOutOfStock.toLocaleString()}</p>
          </div>
        </div>

        {/* 최근 7일 신규/품절 통합 알림 표 */}
        <AlertTable items={alertItems} />

        {/* 검색 조건 */}
        <div className="bg-white rounded-lg shadow">
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg"
          >
            <span className="font-medium text-gray-700">
              검색 조건
              {hasActiveFilters && <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">필터 적용중</span>}
            </span>
            <span className="text-gray-400">{showFilters ? '▲' : '▼'}</span>
          </button>

          {showFilters && (
            <div className="px-6 pb-4 border-t border-gray-100 pt-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">상품명</label>
                  <input
                    type="text" value={filterInput.productName}
                    onChange={e => setFilterInput({ ...filterInput, productName: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="상품명 검색..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">옵션명</label>
                  <input
                    type="text" value={filterInput.optionName}
                    onChange={e => setFilterInput({ ...filterInput, optionName: e.target.value })}
                    onKeyDown={e => e.key === 'Enter' && handleSearch()}
                    placeholder="옵션명 검색..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">재고 상태</label>
                  <select
                    value={filterInput.stockStatus}
                    onChange={e => setFilterInput({ ...filterInput, stockStatus: e.target.value as Filters['stockStatus'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">전체</option>
                    <option value="in_stock">재고 있음</option>
                    <option value="out_of_stock">품절</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">매핑 여부</label>
                  <select
                    value={filterInput.mappedOnly}
                    onChange={e => setFilterInput({ ...filterInput, mappedOnly: e.target.value as Filters['mappedOnly'] })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="all">전체</option>
                    <option value="true">매핑</option>
                    <option value="false">미매핑</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">생성일자 (KST)</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="date" value={filterInput.createdAtFrom}
                      onChange={e => setFilterInput({ ...filterInput, createdAtFrom: e.target.value })}
                      className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400 text-xs">~</span>
                    <input
                      type="date" value={filterInput.createdAtTo}
                      onChange={e => setFilterInput({ ...filterInput, createdAtTo: e.target.value })}
                      className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center justify-between">
                {hasPendingChanges
                  ? <p className="text-xs text-orange-500">검색 버튼을 눌러 적용하세요.</p>
                  : hasActiveFilters
                    ? <p className="text-sm text-gray-500">검색 결과: <span className="font-semibold text-blue-600">{total.toLocaleString()}</span>건</p>
                    : <span />
                }
                <div className="flex gap-2 ml-auto">
                  {hasActiveFilters && (
                    <button onClick={handleReset} className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50">초기화</button>
                  )}
                  <button onClick={handleSearch} className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600">검색</button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 재고 목록 */}
        {items.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">{hasActiveFilters ? '검색 조건에 맞는 재고가 없습니다' : '조회된 재고가 없습니다'}</p>
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
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">옵션ID</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">옵션명</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">재고수량</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">판매량(30일)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">재고상태</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">매핑</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">생성일자</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">품절일자</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {items.map((item: InventoryItem) => (
                    <InventoryItemRow key={item.vendorItemId} item={item} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* 페이지네이션 */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                전체 <span className="font-semibold">{total.toLocaleString()}</span>개 중{' '}
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}번째
              </p>
              <div className="flex items-center gap-1">
                <button onClick={() => handlePageChange(1)} disabled={page === 1}
                  className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed">«</button>
                <button onClick={() => handlePageChange(page - 1)} disabled={page === 1}
                  className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed">이전</button>
                {Array.from({ length: totalPages }, (_, i) => i + 1)
                  .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                  .reduce<(number | '...')[]>((acc, p, idx, arr) => {
                    if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push('...');
                    acc.push(p);
                    return acc;
                  }, [])
                  .map((p, idx) =>
                    p === '...' ? (
                      <span key={`dot-${idx}`} className="px-2 py-1 text-sm text-gray-400">…</span>
                    ) : (
                      <button key={p} onClick={() => handlePageChange(p as number)}
                        className={`px-3 py-1 text-sm rounded border ${p === page ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 hover:bg-gray-100'}`}>
                        {p}
                      </button>
                    )
                  )}
                <button onClick={() => handlePageChange(page + 1)} disabled={page === totalPages}
                  className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed">다음</button>
                <button onClick={() => handlePageChange(totalPages)} disabled={page === totalPages}
                  className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed">»</button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

function InventoryItemRow({ item }: { item: InventoryItem }) {
  const isInStock = (item.stockQuantity || 0) > 0;
  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-500 font-mono whitespace-nowrap">{item.vendorItemId}</td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {item.productName ? <div className="max-w-xs truncate">{item.productName}</div> : <span className="text-gray-400 italic">-</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {item.itemName ? <div className="max-w-xs truncate">{item.itemName}</div> : <span className="text-gray-400 italic">-</span>}
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">{(item.stockQuantity || 0).toLocaleString()}</td>
      <td className="px-4 py-3 text-sm text-gray-600 text-center">{item.salesLast30Days || 0}</td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${isInStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
          {isInStock ? '재고 있음' : '품절'}
        </span>
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs ${item.isMapped ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
          {item.isMapped ? '매핑' : '미매핑'}
        </span>
      </td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{formatKST(item.createdAt)}</td>
      <td className="px-4 py-3 text-xs text-gray-500 whitespace-nowrap">{item.outOfStockAt ? formatKST(item.outOfStockAt) : '-'}</td>
    </tr>
  );
}

function AlertTable({ items }: { items: AlertItem[] }) {
  const [expanded, setExpanded] = useState(true);
  const newCount = items.filter(i => i.alertType === 'new').length;
  const outCount = items.filter(i => i.alertType === 'out_of_stock').length;

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-3 flex items-center justify-between hover:bg-gray-50 rounded-t-lg"
      >
        <div className="flex items-center gap-3">
          <span className="font-semibold text-sm text-gray-700">최근 7일 알림</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-700">신규 {newCount}건</span>
          <span className="px-2 py-0.5 text-xs rounded-full bg-red-100 text-red-700">품절 {outCount}건</span>
        </div>
        <span className="text-gray-400 text-xs">{expanded ? '▲' : '▼'}</span>
      </button>
      {expanded && (
        items.length === 0 ? (
          <div className="px-5 py-6 text-sm text-gray-400 text-center border-t border-gray-100">최근 7일간 신규 추가 또는 품절된 상품이 없습니다.</div>
        ) : (
          <div className="overflow-x-auto border-t border-gray-100">
            <table className="min-w-full text-xs divide-y divide-gray-100">
              <thead className="bg-gray-50 text-gray-500">
                <tr>
                  <th className="px-4 py-2 text-left font-medium">구분</th>
                  <th className="px-4 py-2 text-left font-medium">옵션ID</th>
                  <th className="px-4 py-2 text-left font-medium">상품명 / 옵션명</th>
                  <th className="px-4 py-2 text-center font-medium">재고수량</th>
                  <th className="px-4 py-2 text-center font-medium">30일 판매</th>
                  <th className="px-4 py-2 text-left font-medium">일자</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((item, idx) => (
                  <tr key={`${item.alertType}-${item.vendorItemId}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap">
                      {item.alertType === 'new'
                        ? <span className="px-2 py-0.5 rounded-full bg-blue-100 text-blue-700 font-medium">신규</span>
                        : <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 font-medium">품절</span>
                      }
                    </td>
                    <td className="px-4 py-2 font-mono text-gray-500 whitespace-nowrap">{item.vendorItemId}</td>
                    <td className="px-4 py-2">
                      <div className="text-gray-800 truncate max-w-[200px]">{item.productName || '-'}</div>
                      <div className="text-gray-400 truncate max-w-[200px]">{item.itemName || '-'}</div>
                    </td>
                    <td className="px-4 py-2 text-center font-medium text-gray-700">{(item.stockQuantity || 0).toLocaleString()}</td>
                    <td className="px-4 py-2 text-center text-gray-500">{item.salesLast30Days || 0}</td>
                    <td className="px-4 py-2 text-gray-500 whitespace-nowrap">{formatKST(item.alertAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}

export default InventoryPage;
