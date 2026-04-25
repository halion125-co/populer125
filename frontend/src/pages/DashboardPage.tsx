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
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-blue-600">RocketGrowth Console</h1>
          <div className="flex items-center gap-3">
            <span className="text-gray-600 text-sm">{auth!.user?.email}</span>
            {auth!.user?.isAdmin && (
              <button
                onClick={() => navigate({ to: '/admin' })}
                className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded hover:bg-purple-700"
              >
                관리자
              </button>
            )}
            <button
              onClick={() => navigate({ to: '/profile' })}
              className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
            >
              내 정보
            </button>
            <button
              onClick={handleLogout}
              className="px-3 py-1.5 text-sm bg-red-500 text-white rounded hover:bg-red-600"
            >
              로그아웃
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-800 mb-2">환영합니다!</h2>
          <p className="text-gray-600">쿠팡 판매자 관리 시스템에 로그인되었습니다.</p>
        </div>


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
              <button
                onClick={() => navigate({ to: '/batch' })}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                ⚙️ 배치 관리
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate({ to: '/fcm-monitor' })}
                className="w-full text-left px-4 py-3 bg-orange-50 hover:bg-orange-100 rounded-md cursor-pointer"
              >
                🔔 FCM 푸시 모니터링
              </button>
            </li>
            <li>
              <button
                onClick={() => navigate({ to: '/profile' })}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                👤 개인정보 관리
              </button>
            </li>
          </ul>
        </div>
      </main>
    </div>
  );
};

export default DashboardPage;
