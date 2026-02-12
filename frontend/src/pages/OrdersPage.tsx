import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import type { Order, OrdersResponse } from '../types/order';

interface Filters {
  orderId: string;
  productName: string;
}

const initialFilters: Filters = {
  orderId: '',
  productName: '',
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  // Date range state - default to last 7 days
  const [dateRange, setDateRange] = useState(() => {
    const to = new Date();
    const from = new Date();
    from.setDate(from.getDate() - 7);
    return {
      from: from.toISOString().slice(0, 10),
      to: to.toISOString().slice(0, 10),
    };
  });

  const { data: orders, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', dateRange.from, dateRange.to],
    queryFn: async () => {
      const response = await apiClient.get<OrdersResponse>('/api/coupang/orders', {
        params: {
          createdAtFrom: dateRange.from,
          createdAtTo: dateRange.to,
        },
      });
      return response.data.data || [];
    },
  });

  // Client-side filtering (including date range validation)
  const filteredOrders = useMemo(() => {
    if (!orders) return [];

    // Parse date range for filtering
    const fromDate = new Date(dateRange.from);
    fromDate.setHours(0, 0, 0, 0);
    const toDate = new Date(dateRange.to);
    toDate.setHours(23, 59, 59, 999);

    return orders.filter((o: Order) => {
      // Filter by date range (paidAt)
      if (o.paidAt) {
        const paidDate = new Date(parseInt(o.paidAt));
        if (paidDate < fromDate || paidDate > toDate) return false;
      }

      // Filter by orderId
      if (filters.orderId && !String(o.orderId).includes(filters.orderId)) return false;

      // Filter by productName
      if (filters.productName) {
        const itemName = o.orderItems?.[0]?.productName || '';
        if (!itemName.toLowerCase().includes(filters.productName.toLowerCase())) return false;
      }

      return true;
    });
  }, [orders, filters, dateRange]);

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  // Calculate total sales amount
  const totalSales = useMemo(() => {
    if (!filteredOrders || filteredOrders.length === 0) return 0;
    return filteredOrders.reduce((sum, order) => {
      if (!order.orderItems) return sum;
      const orderTotal = order.orderItems.reduce((itemSum, item) => {
        const price = item.salesPrice || item.unitSalesPrice || 0;
        return itemSum + (price * (item.salesQuantity || 0));
      }, 0);
      return sum + orderTotal;
    }, 0);
  }, [filteredOrders]);

  // Calculate total items
  const totalItems = useMemo(() => {
    if (!filteredOrders || filteredOrders.length === 0) return 0;
    return filteredOrders.reduce((sum, order) => {
      if (!order.orderItems) return sum;
      return sum + order.orderItems.reduce((itemSum, item) => itemSum + (item.salesQuantity || 0), 0);
    }, 0);
  }, [filteredOrders]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">주문 목록을 불러오는 중...</p>
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
            <p className="text-red-600 font-medium mb-2">주문 목록을 불러올 수 없습니다</p>
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

  const orderList = orders || [];

  return (
    <div className="min-h-screen bg-gray-100">
      <Header
        onBack={() => navigate({ to: '/' })}
        onRefresh={() => refetch()}
      />

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Range Selector */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700">조회 기간</span>
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  const today = new Date();
                  setDateRange({
                    from: today.toISOString().slice(0, 10),
                    to: today.toISOString().slice(0, 10)
                  });
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                오늘
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  setDateRange({
                    from: yesterday.toISOString().slice(0, 10),
                    to: yesterday.toISOString().slice(0, 10)
                  });
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                어제
              </button>
              <button
                onClick={() => {
                  const to = new Date();
                  const from = new Date();
                  from.setDate(from.getDate() - 7);
                  setDateRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                최근 7일
              </button>
              <button
                onClick={() => {
                  const to = new Date();
                  const from = new Date();
                  from.setDate(from.getDate() - 30);
                  setDateRange({ from: from.toISOString().slice(0, 10), to: to.toISOString().slice(0, 10) });
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                최근 30일
              </button>
            </div>
          </div>
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 주문</p>
            <p className="text-2xl font-bold text-blue-600">
              {hasActiveFilters ? `${filteredOrders.length} / ${orderList.length}` : orderList.length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 판매수량</p>
            <p className="text-2xl font-bold text-green-600">
              {totalItems}개
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 판매금액</p>
            <p className="text-2xl font-bold text-orange-600">
              {totalSales.toLocaleString('ko-KR')}원
            </p>
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 주문번호 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">주문번호</label>
                  <input
                    type="text"
                    value={filters.orderId}
                    onChange={e => setFilters({ ...filters, orderId: e.target.value })}
                    placeholder="주문번호 검색..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>

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
              </div>

              {hasActiveFilters && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    검색 결과: <span className="font-semibold text-blue-600">{filteredOrders.length}</span>건
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

        {/* Orders Table */}
        {filteredOrders.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              {hasActiveFilters ? '검색 조건에 맞는 주문이 없습니다' : '조회된 주문이 없습니다'}
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">주문번호</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제일시</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">판매금액</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">총액</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredOrders.map((order: Order) => (
                    <OrderRow key={order.orderId} order={order} />
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
          <h1 className="text-2xl font-bold text-gray-800">주문 관리</h1>
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

function OrderRow({ order }: { order: Order }) {
  const formatDateTime = (timestamp: string) => {
    if (!timestamp) return '-';
    try {
      const date = new Date(parseInt(timestamp));
      if (isNaN(date.getTime())) return '-';
      return date.toLocaleString('ko-KR');
    } catch {
      return '-';
    }
  };

  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null) return '-';
    return price.toLocaleString('ko-KR') + '원';
  };

  const firstItem = order.orderItems?.[0];
  const totalQuantity = order.orderItems?.reduce((sum, item) => sum + (item.salesQuantity || 0), 0) || 0;
  const totalPrice = order.orderItems?.reduce((sum, item) => {
    const price = item.salesPrice || item.unitSalesPrice || 0;
    return sum + (price * (item.salesQuantity || 0));
  }, 0) || 0;

  const firstItemPrice = firstItem ? (firstItem.salesPrice || firstItem.unitSalesPrice || 0) : 0;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
        {order.orderId}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDateTime(order.paidAt)}
      </td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900 max-w-xs truncate">
          {firstItem?.productName || '-'}
        </div>
        {order.orderItems.length > 1 && (
          <span className="text-xs text-gray-400">외 {order.orderItems.length - 1}건</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {totalQuantity}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
        {formatPrice(firstItemPrice)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">
        {formatPrice(totalPrice)}
      </td>
    </tr>
  );
}

export default OrdersPage;
