import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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

const getDefaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
  };
};

const OrdersPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  // 날짜 입력 상태 (UI용 - 즉시 반응)
  const [dateInput, setDateInput] = useState(getDefaultRange);
  // 실제 검색에 사용되는 날짜 (검색 버튼 클릭 시 업데이트)
  const [searchRange, setSearchRange] = useState(getDefaultRange);
  // 동기화 결과 메시지
  const [syncMessage, setSyncMessage] = useState<{ type: 'info' | 'warning'; text: string } | null>(null);
  // 중복 확인 다이얼로그
  const [overlapDialog, setOverlapDialog] = useState<{
    overlapFrom: string;
    overlapTo: string;
    fromDate: string;
    toDate: string;
  } | null>(null);

  const { data: apiResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['orders', searchRange.from, searchRange.to],
    queryFn: async () => {
      const response = await apiClient.get<OrdersResponse>('/api/coupang/orders', {
        params: {
          createdAtFrom: searchRange.from,
          createdAtTo: searchRange.to + 'T23:59:59',
        },
      });
      return response.data;
    },
  });

  const orders = apiResponse?.data || [];
  const lastSyncedAt = apiResponse?.lastSyncedAt || '';

  const syncMutation = useMutation({
    mutationFn: ({ force }: { force: boolean }) =>
      apiClient.post(`/api/coupang/sync/orders?fromDate=${dateInput.from}&toDate=${dateInput.to}${force ? '&force=true' : ''}`),
    onSuccess: (res) => {
      const data = res.data as {
        code: string;
        overlapFrom?: string;
        overlapTo?: string;
        fromDate?: string;
        toDate?: string;
      };
      if (data.code === 'OVERLAP_DETECTED') {
        // 겹치는 구간 있음 → 확인 다이얼로그 표시
        setOverlapDialog({
          overlapFrom: data.overlapFrom!,
          overlapTo: data.overlapTo!,
          fromDate: data.fromDate!,
          toDate: data.toDate!,
        });
      } else {
        setSyncMessage(null);
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      }
    },
  });

  // 확인 다이얼로그 "확인" → 기존 데이터 삭제 후 재동기화
  const handleOverlapConfirm = () => {
    setOverlapDialog(null);
    syncMutation.mutate({ force: true });
  };

  // 확인 다이얼로그 "취소" → 겹치는 기간 제외하고 동기화
  // 겹침 제외 후 실제로 동기화할 범위가 없으면 메시지만 표시
  const handleOverlapCancel = () => {
    if (!overlapDialog) return;
    setOverlapDialog(null);

    const { overlapFrom, overlapTo, fromDate, toDate } = overlapDialog;
    // 겹치지 않는 구간 계산
    const newRanges: Array<{ from: string; to: string }> = [];
    if (fromDate < overlapFrom) newRanges.push({ from: fromDate, to: overlapFrom });
    if (toDate > overlapTo) newRanges.push({ from: overlapTo, to: toDate });

    if (newRanges.length === 0) {
      setSyncMessage({ type: 'warning', text: `${overlapFrom} ~ ${overlapTo} 기간은 이미 동기화되어 있어 동기화할 새로운 기간이 없습니다.` });
      return;
    }

    // 겹치지 않는 구간을 순서대로 동기화 (첫 번째 범위만 - 단순화)
    // 실제로는 대부분 한 쪽에만 새 구간이 생김
    const target = newRanges[0];
    apiClient.post(`/api/coupang/sync/orders?fromDate=${target.from}&toDate=${target.to}`)
      .then(() => {
        setSyncMessage({ type: 'info', text: `${overlapFrom} ~ ${overlapTo} 기간을 제외하고 ${target.from} ~ ${target.to} 기간만 동기화했습니다.` });
        queryClient.invalidateQueries({ queryKey: ['orders'] });
      });
  };

  const handleSearch = () => {
    setSearchRange({ ...dateInput });
  };

  const handleQuickRange = (from: string, to: string) => {
    setDateInput({ from, to });
    setSearchRange({ from, to });
  };

  // Client-side filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((o: Order) => {
      if (filters.orderId && !String(o.orderId).includes(filters.orderId)) return false;
      if (filters.productName) {
        const itemName = o.orderItems?.[0]?.productName || '';
        if (!itemName.toLowerCase().includes(filters.productName.toLowerCase())) return false;
      }
      return true;
    }).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }, [orders, filters]);

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  const totalSales = useMemo(() => {
    return filteredOrders.reduce((sum, order) => {
      if (!order.orderItems) return sum;
      return sum + order.orderItems.reduce((itemSum, item) => {
        return itemSum + ((item.salesPrice || 0) * (item.salesQuantity || 0));
      }, 0);
    }, 0);
  }, [filteredOrders]);

  const totalItems = useMemo(() => {
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
        <Header onBack={() => navigate({ to: '/' })} onSync={() => syncMutation.mutate({ force: false })} isSyncing={syncMutation.isPending} lastSyncedAt={lastSyncedAt} syncDateRange={dateInput} />
        <main className="max-w-7xl mx-auto px-4 py-8">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
            <p className="text-red-600 font-medium mb-2">주문 목록을 불러올 수 없습니다</p>
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
      <Header
        onBack={() => navigate({ to: '/' })}
        onSync={() => { setSyncMessage(null); syncMutation.mutate({ force: false }); }}
        isSyncing={syncMutation.isPending}
        lastSyncedAt={lastSyncedAt}
        syncDateRange={dateInput}
      />

      {/* 중복 기간 확인 다이얼로그 */}
      {overlapDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-800 mb-3">이미 동기화된 기간</h3>
            <p className="text-sm text-gray-600 mb-4">
              <span className="font-medium text-orange-600">{overlapDialog.overlapFrom} ~ {overlapDialog.overlapTo}</span> 기간은 이미 동기화되어 있습니다.
              <br />기존 데이터를 삭제하고 다시 동기화할까요?
            </p>
            <div className="text-xs text-gray-400 mb-5 bg-gray-50 rounded p-3 space-y-1">
              <div>확인: 기존 데이터 삭제 후 전체 기간 재동기화</div>
              <div>취소: 중복 기간 제외하고 새로운 기간만 동기화</div>
            </div>
            <div className="flex gap-3 justify-end">
              <button
                onClick={handleOverlapCancel}
                className="px-4 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                취소 (중복 제외)
              </button>
              <button
                onClick={handleOverlapConfirm}
                className="px-4 py-2 text-sm bg-red-500 text-white rounded-md hover:bg-red-600"
              >
                확인 (재동기화)
              </button>
            </div>
          </div>
        </div>
      )}

      {syncMutation.isError && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            동기화 실패: {(syncMutation.error as Error)?.message}
          </div>
        </div>
      )}

      {syncMessage && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className={`rounded-lg px-4 py-3 text-sm flex items-center justify-between ${
            syncMessage.type === 'warning'
              ? 'bg-yellow-50 border border-yellow-200 text-yellow-700'
              : 'bg-blue-50 border border-blue-200 text-blue-700'
          }`}>
            <span>{syncMessage.text}</span>
            <button onClick={() => setSyncMessage(null)} className="ml-4 text-gray-400 hover:text-gray-600">✕</button>
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Date Range Selector */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          <div className="flex items-center gap-4 flex-wrap">
            <span className="text-sm font-medium text-gray-700">조회 기간</span>
            <input
              type="date"
              value={dateInput.from}
              onChange={(e) => setDateInput({ ...dateInput, from: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-gray-400">~</span>
            <input
              type="date"
              value={dateInput.to}
              onChange={(e) => setDateInput({ ...dateInput, to: e.target.value })}
              className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => {
                  const today = new Date().toISOString().slice(0, 10);
                  handleQuickRange(today, today);
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                오늘
              </button>
              <button
                onClick={() => {
                  const yesterday = new Date();
                  yesterday.setDate(yesterday.getDate() - 1);
                  const d = yesterday.toISOString().slice(0, 10);
                  handleQuickRange(d, d);
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
                  handleQuickRange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
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
                  handleQuickRange(from.toISOString().slice(0, 10), to.toISOString().slice(0, 10));
                }}
                className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50"
              >
                최근 30일
              </button>
            </div>
            <button
              onClick={handleSearch}
              className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 font-medium"
            >
              검색
            </button>
          </div>
          {searchRange.from !== dateInput.from || searchRange.to !== dateInput.to ? (
            <p className="mt-2 text-xs text-orange-500">날짜가 변경되었습니다. 검색 버튼을 눌러 적용하세요.</p>
          ) : null}
          {!lastSyncedAt && (
            <p className="mt-2 text-xs text-orange-600">동기화된 데이터가 없습니다. "동기화" 버튼을 눌러 데이터를 가져오세요.</p>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 주문</p>
            <p className="text-2xl font-bold text-blue-600">
              {hasActiveFilters ? `${filteredOrders.length} / ${orders.length}` : orders.length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 판매수량</p>
            <p className="text-2xl font-bold text-green-600">{totalItems}개</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">총 판매금액</p>
            <p className="text-2xl font-bold text-orange-600">{totalSales.toLocaleString('ko-KR')}원</p>
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
                <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">필터 적용중</span>
              )}
            </span>
            <span className="text-gray-400">{showFilters ? '▲' : '▼'}</span>
          </button>

          {showFilters && (
            <div className="px-6 pb-4 border-t border-gray-100 pt-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
            {!lastSyncedAt && (
              <p className="text-gray-400 text-sm mt-2">먼저 동기화 버튼을 눌러 데이터를 가져오세요.</p>
            )}
            {hasActiveFilters && (
              <button onClick={() => setFilters(initialFilters)} className="mt-3 px-4 py-2 text-sm text-blue-600 hover:text-blue-800">
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제일</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">판매금액</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">총액</th>
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

function Header({
  onBack,
  onSync,
  isSyncing,
  lastSyncedAt,
  syncDateRange,
}: {
  onBack: () => void;
  onSync: () => void;
  isSyncing: boolean;
  lastSyncedAt: string;
  syncDateRange: { from: string; to: string };
}) {
  const formatSyncTime = (t: string) => {
    if (!t) return null;
    return t.replace('T', ' ').slice(0, 19);
  };

  return (
    <header className="bg-white shadow">
      <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-blue-600 hover:text-blue-800 font-medium">
            &larr; 뒤로
          </button>
          <h1 className="text-2xl font-bold text-gray-800">주문 관리</h1>
          {lastSyncedAt && (
            <span className="text-xs text-gray-400">마지막 동기화: {formatSyncTime(lastSyncedAt)}</span>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400">
            동기화 범위: {syncDateRange.from} ~ {syncDateRange.to}
          </span>
          <button
            onClick={onSync}
            disabled={isSyncing}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm disabled:opacity-60 flex items-center gap-2"
          >
            {isSyncing && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            {isSyncing ? '동기화 중...' : '동기화'}
          </button>
        </div>
      </div>
    </header>
  );
}

function OrderRow({ order }: { order: Order }) {
  const formatPrice = (price: number | undefined) => {
    if (price === undefined || price === null) return '-';
    return Math.floor(price).toLocaleString('ko-KR') + '원';
  };

  const firstItem = order.orderItems?.[0];
  const totalQuantity = order.orderItems?.reduce((sum, item) => sum + (item.salesQuantity || 0), 0) || 0;
  const totalPrice = order.orderItems?.reduce((sum, item) => {
    return sum + ((item.salesPrice || 0) * (item.salesQuantity || 0));
  }, 0) || 0;

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium">{order.orderId}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{order.paidAt || '-'}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 font-mono">{firstItem?.vendorItemId || '-'}</td>
      <td className="px-6 py-4">
        <div className="text-sm text-gray-900">{firstItem?.productName || '-'}</div>
        {order.orderItems.length > 1 && (
          <span className="text-xs text-gray-400">외 {order.orderItems.length - 1}건</span>
        )}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 text-right">{totalQuantity}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 text-right">{formatPrice(firstItem?.salesPrice)}</td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-medium text-right">{formatPrice(totalPrice)}</td>
    </tr>
  );
}

export default OrdersPage;
