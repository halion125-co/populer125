import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { AuthContext } from '../contexts/AuthContext';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';
import { formatKST } from '../lib/formatters';

interface SyncInfo {
  dataType: string;
  lastSyncedAt: string;
  recordCount: number;
}

interface SyncStatusResponse {
  code: string;
  data: { [key: string]: SyncInfo };
}

const DashboardPage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();

  const { data: syncStatus } = useQuery({
    queryKey: ['syncStatus'],
    queryFn: async () => {
      const res = await apiClient.get<SyncStatusResponse>('/api/coupang/sync/status');
      return res.data.data;
    },
  });

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">상품</h3>
            <p className="text-3xl font-bold text-blue-600">
              {syncStatus?.products?.recordCount ?? '-'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              최종 동기화: {formatKST(syncStatus?.products?.lastSyncedAt ?? '', '동기화 없음')}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">주문</h3>
            <p className="text-3xl font-bold text-green-600">
              {syncStatus?.orders?.recordCount ?? '-'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              최종 동기화: {formatKST(syncStatus?.orders?.lastSyncedAt ?? '', '동기화 없음')}
            </p>
          </div>
          <div className="bg-white p-6 rounded-lg shadow">
            <h3 className="text-lg font-semibold text-gray-700 mb-2">재고</h3>
            <p className="text-3xl font-bold text-orange-600">
              {syncStatus?.inventory?.recordCount ?? '-'}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              최종 동기화: {formatKST(syncStatus?.inventory?.lastSyncedAt ?? '', '동기화 없음')}
            </p>
          </div>
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
