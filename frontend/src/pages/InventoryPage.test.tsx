import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import InventoryPage from './InventoryPage';
import { apiClient } from '../lib/api';

const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

vi.mock('../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

const mockInventoryItems = [
  {
    vendorItemId: 1001,
    productName: '플라워 헤어핀',
    itemName: '5cm 핑크',
    statusName: '판매중',
    stockQuantity: 95,
    salesLast30Days: 10,
    isMapped: true,
    syncedAt: '2024-01-01T10:00:00Z',
  },
  {
    vendorItemId: 1002,
    productName: '플라워 헤어핀',
    itemName: '5cm 옐로우',
    statusName: '판매중',
    stockQuantity: 0,
    salesLast30Days: 5,
    isMapped: true,
    syncedAt: '2024-01-01T10:00:00Z',
  },
];

const mockApiResponse = {
  code: 'SUCCESS',
  data: mockInventoryItems,
  total: 2,
  page: 1,
  pageSize: 20,
  totalPages: 1,
  lastSyncedAt: '2024-01-01T10:00:00Z',
};

describe('InventoryPage', () => {
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

  it('TC022: shows loading state', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));

    renderWithQuery(<InventoryPage />);
    expect(screen.getByText('재고 정보를 불러오는 중...')).toBeInTheDocument();
  });

  it('TC023: displays inventory items', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockApiResponse });

    renderWithQuery(<InventoryPage />);

    await waitFor(() => {
      const productNames = screen.getAllByText('플라워 헤어핀');
      expect(productNames.length).toBeGreaterThan(0);
      expect(screen.getByText('5cm 핑크')).toBeInTheDocument();
      expect(screen.getByText('5cm 옐로우')).toBeInTheDocument();
    });
  });

  it('TC024: displays stock status correctly', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockApiResponse });

    renderWithQuery(<InventoryPage />);

    await waitFor(() => {
      const stockBadges = screen.getAllByText('재고 있음');
      expect(stockBadges.length).toBeGreaterThan(0);
      const outOfStockBadges = screen.getAllByText('품절');
      expect(outOfStockBadges.length).toBeGreaterThan(0);
    });
  });

  it('TC025: displays stats cards', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockApiResponse });

    renderWithQuery(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('총 옵션(SKU) 수')).toBeInTheDocument();
      const stockLabels = screen.getAllByText('재고 있음');
      expect(stockLabels.length).toBeGreaterThan(0);
      const outOfStockLabels = screen.getAllByText('품절');
      expect(outOfStockLabels.length).toBeGreaterThan(0);
    });
  });

  it('TC026: filters by stock status', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({ data: mockApiResponse });

    renderWithQuery(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('5cm 핑크')).toBeInTheDocument();
    });

    // Open filters
    const filterButton = screen.getByText('검색 조건');
    await user.click(filterButton);

    // Select out of stock filter
    const statusSelect = screen.getByRole('combobox');
    await user.selectOptions(statusSelect, 'out_of_stock');

    await waitFor(() => {
      expect(screen.getByText('5cm 옐로우')).toBeInTheDocument();
      expect(screen.queryByText('5cm 핑크')).not.toBeInTheDocument();
    });
  });

  it('TC027: shows error on API failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));

    renderWithQuery(<InventoryPage />);

    await waitFor(() => {
      expect(screen.getByText('재고 정보를 불러올 수 없습니다')).toBeInTheDocument();
    });
  });
});
