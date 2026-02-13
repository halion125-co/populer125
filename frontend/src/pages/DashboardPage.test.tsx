import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import DashboardPage from './DashboardPage';
import { AuthContext } from '../contexts/AuthContext';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('@tanstack/react-router', () => ({
  useNavigate: () => mockNavigate,
}));

describe('DashboardPage', () => {
  const mockAuthContext = {
    user: { vendorId: 'A01407257', accessKey: 'test', secretKey: 'test' },
    token: 'mock-token',
    login: vi.fn(),
    logout: vi.fn(),
    isAuthenticated: true,
    isLoading: false,
  };

  it('TC001: renders dashboard title', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <DashboardPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText('RocketGrowth Console')).toBeInTheDocument();
  });

  it('TC002: displays vendor ID', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <DashboardPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText(/Vendor:/)).toBeInTheDocument();
    expect(screen.getByText(/A01407257/)).toBeInTheDocument();
  });

  it('TC003: displays welcome message', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <DashboardPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText('환영합니다!')).toBeInTheDocument();
  });

  it('TC004: displays all menu items', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <DashboardPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText('📦 상품 관리')).toBeInTheDocument();
    expect(screen.getByText('📋 주문 관리')).toBeInTheDocument();
    expect(screen.getByText('📊 재고 관리')).toBeInTheDocument();
    expect(screen.getByText('⚙️ 설정')).toBeInTheDocument();
  });

  it('TC005: displays stats cards', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <DashboardPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText('상품')).toBeInTheDocument();
    expect(screen.getByText('주문')).toBeInTheDocument();
    expect(screen.getByText('재고')).toBeInTheDocument();
  });

  it('TC006: logout button is present', () => {
    render(
      <AuthContext.Provider value={mockAuthContext}>
        <DashboardPage />
      </AuthContext.Provider>
    );

    expect(screen.getByText('로그아웃')).toBeInTheDocument();
  });
});
