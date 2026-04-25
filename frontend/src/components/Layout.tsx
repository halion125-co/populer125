import { useContext, type ReactNode } from 'react';
import { useNavigate, useLocation } from '@tanstack/react-router';
import { AuthContext } from '../contexts/AuthContext';

interface LayoutProps {
  children: ReactNode;
}

const NAV_ITEMS = [
  { to: '/orders',    label: '주문관리' },
  { to: '/products',  label: '상품관리' },
  { to: '/inventory', label: '재고관리' },
  { to: '/batch',     label: '배치관리' },
];

export default function Layout({ children }: LayoutProps) {
  const auth = useContext(AuthContext)!;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  const handleLogout = () => {
    auth.logout();
    navigate({ to: '/login' });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4">
          {/* 상단 바 */}
          <div className="flex items-center justify-between h-14">
            {/* 로고 */}
            <button
              onClick={() => navigate({ to: '/orders' })}
              className="text-lg font-bold text-blue-600 hover:text-blue-700 whitespace-nowrap"
            >
              RocketGrowth
            </button>

            {/* 네비게이션 메뉴 (데스크탑) */}
            <nav className="hidden md:flex items-center gap-1 flex-1 px-6">
              {NAV_ITEMS.map(({ to, label }) => (
                <button
                  key={to}
                  onClick={() => navigate({ to: to as any })}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    pathname === to
                      ? 'bg-blue-50 text-blue-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              ))}
              {auth.user?.isAdmin && (
                <button
                  onClick={() => navigate({ to: '/admin' })}
                  className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
                    pathname === '/admin'
                      ? 'bg-purple-50 text-purple-600'
                      : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  관리자
                </button>
              )}
            </nav>

            {/* 우측: 내 정보 + 로그아웃 */}
            <div className="flex items-center gap-2">
              <span className="hidden sm:block text-xs text-gray-400 max-w-[140px] truncate">
                {auth.user?.nameKo || auth.user?.email}
              </span>
              <button
                onClick={() => navigate({ to: '/profile' })}
                className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50 whitespace-nowrap"
              >
                내 정보
              </button>
              <button
                onClick={handleLogout}
                className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600 whitespace-nowrap"
              >
                로그아웃
              </button>
            </div>
          </div>

          {/* 모바일 네비게이션 */}
          <nav className="md:hidden flex items-center gap-1 pb-2 overflow-x-auto">
            {NAV_ITEMS.map(({ to, label }) => (
              <button
                key={to}
                onClick={() => navigate({ to: to as any })}
                className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  pathname === to
                    ? 'bg-blue-50 text-blue-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {label}
              </button>
            ))}
            {auth.user?.isAdmin && (
              <button
                onClick={() => navigate({ to: '/admin' })}
                className={`px-3 py-1 rounded text-xs font-medium whitespace-nowrap transition-colors ${
                  pathname === '/admin'
                    ? 'bg-purple-50 text-purple-600'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                관리자
              </button>
            )}
          </nav>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </main>
    </div>
  );
}
