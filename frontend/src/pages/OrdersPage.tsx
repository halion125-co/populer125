import { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList, type BarShapeProps } from 'recharts';
import { apiClient } from '../lib/api';
import { formatKST } from '../lib/formatters';
import type { Order, OrdersResponse } from '../types/order';
import Layout from '../components/Layout';

interface Filters {
  productNames: string[];
}

function ProductNameDropdown({
  options,
  selected,
  onChange,
}: {
  options: string[];
  selected: string[];
  onChange: (names: string[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const toggle = (name: string) => {
    if (selected.includes(name)) {
      onChange(selected.filter(n => n !== name));
    } else {
      onChange([...selected, name]);
    }
  };

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-left bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 flex items-center justify-between"
      >
        <span className={selected.length === 0 ? 'text-gray-400' : 'text-gray-800'}>
          {selected.length === 0
            ? '상품명 선택...'
            : selected.length === 1
            ? selected[0]
            : `${selected[0]} 외 ${selected.length - 1}개`}
        </span>
        <span className="text-gray-400 ml-2">{open ? '▲' : '▼'}</span>
      </button>
      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-md shadow-lg max-h-60 overflow-y-auto">
          {options.length === 0 ? (
            <div className="px-3 py-2 text-sm text-gray-400">상품 없음</div>
          ) : (
            options.map(name => (
              <label key={name} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer text-sm">
                <input
                  type="checkbox"
                  checked={selected.includes(name)}
                  onChange={() => toggle(name)}
                  className="accent-blue-500"
                />
                <span className="truncate">{name}</span>
              </label>
            ))
          )}
        </div>
      )}
    </div>
  );
}

const initialFilters: Filters = {
  productNames: [],
};

const toKSTDateString = (date: Date) => {
  const kst = new Date(date.getTime() + 9 * 60 * 60 * 1000);
  return kst.toISOString().slice(0, 10);
};

const getDefaultRange = () => {
  const now = new Date();
  const to = toKSTDateString(now);
  const from30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  return {
    from: toKSTDateString(from30),
    to,
  };
};

const OrdersPage = () => {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

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

  const handleFromChange = (value: string) => {
    // from이 to보다 늦으면 to를 from으로 당김
    const newTo = value > dateInput.to ? value : dateInput.to;
    setDateInput({ from: value, to: newTo });
  };

  const handleToChange = (value: string) => {
    // to가 from보다 빠르면 from을 to로 당김
    const newFrom = value < dateInput.from ? value : dateInput.from;
    setDateInput({ from: newFrom, to: value });
  };

  // Client-side filtering
  const filteredOrders = useMemo(() => {
    return orders.filter((o: Order) => {
      if (filters.productNames.length > 0) {
        const matched = (o.orderItems || []).some(item =>
          filters.productNames.includes(item.productName)
        );
        if (!matched) return false;
      }
      return true;
    }).sort((a, b) => b.paidAt.localeCompare(a.paidAt));
  }, [orders, filters]);

  const hasActiveFilters = filters.productNames.length > 0;

  // 판매된 상품명 목록 (드롭다운용)
  const productNameOptions = useMemo(() => {
    const set = new Set<string>();
    orders.forEach((o: Order) => {
      (o.orderItems || []).forEach(item => {
        if (item.productName) set.add(item.productName);
      });
    });
    return Array.from(set).sort();
  }, [orders]);

  // 그래프 뷰 모드 (일/시간)
  const [chartView, setChartView] = useState<'day' | 'hour'>('day');

  // 조회 기간 일수 계산
  const rangeDays = useMemo(() => {
    if (!searchRange.from || !searchRange.to) return 0;
    const diff = new Date(searchRange.to).getTime() - new Date(searchRange.from).getTime();
    return Math.round(diff / (24 * 60 * 60 * 1000)) + 1;
  }, [searchRange]);

  // 실제 사용되는 뷰 모드 (3일 초과 시 강제 일 단위)
  const effectiveChartView = rangeDays > 3 ? 'day' : chartView;

  // UTC paidAt → KST Date
  const toKSTDate = (utcStr: string) => new Date(new Date(utcStr).getTime() + 9 * 60 * 60 * 1000);

  // 그래프 데이터 집계
  const chartData = useMemo(() => {
    if (effectiveChartView === 'hour') {
      const isSingleDay = rangeDays === 1;
      // 현재 KST 시간
      const nowKST = toKSTDate(new Date().toISOString());
      const nowKSTHour = nowKST.getUTCHours();
      const nowKSTMin = nowKST.getUTCMinutes();
      const nowSlot = nowKSTHour * 2 + (nowKSTMin >= 30 ? 1 : 0);
      // 오늘 날짜(KST) 문자열
      const todayKST = nowKST.toISOString().slice(0, 10);

      if (isSingleDay) {
        // 하루 조회: 30분 단위 (00:00 ~ 현재 슬롯)
        const slots: { sales: number; count: number }[] = Array.from({ length: 48 }, () => ({ sales: 0, count: 0 }));
        filteredOrders.forEach((order) => {
          if (!order.paidAt) return;
          const kst = toKSTDate(order.paidAt);
          const slot = kst.getUTCHours() * 2 + (kst.getUTCMinutes() >= 30 ? 1 : 0);
          const sales = (order.orderItems || []).reduce(
            (s, item) => s + (item.salesPrice || 0) * (item.salesQuantity || 0), 0
          );
          const qty = (order.orderItems || []).reduce((s, item) => s + (item.salesQuantity || 0), 0);
          slots[slot].sales += sales;
          slots[slot].count += qty;
        });

        const isToday = searchRange.from?.slice(0, 10) === todayKST;
        const maxSlot = isToday ? nowSlot : 47;
        return Array.from({ length: maxSlot + 1 }, (_, i) => {
          const h = Math.floor(i / 2);
          const dateLabel = searchRange.from?.slice(0, 10) ?? '';
          const timeLabel = `${dateLabel} ${String(h).padStart(2, '0')}:${i % 2 === 0 ? '00' : '30'}`;
          return {
            label: i % 2 === 0 ? `${String(h).padStart(2, '0')}시` : '',
            sub: '',
            sales: slots[i].sales,
            count: slots[i].count,
            tooltipLabel: timeLabel,
          };
        });
      }

      // 2~3일 조회: 날짜별 24시간 슬롯
      const slots: Record<string, { sales: number; count: number }> = {};
      const datelist: string[] = [];
      if (searchRange.from && searchRange.to) {
        const cur = new Date(searchRange.from);
        const end = new Date(searchRange.to);
        while (cur <= end) {
          const dateKey = cur.toISOString().slice(0, 10);
          datelist.push(dateKey);
          for (let h = 0; h < 24; h++) {
            slots[`${dateKey}-${h}`] = { sales: 0, count: 0 };
          }
          cur.setDate(cur.getDate() + 1);
        }
      }

      let lastDataKey = '';
      filteredOrders.forEach((order) => {
        if (!order.paidAt) return;
        const kst = toKSTDate(order.paidAt);
        const dateKey = kst.toISOString().slice(0, 10);
        const hour = kst.getUTCHours();
        const key = `${dateKey}-${hour}`;
        if (key in slots) {
          const sales = (order.orderItems || []).reduce(
            (s, item) => s + (item.salesPrice || 0) * (item.salesQuantity || 0), 0
          );
          const qty = (order.orderItems || []).reduce((s, item) => s + (item.salesQuantity || 0), 0);
          slots[key].sales += sales;
          slots[key].count += qty;
          if (!lastDataKey || key > lastDataKey) lastDataKey = key;
        }
      });

      const lastDate = datelist[datelist.length - 1];
      const lastHour = lastDate === todayKST ? nowKSTHour : 23;

      const result: { label: string; sub: string; sales: number; count: number; tooltipLabel: string }[] = [];
      datelist.forEach((dateKey, di) => {
        const d = new Date(dateKey);
        const dateLabel = `${d.getUTCMonth() + 1}/${String(d.getUTCDate()).padStart(2, '0')}`;
        const maxHour = di === datelist.length - 1 ? lastHour : 23;
        for (let h = 0; h <= maxHour; h++) {
          result.push({
            label: `${String(h).padStart(2, '0')}시`,
            sub: h === 0 ? dateLabel : '',
            sales: slots[`${dateKey}-${h}`]?.sales ?? 0,
            count: slots[`${dateKey}-${h}`]?.count ?? 0,
            tooltipLabel: `${dateLabel} ${String(h).padStart(2, '0')}:00`,
          });
        }
      });
      return result;
    } else {
      // 일 단위: from~to 날짜 슬롯 생성
      const slots: Record<string, { sales: number; count: number }> = {};
      if (searchRange.from && searchRange.to) {
        const cur = new Date(searchRange.from);
        const end = new Date(searchRange.to);
        while (cur <= end) {
          slots[cur.toISOString().slice(0, 10)] = { sales: 0, count: 0 };
          cur.setDate(cur.getDate() + 1);
        }
      }
      filteredOrders.forEach((order) => {
        if (!order.paidAt) return;
        const kst = toKSTDate(order.paidAt);
        const key = kst.toISOString().slice(0, 10);
        if (key in slots) {
          const sales = (order.orderItems || []).reduce(
            (s, item) => s + (item.salesPrice || 0) * (item.salesQuantity || 0), 0
          );
          const qty = (order.orderItems || []).reduce((s, item) => s + (item.salesQuantity || 0), 0);
          slots[key].sales += sales;
          slots[key].count += qty;
        }
      });
      return Object.entries(slots).map(([date, { sales, count }]) => {
        const d = new Date(date);
        const days = ['일', '월', '화', '수', '목', '금', '토'];
        const line1 = `${d.getUTCMonth() + 1}/${String(d.getUTCDate()).padStart(2, '0')}`;
        const line2 = `(${days[d.getUTCDay()]})`;
        return { label: line1, sub: line2, sales, count, tooltipLabel: `${line1}${line2}` };
      });
    }
  }, [filteredOrders, effectiveChartView, searchRange]);

  // Y축 단위: 항상 만원 단위
  const chartYConfig = useMemo(() => {
    const maxSales = Math.max(...chartData.map((d) => d.sales), 0);
    const unit = 10000;
    const tickCount = Math.ceil(maxSales / unit) + 1;
    const ticks = Array.from({ length: tickCount }, (_, i) => i * unit);
    return { unit, unitLabel: '만원', divisor: 10000, ticks, maxSales };
  }, [chartData]);

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
      <Layout>
        <div className="flex items-center justify-center py-24">
          <div className="text-center">
            <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-600">주문 목록을 불러오는 중...</p>
          </div>
        </div>
      </Layout>
    );
  }

  if (error) {
    return (
      <Layout>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <p className="text-red-600 font-medium mb-2">주문 목록을 불러올 수 없습니다</p>
          <p className="text-red-500 text-sm mb-4">{(error as Error).message}</p>
          <button onClick={() => refetch()} className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600">
            다시 시도
          </button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-gray-800">주문 관리</h1>
          {lastSyncedAt && <span className="text-xs text-gray-400">마지막 동기화: {formatKST(lastSyncedAt)}</span>}
        </div>
        <div className="flex items-center gap-3">
          {!isMobile && <span className="text-xs text-gray-400">동기화 범위: {dateInput.from} ~ {dateInput.to}</span>}
          <button
            onClick={() => { setSyncMessage(null); syncMutation.mutate({ force: false }); }}
            disabled={syncMutation.isPending}
            className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm disabled:opacity-60 flex items-center gap-2"
          >
            {syncMutation.isPending && <span className="inline-block w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>}
            {syncMutation.isPending ? '동기화 중...' : '동기화'}
          </button>
        </div>
      </div>

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

      <div>
        {/* Date Range Selector */}
        <div className="mb-6 bg-white p-4 rounded-lg shadow">
          {/* 모바일 레이아웃 */}
          <div className="md:hidden">
            <div className="flex items-center gap-2 mb-3">
              <input
                type="date"
                value={dateInput.from}
                max={dateInput.to}
                onChange={(e) => handleFromChange(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400 text-sm">~</span>
              <input
                type="date"
                value={dateInput.to}
                min={dateInput.from}
                onChange={(e) => handleToChange(e.target.value)}
                className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 mb-3">
              <button onClick={() => { const today = toKSTDateString(new Date()); handleQuickRange(today, today); setChartView('hour'); }} className="py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-center">오늘</button>
              <button onClick={() => { const d = toKSTDateString(new Date(Date.now() - 24 * 60 * 60 * 1000)); handleQuickRange(d, d); setChartView('hour'); }} className="py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-center">어제</button>
              <button onClick={() => { const now = new Date(); handleQuickRange(toKSTDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), toKSTDateString(now)); setChartView('day'); }} className="py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-center">7일</button>
              <button onClick={() => { const now = new Date(); handleQuickRange(toKSTDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), toKSTDateString(now)); setChartView('day'); }} className="py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50 text-center">30일</button>
            </div>
            <button onClick={handleSearch} className="w-full px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 font-medium">검색</button>
          </div>

          {/* PC 레이아웃 */}
          <div className="hidden md:block">
            <div className="flex items-center gap-4 flex-wrap">
              <span className="text-sm font-medium text-gray-700">조회 기간</span>
              <input
                type="date"
                value={dateInput.from}
                max={dateInput.to}
                onChange={(e) => handleFromChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <span className="text-gray-400">~</span>
              <input
                type="date"
                value={dateInput.to}
                min={dateInput.from}
                onChange={(e) => handleToChange(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <div className="flex gap-2">
                <button onClick={() => { const today = toKSTDateString(new Date()); handleQuickRange(today, today); setChartView('hour'); }} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">오늘</button>
                <button onClick={() => { const d = toKSTDateString(new Date(Date.now() - 24 * 60 * 60 * 1000)); handleQuickRange(d, d); setChartView('hour'); }} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">어제</button>
                <button onClick={() => { const now = new Date(); handleQuickRange(toKSTDateString(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)), toKSTDateString(now)); setChartView('day'); }} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">최근 7일</button>
                <button onClick={() => { const now = new Date(); handleQuickRange(toKSTDateString(new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)), toKSTDateString(now)); setChartView('day'); }} className="px-3 py-2 text-sm border border-gray-300 rounded-md hover:bg-gray-50">최근 30일</button>
              </div>
              <button onClick={handleSearch} className="px-4 py-2 bg-blue-500 text-white rounded-md text-sm hover:bg-blue-600 font-medium">검색</button>
            </div>
          </div>

          {searchRange.from !== dateInput.from || searchRange.to !== dateInput.to ? (
            <p className="mt-2 text-xs text-orange-500">날짜가 변경되었습니다. 검색 버튼을 눌러 적용하세요.</p>
          ) : null}
          {!lastSyncedAt && (
            <p className="mt-2 text-xs text-orange-600">동기화된 데이터가 없습니다. "동기화" 버튼을 눌러 데이터를 가져오세요.</p>
          )}
        </div>

        {/* Stats */}
        <div className="mb-6 grid grid-cols-3 gap-2 md:gap-4">
          <div className="bg-white p-3 md:p-4 rounded-lg shadow">
            <p className="text-xs md:text-sm text-gray-500">총 주문</p>
            <p className="text-lg md:text-2xl font-bold text-blue-600">
              {hasActiveFilters ? `${filteredOrders.length}/${orders.length}` : orders.length}
            </p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-lg shadow">
            <p className="text-xs md:text-sm text-gray-500">판매수량</p>
            <p className="text-lg md:text-2xl font-bold text-green-600">{totalItems}개</p>
          </div>
          <div className="bg-white p-3 md:p-4 rounded-lg shadow">
            <p className="text-xs md:text-sm text-gray-500">판매금액</p>
            <p className="text-sm md:text-2xl font-bold text-orange-600 break-all">{totalSales.toLocaleString('ko-KR')}원</p>
          </div>
        </div>

        {/* Sales Chart */}
        <div className="mb-6 bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-gray-700">매출 현황 ({chartYConfig.unitLabel} 단위)</h2>
            <div className="flex rounded-md border border-gray-300 overflow-hidden text-xs">
              <button
                onClick={() => setChartView('day')}
                disabled={rangeDays > 3}
                className={`px-3 py-1.5 ${effectiveChartView === 'day' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'} ${rangeDays > 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >일</button>
              <button
                onClick={() => setChartView('hour')}
                disabled={rangeDays > 3}
                className={`px-3 py-1.5 border-l border-gray-300 ${effectiveChartView === 'hour' ? 'bg-blue-500 text-white' : 'bg-white text-gray-600 hover:bg-gray-50'} ${rangeDays > 3 ? 'opacity-50 cursor-not-allowed' : ''}`}
              >시간</button>
            </div>
          </div>
          {rangeDays > 3 && chartView === 'hour' && (
            <p className="text-xs text-orange-500 mb-2">조회 기간이 3일을 초과하여 일 단위로 표시됩니다.</p>
          )}
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={chartData} margin={{ top: 24, right: 8, left: 0, bottom: 30 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="label"
                interval={0}
                tick={(props) => {
                  const { x, y, payload, index } = props;
                  const sub = chartData[index]?.sub ?? '';
                  // 모바일 전용 간격 축소
                  if (isMobile) {
                    if (effectiveChartView === 'day') {
                      // 일 단위: 데이터 수에 따라 5일/10일 간격
                      const step = chartData.length > 20 ? 10 : chartData.length > 10 ? 5 : 1;
                      if (index % step !== 0) return <g />;
                    } else {
                      // 시간/30분 단위: 3시간(=6슬롯) 간격, label 없는 슬롯 제외
                      if (!payload.value) return <g />;
                      const labelHour = parseInt(payload.value, 10);
                      if (labelHour % 3 !== 0) return <g />;
                    }
                  }
                  return (
                    <g transform={`translate(${x},${y})`}>
                      <text x={0} y={0} dy={12} textAnchor="middle" fontSize={11} fill="#6b7280">{payload.value}</text>
                      {sub && <text x={0} y={0} dy={24} textAnchor="middle" fontSize={10} fill="#9ca3af">{sub}</text>}
                    </g>
                  );
                }}
              />
              <YAxis
                ticks={chartYConfig.ticks}
                tickFormatter={(v) => String(Math.round(v / chartYConfig.divisor))}
                tick={{ fontSize: 11 }}
                width={36}
              />
              <Tooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  if (!d.sales && !d.count) return null;
                  return (
                    <div className="bg-white border border-gray-200 rounded-lg shadow-lg px-3 py-2 text-sm">
                      <p className="font-semibold text-gray-700 mb-1">{d.tooltipLabel}</p>
                      <p className="text-gray-600">판매수량: <span className="font-medium text-blue-600">{(d.count ?? 0).toLocaleString('ko-KR')}개</span></p>
                      <p className="text-gray-600">판매금액: <span className="font-medium text-blue-600">{(d.sales ?? 0).toLocaleString('ko-KR')}원</span></p>
                    </div>
                  );
                }}
              />
              <Bar
                dataKey="sales"
                radius={[3, 3, 0, 0]}
                maxBarSize={48}
                shape={(props: BarShapeProps) => {
                  const { x, y, width, height } = props as BarShapeProps & { x: number; y: number; width: number; height: number };
                  const fill = '#3b82f6';
                  const r = 3;
                  return (
                    <path
                      d={`M${x},${y + height} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + width - r},${y} Q${x + width},${y} ${x + width},${y + r} L${x + width},${y + height} Z`}
                      fill={fill}
                    />
                  );
                }}
              >
                <LabelList
                  dataKey="sales"
                  position="top"
                  fontSize={10}
                  fill="#374151"
                  formatter={(v: unknown) => typeof v === 'number' && v > 0 ? `${(v / 10000).toFixed(1)}만` : ''}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
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
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-1">상품명</label>
                <ProductNameDropdown
                  options={productNameOptions}
                  selected={filters.productNames}
                  onChange={names => setFilters({ productNames: names })}
                />
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
          <>
            {/* PC 테이블 (md 이상) */}
            <div className="hidden md:block bg-white rounded-lg shadow overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">결제일</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">옵션ID</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">상품명</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">수량</th>
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

            {/* 모바일 카드 (md 미만) */}
            <div className="md:hidden space-y-3">
              {filteredOrders.map((order: Order) => (
                <OrderCard key={order.orderId} order={order} />
              ))}
            </div>
          </>
        )}
      </div>
    </Layout>
  );
};

const formatPrice = (price: number | undefined) => {
  if (price === undefined || price === null) return '-';
  return Math.floor(price).toLocaleString('ko-KR') + '원';
};

function OrderRow({ order }: { order: Order }) {
  const items = order.orderItems?.length > 0 ? order.orderItems : [{ vendorItemId: 0, productName: '-', salesQuantity: 0, unitPrice: 0, salesPrice: 0 }];
  const totalPrice = items.reduce((sum, item) => sum + ((item.salesPrice || 0) * (item.salesQuantity || 0)), 0);

  return (
    <>
      {items.map((item, idx) => (
        <tr key={`${order.orderId}-${item.vendorItemId}-${idx}`} className={idx === 0 ? 'hover:bg-gray-50' : 'hover:bg-gray-50 bg-gray-50/50'}>
          {idx === 0 && (
            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 align-top" rowSpan={items.length}>
              {formatKST(order.paidAt)}
            </td>
          )}
          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 font-mono">
            {item.vendorItemId || '-'}
          </td>
          <td className="px-6 py-3 text-sm text-gray-900">
            {item.productName || '-'}
          </td>
          <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-500 text-right">
            {item.salesQuantity || 0}
          </td>
          {idx === 0 && (
            <td className="px-6 py-3 whitespace-nowrap text-sm text-gray-900 font-medium text-right align-top" rowSpan={items.length}>
              {formatPrice(totalPrice)}
            </td>
          )}
        </tr>
      ))}
    </>
  );
}

function OrderCard({ order }: { order: Order }) {
  const items = order.orderItems?.length > 0 ? order.orderItems : [{ vendorItemId: 0, productName: '-', salesQuantity: 0, unitPrice: 0, salesPrice: 0 }];
  const totalPrice = items.reduce((sum, item) => sum + ((item.salesPrice || 0) * (item.salesQuantity || 0)), 0);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="text-xs text-gray-400 mb-2">{formatKST(order.paidAt)}</div>
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={`${order.orderId}-${item.vendorItemId}-${idx}`} className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <p className="text-sm text-gray-900 leading-snug">{item.productName || '-'}</p>
              <p className="text-xs text-gray-400 mt-0.5">옵션ID: {item.vendorItemId || '-'} · {item.salesQuantity || 0}개</p>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 pt-2 border-t border-gray-100 flex justify-end">
        <span className="text-sm font-semibold text-gray-800">{formatPrice(totalPrice)}</span>
      </div>
    </div>
  );
}

export default OrdersPage;
