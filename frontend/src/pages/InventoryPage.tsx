import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import { formatKST } from '../lib/formatters';
import type { InventoryItem, InventoryResponse } from '../types/inventory';

const PAGE_SIZE = 20;

type TabType = 'normal' | 'unmapped';

interface Filters {
  productName: string;
  optionName: string;
  stockStatus: 'all' | 'in_stock' | 'out_of_stock';
}

const initialFilters: Filters = {
  productName: '',
  optionName: '',
  stockStatus: 'all',
};

type SortOrder = 'none' | 'asc' | 'desc';

interface InventoryApiResponse extends InventoryResponse {
  totalAll: number;
  totalInStock: number;
  totalOutOfStock: number;
}

const InventoryPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [page, setPage] = useState(1);

  // 입력 중인 필터 (검색 버튼 누르기 전)
  const [filterInput, setFilterInput] = useState<Filters>(initialFilters);
  // 실제 API에 사용되는 필터
  const [appliedFilters, setAppliedFilters] = useState<Filters>(initialFilters);

  const mappedOnly = activeTab === 'normal' ? 'true' : 'false';

  const { data: apiResponse, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['inventory', page, mappedOnly, appliedFilters, sortOrder],
    queryFn: async () => {
      const response = await apiClient.get<InventoryApiResponse>('/api/coupang/inventory', {
        params: {
          page,
          pageSize: PAGE_SIZE,
          mappedOnly,
          productName: appliedFilters.productName || undefined,
          optionName: appliedFilters.optionName || undefined,
          stockStatus: appliedFilters.stockStatus !== 'all' ? appliedFilters.stockStatus : undefined,
        },
      });
      return response.data;
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/coupang/sync/inventory'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  const inventoryItems = apiResponse?.data || [];
  const totalPages = apiResponse?.totalPages || 1;
  const total = apiResponse?.total || 0;
  const totalAll = apiResponse?.totalAll ?? 0;
  const totalInStock = apiResponse?.totalInStock ?? 0;
  const totalOutOfStock = apiResponse?.totalOutOfStock ?? 0;
  const lastSyncedAt = apiResponse?.lastSyncedAt || '';

  const hasActiveFilters = appliedFilters.productName !== '' || appliedFilters.optionName !== '' || appliedFilters.stockStatus !== 'all';
  const hasPendingChanges =
    filterInput.productName !== appliedFilters.productName ||
    filterInput.optionName !== appliedFilters.optionName ||
    filterInput.stockStatus !== appliedFilters.stockStatus;

  const toggleSort = () => {
    setSortOrder(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');
  };

  const sortedItems = sortOrder === 'none'
    ? inventoryItems
    : [...inventoryItems].sort((a, b) => {
        const cmp = (a.productName || '').localeCompare(b.productName || '', 'ko');
        return sortOrder === 'asc' ? cmp : -cmp;
      });

  const handleSearch = () => {
    setAppliedFilters({ ...filterInput });
    setPage(1);
  };

  const handleResetFilters = () => {
    setFilterInput(initialFilters);
    setAppliedFilters(initialFilters);
    setPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setFilterInput(initialFilters);
    setAppliedFilters(initialFilters);
    setSortOrder('none');
    setPage(1);
  };

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

  if (error) {
    return (
      <div className="min-h-screen bg-gray-100">
        <Header onBack={() => navigate({ to: '/' })} onSync={() => syncMutation.mutate()} isSyncing={syncMutation.isPending} lastSyncedAt={lastSyncedAt} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium mb-2">재고 정보를 불러올 수 없습니다</p>
            <p className="text-red-500 text-sm mb-4">{(error as Error).message}</p>
            <button onClick={() => refetch()} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
              다시 시도
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onBack={() => navigate({ to: '/' })} onSync={() => syncMutation.mutate()} isSyncing={syncMutation.isPending} lastSyncedAt={lastSyncedAt} />

      {syncMutation.isError && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            동기화 실패: {(syncMutation.error as Error)?.message}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* 전체 통계 (필터 무관) */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
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

        {/* 탭 */}
        <div className="mb-6 border-b border-gray-200 bg-white rounded-t-lg shadow-sm">
          <nav className="flex">
            <button
              onClick={() => handleTabChange('normal')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'normal'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              정상 재고
            </button>
            <button
              onClick={() => handleTabChange('unmapped')}
              className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === 'unmapped'
                  ? 'border-orange-500 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              미매핑 재고
            </button>
          </nav>
        </div>

        {/* 검색 조건 (정상 재고 탭만) */}
        {activeTab === 'normal' && (
          <div className="mb-6 bg-white rounded-lg shadow">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg"
            >
              <span className="font-medium text-gray-700">
                검색 조건
                {hasActiveFilters && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">필터 적용중</span>
                )}
              </span>
              <span className="text-gray-400">{showFilters ? '▲' : '▼'}</span>
            </button>

            {showFilters && (
              <div className="px-6 pb-4 border-t border-gray-100 pt-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">상품명</label>
                    <input
                      type="text"
                      value={filterInput.productName}
                      onChange={e => setFilterInput({ ...filterInput, productName: e.target.value })}
                      onKeyDown={e => e.key === 'Enter' && handleSearch()}
                      placeholder="상품명 검색..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">옵션명</label>
                    <input
                      type="text"
                      value={filterInput.optionName}
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
                </div>
                <div className="mt-4 flex items-center justify-between">
                  {hasPendingChanges && (
                    <p className="text-xs text-orange-500">검색 버튼을 눌러 적용하세요.</p>
                  )}
                  {!hasPendingChanges && hasActiveFilters && (
                    <p className="text-sm text-gray-500">
                      검색 결과: <span className="font-semibold text-blue-600">{total.toLocaleString()}</span>건
                    </p>
                  )}
                  {!hasPendingChanges && !hasActiveFilters && <span />}
                  <div className="flex gap-2 ml-auto">
                    {hasActiveFilters && (
                      <button
                        onClick={handleResetFilters}
                        className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                      >
                        초기화
                      </button>
                    )}
                    <button
                      onClick={handleSearch}
                      className="px-4 py-1.5 text-sm bg-blue-500 text-white rounded-md hover:bg-blue-600"
                    >
                      검색
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 미매핑 탭 안내 */}
        {activeTab === 'unmapped' && total > 0 && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
            상품명/옵션명이 조회되지 않는 재고입니다. 반품·삭제·판매종료 등으로 상품 정보가 없는 옵션ID입니다.
          </div>
        )}

        {/* Inventory Table */}
        {sortedItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              {activeTab === 'unmapped'
                ? '미매핑 재고가 없습니다'
                : hasActiveFilters
                  ? '검색 조건에 맞는 재고가 없습니다'
                  : '조회된 재고가 없습니다'
              }
            </p>
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
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션ID</th>
                    <th
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none"
                      onClick={activeTab === 'normal' ? toggleSort : undefined}
                    >
                      <span className="flex items-center gap-1">
                        상품명
                        {activeTab === 'normal' && (
                          <span className="text-gray-400">
                            {sortOrder === 'asc' ? '▲' : sortOrder === 'desc' ? '▼' : '⇅'}
                          </span>
                        )}
                      </span>
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션명</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">재고수량</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">판매량(30일)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">재고상태</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {sortedItems.map((item: InventoryItem) => (
                    <InventoryItemRow key={item.vendorItemId} item={item} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
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
                        className={`px-3 py-1 text-sm rounded border ${
                          p === page ? 'bg-blue-500 text-white border-blue-500' : 'border-gray-300 hover:bg-gray-100'
                        }`}>
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

function Header({
  onBack,
  onSync,
  isSyncing,
  lastSyncedAt,
}: {
  onBack: () => void;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncedAt: string;
}) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800 font-medium">
            &larr; 뒤로
          </button>
          <h1 className="text-2xl font-bold text-gray-800">재고 관리</h1>
          {lastSyncedAt && (
            <span className="text-xs text-gray-400">마지막 동기화: {formatKST(lastSyncedAt)}</span>
          )}
        </div>
        <button
          onClick={onSync}
          disabled={isSyncing}
          className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm disabled:opacity-60 flex items-center gap-2"
        >
          {isSyncing && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
          {isSyncing ? '동기화 중...' : '동기화'}
        </button>
      </div>
    </header>
  );
}

function InventoryItemRow({ item }: { item: InventoryItem }) {
  const isInStock = (item.stockQuantity || 0) > 0;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-500 font-mono whitespace-nowrap">{item.vendorItemId}</td>
      <td className="px-4 py-3 text-sm text-gray-900">
        {item.productName
          ? <div className="max-w-xs truncate">{item.productName}</div>
          : <div className="text-gray-400 italic">-</div>
        }
      </td>
      <td className="px-4 py-3 text-sm text-gray-700">
        {item.itemName
          ? <div className="max-w-xs truncate">{item.itemName}</div>
          : <div className="text-gray-400 italic">-</div>
        }
      </td>
      <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">
        {(item.stockQuantity || 0).toLocaleString()}
      </td>
      <td className="px-4 py-3 text-sm text-gray-600 text-center">
        {item.salesLast30Days || 0}
      </td>
      <td className="px-4 py-3 text-center">
        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
          isInStock ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
        }`}>
          {isInStock ? '재고 있음' : '품절'}
        </span>
      </td>
    </tr>
  );
}

export default InventoryPage;
