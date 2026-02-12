import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from '@tanstack/react-router';

const DashboardPage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const handleLogout = () => {
    auth!.logout();
    navigate({ to: '/login' });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">RocketGrowth Console</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">Vendor: {auth!.user?.vendorId}</span>
            <button
              onClick={handleLogout}
              className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">
            환영합니다!
          </h2>
          <p className="text-gray-600">
            쿠팡 판매자 관리 시스템에 로그인되었습니다.
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">상품</h3>
            <p className="text-3xl font-bold text-blue-600">-</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">주문</h3>
            <p className="text-3xl font-bold text-green-600">-</p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">재고</h3>
            <p className="text-3xl font-bold text-orange-600">-</p>
          </div>
        </div>

        {/* Main Menu */}
        <div className="bg-white p-6 rounded-lg shadow">
          <h3 className="text-xl font-bold text-gray-800 mb-4">메인 메뉴</h3>
          <ul className="space-y-2">
            <li>
              <button
                onClick={() => navigate({ to: '/products' })}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                📦 상품 관리
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate({ to: '/orders' })}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                📋 주문 관리
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate({ to: '/inventory' })}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                📊 재고 관리
              </button>
            </li>
            <li>
              <button className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md">
                ⚙️ 설정
              </button>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
