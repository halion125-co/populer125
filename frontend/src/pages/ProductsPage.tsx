import { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import type { Product, ProductsResponse, ProductItem, ProductItemsResponse } from '../types/product';

interface Filters {
  productName: string;
  productId: string;
  brand: string;
  saleDateFrom: string;
  saleDateTo: string;
  createdFrom: string;
  createdTo: string;
}

const initialFilters: Filters = {
  productName: '',
  productId: '',
  brand: '',
  saleDateFrom: '',
  saleDateTo: '',
  createdFrom: '',
  createdTo: '',
};

const SELLING_STATUSES = ['판매중', '부분 판매중'];
const STOPPED_STATUSES = ['판매중지'];

const TABS = [
  { key: 'ALL', label: '전체' },
  { key: '판매중', label: '판매중' },
  { key: '판매중지', label: '판매중지' },
  { key: '기타', label: '기타' },
];

const ProductsPage = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [activeTab, setActiveTab] = useState('ALL');

  const { data: apiResponse, isLoading, error, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await apiClient.get<ProductsResponse>('/api/coupang/products');
      return response.data;
    },
  });

  const products = apiResponse?.data || [];
  const lastSyncedAt = apiResponse?.lastSyncedAt || '';

  const syncMutation = useMutation({
    mutationFn: () => apiClient.post('/api/coupang/sync/products'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      queryClient.invalidateQueries({ queryKey: ['product-items'] });
      queryClient.invalidateQueries({ queryKey: ['inventory'] });
    },
  });

  // 탭 + 검색 필터 적용
  const filteredProducts = useMemo(() => {
    return products.filter(p => {
      // 탭 필터
      if (activeTab === '판매중' && !SELLING_STATUSES.includes(p.statusName)) return false;
      if (activeTab === '판매중지' && !STOPPED_STATUSES.includes(p.statusName)) return false;
      if (activeTab === '기타' && (SELLING_STATUSES.includes(p.statusName) || STOPPED_STATUSES.includes(p.statusName))) return false;
      // 검색 필터
      if (filters.productName && !p.sellerProductName.toLowerCase().includes(filters.productName.toLowerCase())) return false;
      if (filters.productId && !String(p.sellerProductId).includes(filters.productId)) return false;
      if (filters.brand && !p.brand?.toLowerCase().includes(filters.brand.toLowerCase())) return false;
      if (filters.saleDateFrom && p.saleStartedAt && p.saleStartedAt.slice(0, 10) < filters.saleDateFrom) return false;
      if (filters.saleDateTo && p.saleEndedAt && p.saleEndedAt.slice(0, 10) > filters.saleDateTo) return false;
      if (filters.createdFrom && p.syncedAt && p.syncedAt.slice(0, 10) < filters.createdFrom) return false;
      if (filters.createdTo && p.syncedAt && p.syncedAt.slice(0, 10) > filters.createdTo) return false;
      return true;
    });
  }, [products, filters, activeTab]);

  // 탭별 개수
  const tabCounts = useMemo(() => ({
    ALL: products.length,
    '판매중': products.filter(p => SELLING_STATUSES.includes(p.statusName)).length,
    '판매중지': products.filter(p => STOPPED_STATUSES.includes(p.statusName)).length,
    '기타': products.filter(p => !SELLING_STATUSES.includes(p.statusName) && !STOPPED_STATUSES.includes(p.statusName)).length,
  }), [products]);

  const hasActiveFilters = Object.values(filters).some(v => v !== '');

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4"></div>
          <p className="text-gray-600">상품 목록을 불러오는 중...</p>
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
            <p className="text-red-600 font-medium mb-2">상품 목록을 불러올 수 없습니다</p>
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
        onSync={() => syncMutation.mutate()}
        isSyncing={syncMutation.isPending}
        lastSyncedAt={lastSyncedAt}
      />

      {syncMutation.isError && (
        <div className="max-w-7xl mx-auto px-4 pt-4">
          <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-600">
            동기화 실패: {(syncMutation.error as Error)?.message}
          </div>
        </div>
      )}

      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Stats */}
        <div className="mb-4 grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-xs text-gray-500">전체 상품</p>
            <p className="text-2xl font-bold text-blue-600">{products.length}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-xs text-gray-500">판매중</p>
            <p className="text-2xl font-bold text-green-600">{tabCounts['판매중']}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-xs text-gray-500">판매중지</p>
            <p className="text-2xl font-bold text-red-500">{tabCounts['판매중지']}</p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-xs text-gray-500">기타</p>
            <p className="text-2xl font-bold text-gray-500">{tabCounts['기타']}</p>
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
                  <label className="block text-sm font-medium text-gray-600 mb-1">상품 ID</label>
                  <input
                    type="text"
                    value={filters.productId}
                    onChange={e => setFilters({ ...filters, productId: e.target.value })}
                    placeholder="상품 ID 검색..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">브랜드</label>
                  <input
                    type="text"
                    value={filters.brand}
                    onChange={e => setFilters({ ...filters, brand: e.target.value })}
                    placeholder="브랜드 검색..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">판매기간</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={filters.saleDateFrom}
                      onChange={e => setFilters({ ...filters, saleDateFrom: e.target.value })}
                      className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                      type="date"
                      value={filters.saleDateTo}
                      onChange={e => setFilters({ ...filters, saleDateTo: e.target.value })}
                      className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">동기화일</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="date"
                      value={filters.createdFrom}
                      onChange={e => setFilters({ ...filters, createdFrom: e.target.value })}
                      className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <span className="text-gray-400">~</span>
                    <input
                      type="date"
                      value={filters.createdTo}
                      onChange={e => setFilters({ ...filters, createdTo: e.target.value })}
                      className="flex-1 px-2 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>
              {hasActiveFilters && (
                <div className="mt-4 flex items-center justify-between">
                  <p className="text-sm text-gray-500">
                    검색 결과: <span className="font-semibold text-blue-600">{filteredProducts.length}</span>건
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

        {/* 상태 탭 */}
        <div className="mb-4 flex gap-1 border-b border-gray-200">
          {TABS.map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium rounded-t-md transition-colors ${
                activeTab === tab.key
                  ? 'bg-white border border-b-white border-gray-200 text-blue-600 -mb-px'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
              <span className={`ml-1.5 px-1.5 py-0.5 text-xs rounded-full ${
                activeTab === tab.key ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'
              }`}>
                {tabCounts[tab.key as keyof typeof tabCounts]}
              </span>
            </button>
          ))}
        </div>

        {/* Products Table */}
        {filteredProducts.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <p className="text-gray-500 text-lg">
              {hasActiveFilters ? '검색 조건에 맞는 상품이 없습니다' : '등록된 상품이 없습니다'}
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
            <p className="px-6 py-2 text-xs text-gray-400 border-b border-gray-100">
              상품명을 클릭하면 옵션 상세 정보를 볼 수 있습니다.
            </p>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상품명
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      옵션
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      상품 ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      브랜드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      판매기간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      동기화일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <ProductRow
                      key={product.sellerProductId}
                      product={product}
                      isSelected={selectedProduct?.sellerProductId === product.sellerProductId}
                      onClick={() => setSelectedProduct(
                        selectedProduct?.sellerProductId === product.sellerProductId ? null : product
                      )}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* 옵션 슬라이드 패널 */}
      {selectedProduct && (
        <ProductItemsPanel
          product={selectedProduct}
          onClose={() => setSelectedProduct(null)}
        />
      )}
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
          <h1 className="text-2xl font-bold text-gray-800">상품 관리</h1>
          {lastSyncedAt && (
            <span className="text-xs text-gray-400">마지막 동기화: {formatSyncTime(lastSyncedAt)}</span>
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

function ProductRow({
  product,
  isSelected,
  onClick,
}: {
  product: Product;
  isSelected: boolean;
  onClick: () => void;
}) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  return (
    <tr
      className={`hover:bg-blue-50 cursor-pointer transition-colors ${isSelected ? 'bg-blue-50 border-l-4 border-blue-500' : ''}`}
      onClick={onClick}
    >
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-blue-700 max-w-xs truncate">
          {product.sellerProductName}
        </div>
      </td>
      <td className="px-4 py-4 text-center whitespace-nowrap">
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold ${
          product.itemCount > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-400'
        }`}>
          {product.itemCount}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <span className="text-sm text-gray-500 font-mono">
          {product.sellerProductId}
        </span>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {product.brand || '-'}
      </td>
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge status={product.statusName} />
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(product.saleStartedAt)} ~ {formatDate(product.saleEndedAt)}
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {formatDate(product.syncedAt)}
      </td>
    </tr>
  );
}

function ProductItemsPanel({
  product,
  onClose,
}: {
  product: Product;
  onClose: () => void;
}) {
  const { data, isLoading, error } = useQuery({
    queryKey: ['product-items', product.sellerProductId],
    queryFn: async () => {
      const response = await apiClient.get<ProductItemsResponse>(
        `/api/coupang/products/${product.sellerProductId}/items`
      );
      return response.data;
    },
  });

  return (
    <>
      {/* 배경 오버레이 */}
      <div
        className="fixed inset-0 bg-black bg-opacity-30 z-40"
        onClick={onClose}
      />

      {/* 슬라이드 패널 */}
      <div className="fixed right-0 top-0 h-full w-full max-w-2xl bg-white shadow-2xl z-50 flex flex-col">
        {/* 패널 헤더 */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-start justify-between bg-gray-50">
          <div className="flex-1 min-w-0 pr-4">
            <p className="text-xs text-gray-500 mb-1">상품 ID: {product.sellerProductId}</p>
            <h2 className="text-base font-bold text-gray-900 leading-tight">
              {product.sellerProductName}
            </h2>
            <div className="flex items-center gap-2 mt-1">
              <StatusBadge status={product.statusName} />
              {product.brand && (
                <span className="text-xs text-gray-500">{product.brand}</span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none flex-shrink-0"
          >
            &times;
          </button>
        </div>

        {/* 패널 콘텐츠 */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading && (
            <div className="flex items-center justify-center h-32">
              <div className="inline-block w-6 h-6 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mr-3"></div>
              <span className="text-gray-500 text-sm">옵션 정보를 불러오는 중...</span>
            </div>
          )}

          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-center">
              <p className="text-red-600 text-sm">옵션 정보를 불러올 수 없습니다.</p>
            </div>
          )}

          {data && (
            <>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-700">
                  옵션 목록
                  <span className="ml-2 px-2 py-0.5 bg-blue-100 text-blue-700 text-xs rounded-full">
                    {data.items?.length ?? 0}개
                  </span>
                </h3>
                <p className="text-xs text-gray-400">로켓그로스 재고 현황 기준</p>
              </div>

              {(!data.items || data.items.length === 0) ? (
                <div className="text-center py-8 text-gray-400 text-sm">
                  <p>등록된 옵션이 없습니다.</p>
                  <p className="mt-1 text-xs">재고 동기화 후 다시 확인해주세요.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {data.items.map((item: ProductItem) => (
                    <div
                      key={item.vendorItemId}
                      className="border border-gray-200 rounded-lg p-4 hover:border-blue-300 transition-colors"
                    >
                      <div className="flex items-start justify-between mb-2">
                        <p className="text-sm font-medium text-gray-900 flex-1 min-w-0 truncate">
                          {item.itemName || '-'}
                        </p>
                        <ItemStatusBadge status={item.statusName} />
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-xs mt-2">
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-gray-400 mb-0.5">옵션 ID</p>
                          <p className="font-mono font-medium text-gray-700">{item.vendorItemId}</p>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-gray-400 mb-0.5">재고</p>
                          <p className={`font-semibold ${item.stockQuantity === 0 ? 'text-red-500' : 'text-green-600'}`}>
                            {item.stockQuantity}개
                          </p>
                        </div>
                        <div className="bg-gray-50 rounded p-2">
                          <p className="text-gray-400 mb-0.5">30일 판매</p>
                          <p className="font-semibold text-blue-600">{item.salesLast30Days}개</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    '판매중': 'bg-green-100 text-green-800',
    '부분 판매중': 'bg-blue-100 text-blue-800',
    '판매중지': 'bg-red-100 text-red-800',
    '승인완료': 'bg-green-100 text-green-800',
    '승인반려': 'bg-yellow-100 text-yellow-800',
    '삭제': 'bg-gray-100 text-gray-800',
  };
  const style = styles[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${style}`}>
      {status}
    </span>
  );
}

function ItemStatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    'ACTIVE': 'bg-green-100 text-green-700',
    'INACTIVE': 'bg-gray-100 text-gray-600',
    'SUSPENDED': 'bg-red-100 text-red-700',
  };
  const style = styles[status] || 'bg-gray-100 text-gray-600';
  return (
    <span className={`inline-flex px-2 py-0.5 text-xs font-medium rounded-full flex-shrink-0 ml-2 ${style}`}>
      {status || '-'}
    </span>
  );
}

export default ProductsPage;
