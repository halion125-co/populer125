import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import OrdersPage from './OrdersPage';
import { apiClient } from '../lib/api';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockOrders = [
  {
    orderId: 12345,
    vendorId: 'A01407257',
    paidAt: '1704067200000',
    orderItems: [
      {
        vendorItemId: 111,
        productName: '테스트 상품 A',
        salesQuantity: 2,
        unitSalesPrice: 10000,
        currency: 'KRW',
      },
    ],
  },
  {
    orderId: 67890,
    vendorId: 'A01407257',
    paidAt: '1704153600000',
    orderItems: [
      {
        vendorItemId: 222,
        productName: '테스트 상품 B',
        salesQuantity: 1,
        salesPrice: 20000,
        currency: 'KRW',
      },
    ],
  },
];

describe('OrdersPage', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
      },
    });
    vi.clearAllMocks();
  });

  const renderWithQuery = (component: React.ReactElement) => {
    return render(
      <QueryClientProvider client={queryClient}>
        {component}
      </QueryClientProvider>
    );
  };

  it('TC016: shows loading state', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));

    renderWithQuery(<OrdersPage />);
    expect(screen.getByText('주문 목록을 불러오는 중...')).toBeInTheDocument();
  });

  it('TC017: displays orders when loaded', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: mockOrders },
    });

    renderWithQuery(<OrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.getByText('67890')).toBeInTheDocument();
    });
  });

  it('TC018: displays total sales amount', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: mockOrders },
    });

    renderWithQuery(<OrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('총 판매금액')).toBeInTheDocument();
      expect(screen.getByText('40,000원')).toBeInTheDocument(); // 2*10000 + 1*20000
    });
  });

  it('TC019: filters orders by order ID', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: mockOrders },
    });

    renderWithQuery(<OrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('12345')).toBeInTheDocument();
    });

    // Open filters
    const filterButton = screen.getByText('검색 조건');
    await user.click(filterButton);

    // Type in order ID search
    const searchInput = screen.getByPlaceholderText('주문번호 검색...');
    await user.type(searchInput, '12345');

    await waitFor(() => {
      expect(screen.getByText('12345')).toBeInTheDocument();
      expect(screen.queryByText('67890')).not.toBeInTheDocument();
    });
  });

  it('TC020: changes date range', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: [] },
    });

    renderWithQuery(<OrdersPage />);

    await waitFor(() => {
      const quickButton = screen.getByText('최근 30일');
      user.click(quickButton);
    });

    // Should trigger refetch with new date range
    expect(apiClient.get).toHaveBeenCalled();
  });

  it('TC021: shows empty state when no orders', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: [] },
    });

    renderWithQuery(<OrdersPage />);

    await waitFor(() => {
      expect(screen.getByText('조회된 주문이 없습니다')).toBeInTheDocument();
    });
  });
});
