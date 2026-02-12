import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import userEvent from '@testing-library/user-event';
import ProductsPage from './ProductsPage';
import { apiClient } from '../lib/api';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

// Mock API
vi.mock('../lib/api', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

const mockProducts = [
  {
    sellerProductId: 1,
    sellerProductName: '테스트 상품 1',
    statusName: '승인완료',
    brand: '테스트 브랜드',
    createdAt: '2024-01-01',
  },
  {
    sellerProductId: 2,
    sellerProductName: '테스트 상품 2',
    statusName: '승인대기',
    brand: '브랜드2',
    createdAt: '2024-01-02',
  },
];

describe('ProductsPage', () => {
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

  it('TC010: shows loading state initially', () => {
    vi.mocked(apiClient.get).mockImplementation(() => new Promise(() => {}));

    renderWithQuery(<ProductsPage />);
    expect(screen.getByText('상품 목록을 불러오는 중...')).toBeInTheDocument();
  });

  it('TC011: displays products when loaded', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: mockProducts },
    });

    renderWithQuery(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText('테스트 상품 1')).toBeInTheDocument();
      expect(screen.getByText('테스트 상품 2')).toBeInTheDocument();
    });
  });

  it('TC012: displays total product count', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: mockProducts },
    });

    renderWithQuery(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText('총 상품')).toBeInTheDocument();
      const elements = screen.getAllByText('2');
      expect(elements.length).toBeGreaterThan(0);
    });
  });

  it('TC013: filters products by name', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: mockProducts },
    });

    renderWithQuery(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText('테스트 상품 1')).toBeInTheDocument();
    });

    // Open filters
    const filterButton = screen.getByText('검색 조건');
    await user.click(filterButton);

    // Type in search
    const searchInput = screen.getByPlaceholderText('상품명 검색...');
    await user.type(searchInput, '상품 1');

    await waitFor(() => {
      expect(screen.getByText('테스트 상품 1')).toBeInTheDocument();
      expect(screen.queryByText('테스트 상품 2')).not.toBeInTheDocument();
    });
  });

  it('TC014: shows error message on API failure', async () => {
    vi.mocked(apiClient.get).mockRejectedValue(new Error('API Error'));

    renderWithQuery(<ProductsPage />);

    await waitFor(() => {
      expect(screen.getByText('상품 목록을 불러올 수 없습니다')).toBeInTheDocument();
    });
  });

  it('TC015: navigates back to dashboard', async () => {
    const user = userEvent.setup();
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { data: [] },
    });

    renderWithQuery(<ProductsPage />);

    // Wait for page to load first
    await waitFor(() => {
      expect(screen.getByText('← 뒤로')).toBeInTheDocument();
    });

    // Then click the button
    const backButton = screen.getByText('← 뒤로');
    await user.click(backButton);

    expect(mockNavigate).toHaveBeenCalledWith({ to: '/' });
  });
});
