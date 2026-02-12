import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import type { Product, ProductsResponse } from '../types/product';

interface Filters {
  productName: string;
  productId: string;
  brand: string;
  status: string;
  saleDateFrom: string;
  saleDateTo: string;
  createdFrom: string;
  createdTo: string;
}

const initialFilters: Filters = {
  productName: '',
  productId: '',
  brand: '',
  status: '',
  saleDateFrom: '',
  saleDateTo: '',
  createdFrom: '',
  createdTo: '',
};

const ProductsPage = () => {
  const navigate = useNavigate();
  const [filters, setFilters] = useState<Filters>(initialFilters);
  const [showFilters, setShowFilters] = useState(false);

  const { data: products, isLoading, error, refetch } = useQuery({
    queryKey: ['products'],
    queryFn: async () => {
      const response = await apiClient.get<ProductsResponse>('/api/coupang/products');
      return response.data.data || [];
    },
  });

  const statusOptions = useMemo(() => {
    if (!products) return [];
    const statuses = new Set(products.map(p => p.statusName));
    return Array.from(statuses).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!products) return [];
    return products.filter(p => {
      if (filters.productName && !p.sellerProductName.toLowerCase().includes(filters.productName.toLowerCase())) return false;
      if (filters.productId && !String(p.sellerProductId).includes(filters.productId)) return false;
      if (filters.brand && !p.brand?.toLowerCase().includes(filters.brand.toLowerCase())) return false;
      if (filters.status && p.statusName !== filters.status) return false;
      if (filters.saleDateFrom && p.saleStartedAt && p.saleStartedAt.slice(0, 10) < filters.saleDateFrom) return false;
      if (filters.saleDateTo && p.saleEndedAt && p.saleEndedAt.slice(0, 10) > filters.saleDateTo) return false;
      if (filters.createdFrom && p.createdAt && p.createdAt.slice(0, 10) < filters.createdFrom) return false;
      if (filters.createdTo && p.createdAt && p.createdAt.slice(0, 10) > filters.createdTo) return false;
      return true;
    });
  }, [products, filters]);

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
        <Header onBack={() => navigate({ to: '/' })} />
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

  const productList = products || [];

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
            <p className="text-sm text-gray-500">총 상품</p>
            <p className="text-2xl font-bold text-blue-600">
              {hasActiveFilters ? `${filteredProducts.length} / ${productList.length}` : productList.length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">판매중</p>
            <p className="text-2xl font-bold text-green-600">
              {filteredProducts.filter(p => p.statusName === '승인완료').length}
            </p>
          </div>
          <div className="bg-white p-4 rounded-lg shadow">
            <p className="text-sm text-gray-500">기타</p>
            <p className="text-2xl font-bold text-gray-600">
              {filteredProducts.filter(p => p.statusName !== '승인완료').length}
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

                {/* 상품 ID */}
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

                {/* 브랜드 */}
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

                {/* 상태 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">상태</label>
                  <select
                    value={filters.status}
                    onChange={e => setFilters({ ...filters, status: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">전체</option>
                    {statusOptions.map(s => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>

                {/* 판매기간 */}
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

                {/* 등록일 */}
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">등록일</label>
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

              {/* 초기화 버튼 */}
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
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상품명
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상품 ID
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      브랜드
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      상태
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      판매기간
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      등록일
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredProducts.map((product) => (
                    <ProductRow key={product.sellerProductId} product={product} />
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
          <h1 className="text-2xl font-bold text-gray-800">상품 관리</h1>
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

function ProductRow({ product }: { product: Product }) {
  const formatDate = (dateStr: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-6 py-4">
        <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
          {product.sellerProductName}
        </div>
      </td>
      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
        {product.sellerProductId}
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
        {formatDate(product.createdAt)}
      </td>
    </tr>
  );
}

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    '승인완료': 'bg-green-100 text-green-800',
    '판매중지': 'bg-red-100 text-red-800',
    '삭제': 'bg-gray-100 text-gray-800',
    '반려': 'bg-yellow-100 text-yellow-800',
  };

  const style = styles[status] || 'bg-gray-100 text-gray-600';

  return (
    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${style}`}>
      {status}
    </span>
  );
}

export default ProductsPage;
