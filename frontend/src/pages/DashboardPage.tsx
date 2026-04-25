import { useNavigate } from '@tanstack/react-router';
import Layout from '../components/Layout';

const DashboardPage = () => {
  const navigate = useNavigate();

  return (
    <Layout>
      <div>
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
                onClick={() => navigate({ to: '/profile' as any })}
                className="w-full text-left px-4 py-3 bg-gray-50 hover:bg-gray-100 rounded-md cursor-pointer"
              >
                👤 개인정보 관리
              </button>
            </li>
          </ul>
        </div>
      </div>
    </Layout>
  );
};

export default DashboardPage;
