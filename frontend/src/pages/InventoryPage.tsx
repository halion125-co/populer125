import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
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

const InventoryPage = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('normal');
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [sortOrder, setSortOrder] = useState<SortOrder>('none');
  const [page, setPage] = useState(1);

  const toggleSort = () => {
    setSortOrder(prev => prev === 'none' ? 'asc' : prev === 'asc' ? 'desc' : 'none');
  };

  const { data: apiResponse, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: ['inventory', page],
    queryFn: async () => {
      const response = await apiClient.get<InventoryResponse>('/api/coupang/inventory', {
        params: { page, pageSize: PAGE_SIZE },
      });
      return response.data;
    },
    staleTime: 3 * 60 * 1000,
    retry: 1,
  });

  const inventoryItems = apiResponse?.data || [];
  const totalPages = apiResponse?.totalPages || 1;
  const total = apiResponse?.total || 0;

  // 탭별 아이템 분리
  const normalItems = useMemo(() => inventoryItems.filter(item => item.isMapped), [inventoryItems]);
  const unmappedItems = useMemo(() => inventoryItems.filter(item => !item.isMapped), [inventoryItems]);

  const currentTabItems = activeTab === 'normal' ? normalItems : unmappedItems;

  const filteredItems = useMemo(() => {
    const filtered = currentTabItems.filter((item: InventoryItem) => {
      if (filters.productName && !item.productName.toLowerCase().includes(filters.productName.toLowerCase())) {
        return false;
      }
      if (filters.optionName && !item.itemName.toLowerCase().includes(filters.optionName.toLowerCase())) {
        return false;
      }
      if (filters.stockStatus !== 'all') {
        const stockQty = item.stockQuantity || 0;
        if (filters.stockStatus === 'in_stock' && stockQty <= 0) return false;
        if (filters.stockStatus === 'out_of_stock' && stockQty > 0) return false;
      }
      return true;
    });
    if (sortOrder === 'none') return filtered;
    return [...filtered].sort((a, b) => {
      const cmp = (a.productName || '').localeCompare(b.productName || '', 'ko');
      return sortOrder === 'asc' ? cmp : -cmp;
    });
  }, [currentTabItems, filters, sortOrder]);

  const hasActiveFilters = filters.productName !== '' || filters.optionName !== '' || filters.stockStatus !== 'all';

  const inStockCount = useMemo(() => currentTabItems.filter(item => (item.stockQuantity || 0) > 0).length, [currentTabItems]);
  const outOfStockCount = currentTabItems.length - inStockCount;

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
    setFilters(initialFilters);
    setSortOrder('none');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">재고 정보를 불러오는 중...</p>
          <p className="text-gray-400 text-sm mt-1">쿠팡 API 조회 중입니다</p>
        </div>
      </div>
    );
  }

  if (error) {
    const is429 = (error as { response?: { status?: number } })?.response?.status === 429;
    return (
      <div className="min-h-screen bg-gray-100">
        <Header onBack={() => navigate({ to: '/' })} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
            {is429 ? (
              <>
                <p className="text-yellow-700 font-medium mb-2">⏳ 쿠팡 API 요청 한도 초과</p>
                <p className="text-yellow-600 text-sm mb-4">잠시 후 다시 시도해주세요.</p>
              </>
            ) : (
              <>
                <p className="text-red-600 font-medium mb-2">재고 정보를 불러올 수 없습니다</p>
                <p className="text-red-500 text-sm mb-4">{(error as Error).message}</p>
              </>
            )}
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600"
            >
              다시 시도
            </button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-100">
      <Header onBack={() => navigate({ to: '/' })} onRefresh={() => { setPage(1); refetch(); }} />

      <main className="max-w-7xl mx-auto px-4 py-8">
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
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'normal' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {normalItems.length}
              </span>
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
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === 'unmapped' ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-600'
              }`}>
                {unmappedItems.length}
              </span>
            </button>
          </nav>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 옵션(SKU) 수</p>
            <p className="text-2xl font-bold text-blue-600">{total}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">이 페이지 재고 있음</p>
            <p className="text-2xl font-bold text-green-600">{inStockCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">이 페이지 품절</p>
            <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
          </div>
        </div>

        {/* Search Filters */}
        {activeTab === 'normal' && (
          <div className="mb-6 bg-white rounded-lg shadow">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="w-full px-6 py-3 flex items-center justify-between text-left hover:bg-gray-50 rounded-lg"
            >
              <span className="font-medium text-gray-700">
                검색 조건
                {hasActiveFilters && (
                  <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                    필터 적용중
                  </span>
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
                      value={filters.productName}
                      onChange={e => setFilters({ ...filters, productName: e.target.value })}
                      placeholder="상품명 검색..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">옵션명</label>
                    <input
                      type="text"
                      value={filters.optionName}
                      onChange={e => setFilters({ ...filters, optionName: e.target.value })}
                      placeholder="옵션명 검색..."
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-1">재고 상태</label>
                    <select
                      value={filters.stockStatus}
                      onChange={e => setFilters({ ...filters, stockStatus: e.target.value as Filters['stockStatus'] })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="all">전체</option>
                      <option value="in_stock">재고 있음</option>
                      <option value="out_of_stock">품절</option>
                    </select>
                  </div>
                </div>

                {hasActiveFilters && (
                  <div className="mt-4 flex items-center justify-between">
                    <p className="text-sm text-gray-500">
                      이 페이지 검색 결과: <span className="font-semibold text-blue-600">{filteredItems.length}</span>건
                    </p>
                    <button
                      onClick={() => setFilters(initialFilters)}
                      className="px-4 py-1.5 text-sm text-gray-600 border border-gray-300 rounded-md hover:bg-gray-50"
                    >
                      초기화
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* 미매핑 탭 안내 */}
        {activeTab === 'unmapped' && unmappedItems.length > 0 && (
          <div className="mb-4 bg-orange-50 border border-orange-200 rounded-lg px-4 py-3 text-sm text-orange-700">
            상품명/옵션명이 조회되지 않는 재고입니다. 반품·삭제·판매종료 등으로 상품 정보가 없는 옵션ID입니다.
          </div>
        )}

        {/* Inventory Table */}
        {filteredItems.length === 0 ? (
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
                  {filteredItems.map((item: InventoryItem) => (
                    <InventoryItemRow key={item.vendorItemId} item={item} />
                  ))}
                </tbody>
              </table>
            </div>

            {/* Pagination */}
            <div className="px-4 py-3 border-t border-gray-200 flex items-center justify-between bg-gray-50">
              <p className="text-sm text-gray-500">
                전체 <span className="font-semibold">{total}</span>개 중{' '}
                {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, total)}번째
              </p>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handlePageChange(1)}
                  disabled={page === 1}
                  className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed"
                >
                  «
                </button>
                <button
                  onClick={() => handlePageChange(page - 1)}
                  disabled={page === 1}
                  className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed"
                >
                  이전
                </button>

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
                      <button
                        key={p}
                        onClick={() => handlePageChange(p as number)}
                        className={`px-3 py-1 text-sm rounded border ${
                          p === page
                            ? 'bg-blue-500 text-white border-blue-500'
                            : 'border-gray-300 hover:bg-gray-100'
                        }`}
                      >
                        {p}
                      </button>
                    )
                  )}

                <button
                  onClick={() => handlePageChange(page + 1)}
                  disabled={page === totalPages}
                  className="px-3 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed"
                >
                  다음
                </button>
                <button
                  onClick={() => handlePageChange(totalPages)}
                  disabled={page === totalPages}
                  className="px-2 py-1 text-sm rounded border border-gray-300 disabled:opacity-40 hover:bg-gray-100 disabled:cursor-not-allowed"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

function Header({ onBack, onRefresh }: { onBack: () => void; onRefresh?: () => void }) {
  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800 font-medium">
            &larr; 뒤로
          </button>
          <h1 className="text-2xl font-bold text-gray-800">재고 관리</h1>
        </div>
        {onRefresh && (
          <button
            onClick={onRefresh}
            className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
          >
            새로고침
          </button>
        )}
      </div>
    </header>
  );
}

function InventoryItemRow({ item }: { item: InventoryItem }) {
  const isInStock = (item.stockQuantity || 0) > 0;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 text-sm text-gray-500 font-mono whitespace-nowrap">
        {item.vendorItemId}
      </td>
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
        <StockStatusBadge isInStock={isInStock} />
      </td>
    </tr>
  );
}

function StockStatusBadge({ isInStock }: { isInStock: boolean }) {
  if (isInStock) {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
        재고 있음
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
      품절
    </span>
  );
}

export default InventoryPage;
