import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import type { InventoryItem, InventoryResponse } from '../types/inventory';
import type { Order, OrderItem } from '../types/order';

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

const InventoryPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  // Fetch inventory data
  const { data: inventoryItems, isLoading, error, refetch } = useQuery({
    queryKey: ['inventory'],
    queryFn: async () => {
      const response = await apiClient.get<InventoryResponse>('/api/coupang/inventory');
      return response.data.data || [];
    },
    staleTime: 5 * 60 * 1000, // 5분 캐싱
  });

  // Fetch recent orders for sales calculation (last 30 days)
  const { data: recentOrders } = useQuery({
    queryKey: ['orders-recent'],
    queryFn: async () => {
      const to = new Date();
      const from30 = new Date();
      from30.setDate(from30.getDate() - 30);
      const response = await apiClient.get('/api/coupang/orders', {
        params: {
          createdAtFrom: from30.toISOString().slice(0, 10),
          createdAtTo: to.toISOString().slice(0, 10),
        },
      });
      return response.data.data || [];
    },
    staleTime: 5 * 60 * 1000,
  });

  // Calculate sales per vendorItemId
  const salesMap = useMemo(() => {
    const map = new Map<number, { sales7d: number; sales30d: number }>();
    if (!recentOrders) return map;

    const now = Date.now();
    const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;

    recentOrders.forEach((order: Order) => {
      const paidTime = parseInt(order.paidAt);
      order.orderItems?.forEach((item: OrderItem) => {
        const current = map.get(item.vendorItemId) || { sales7d: 0, sales30d: 0 };
        const quantity = item.salesQuantity || 0;
        current.sales30d += quantity;
        if (paidTime >= sevenDaysAgo) {
          current.sales7d += quantity;
        }
        map.set(item.vendorItemId, current);
      });
    });

    return map;
  }, [recentOrders]);

  // Client-side filtering
  const filteredItems = useMemo(() => {
    if (!inventoryItems) return [];
    return inventoryItems.filter((item: InventoryItem) => {
      if (filters.productName && !item.sellerProductName.toLowerCase().includes(filters.productName.toLowerCase())) {
        return false;
      }
      if (filters.optionName && !item.vendorItemName.toLowerCase().includes(filters.optionName.toLowerCase())) {
        return false;
      }
      if (filters.stockStatus !== 'all') {
        const stockQty = item.stockAvailableQuantity || 0;
        if (filters.stockStatus === 'in_stock' && stockQty <= 0) return false;
        if (filters.stockStatus === 'out_of_stock' && stockQty > 0) return false;
      }
      return true;
    });
  }, [inventoryItems, filters]);

  const hasActiveFilters = filters.productName !== '' || filters.optionName !== '' || filters.stockStatus !== 'all';

  // Calculate stats
  const totalItems = inventoryItems?.length || 0;
  const inStockCount = useMemo(() => {
    if (!inventoryItems) return 0;
    return inventoryItems.filter(item => (item.stockAvailableQuantity || 0) > 0).length;
  }, [inventoryItems]);
  const outOfStockCount = totalItems - inStockCount;

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
        <Header onBack={() => navigate({ to: '/' })} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium mb-2">재고 정보를 불러올 수 없습니다</p>
            <p className="text-red-500 text-sm mb-4">{(error as Error).message}</p>
            <button
              onClick={() => refetch()}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
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
      <Header
        onBack={() => navigate({ to: '/' })}
        onRefresh={() => refetch()}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 옵션(SKU) 수</p>
            <p className="text-2xl font-bold text-blue-600">
              {hasActiveFilters ? `${filteredItems.length} / ${totalItems}` : totalItems}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">재고 있음</p>
            <p className="text-2xl font-bold text-green-600">{inStockCount}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">품절</p>
            <p className="text-2xl font-bold text-red-600">{outOfStockCount}</p>
          </div>
        </div>

        {/* Search Filters */}
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
            <span className="text-gray-400">{showFilters ? '\u25B2' : '\u25BC'}</span>
          </button>

          {showFilters && (
            <div className="px-6 pb-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* 상품명 */}
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

                {/* 옵션명 */}
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

                {/* 재고 상태 */}
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
                    검색 결과: <span className="font-semibold text-blue-600">{filteredItems.length}</span>건
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

        {/* Inventory Table */}
        {filteredItems.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              {hasActiveFilters ? '검색 조건에 맞는 재고가 없습니다' : '조회된 재고가 없습니다'}
            </p>
            {hasActiveFilters && (
              <button
                onClick={() => setFilters(initialFilters)}
                className="mt-3 px-4 py-2 text-sm text-blue-600 hover:text-blue-800"
              >
                필터 초기화
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">재고수량</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">판매량(7일)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">판매량(30일)</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">재고상태</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredItems.map((item: InventoryItem) => (
                    <InventoryItemRow
                      key={item.vendorItemId}
                      item={item}
                      sales={salesMap.get(item.vendorItemId)}
                    />
                  ))}
                </tbody>
              </table>
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
          <button
            onClick={onBack}
            className="text-blue-600 hover:text-blue-800 font-medium"
          >
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

function InventoryItemRow({
  item,
  sales
}: {
  item: InventoryItem;
  sales?: { sales7d: number; sales30d: number }
}) {
  const stockQty = item.stockAvailableQuantity || 0;
  const isInStock = stockQty > 0;

  return (
    <tr className="hover:bg-gray-50">
      {/* 상품명 */}
      <td className="px-4 py-3 text-sm text-gray-900">
        <div className="max-w-xs truncate">{item.sellerProductName || '-'}</div>
      </td>
      {/* 옵션 */}
      <td className="px-4 py-3 text-sm text-gray-700">
        <div className="max-w-xs truncate">{item.vendorItemName || '-'}</div>
      </td>
      {/* 재고수량 */}
      <td className="px-4 py-3 text-sm text-gray-900 text-center font-medium">
        {stockQty.toLocaleString()}
      </td>
      {/* 판매량(7일) */}
      <td className="px-4 py-3 text-sm text-gray-600 text-center">
        {sales?.sales7d || 0}
      </td>
      {/* 판매량(30일) */}
      <td className="px-4 py-3 text-sm text-gray-600 text-center">
        {sales?.sales30d || 0}
      </td>
      {/* 재고상태 */}
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
