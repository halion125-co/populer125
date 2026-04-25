import { useContext } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { AuthContext } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

interface UserListItem {
  id: number;
  email: string;
  nameKo: string;
  phone: string;
  vendorId: string;
  createdAt: string;
}

const AdminPage = () => {
  const auth = useContext(AuthContext)!;
  const navigate = useNavigate();

  const { data, isLoading } = useQuery({
    queryKey: ['adminUsers'],
    queryFn: async () => {
      const res = await apiClient.get<{ users: UserListItem[] }>('/api/admin/users');
      return res.data.users;
    },
  });

  const handleImpersonate = async (userId: number) => {
    await auth.startImpersonation(userId);
    navigate({ to: '/' });
  };

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-purple-600">관리자 콘솔</h1>
          <button
            onClick={() => navigate({ to: '/' })}
            className="px-3 py-1.5 text-sm border border-gray-300 text-gray-700 rounded hover:bg-gray-50"
          >
            대시보드로
          </button>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-gray-800">사용자 목록</h2>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-gray-500">로딩 중...</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
                <tr>
                  <th className="px-6 py-3 text-left">ID</th>
                  <th className="px-6 py-3 text-left">이메일</th>
                  <th className="px-6 py-3 text-left">이름</th>
                  <th className="px-6 py-3 text-left">전화번호</th>
                  <th className="px-6 py-3 text-left">Vendor ID</th>
                  <th className="px-6 py-3 text-left">가입일</th>
                  <th className="px-6 py-3 text-left"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data?.map((u) => (
                  <tr key={u.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 text-gray-500">{u.id}</td>
                    <td className="px-6 py-4 font-medium text-gray-800">{u.email}</td>
                    <td className="px-6 py-4 text-gray-700">{u.nameKo || '-'}</td>
                    <td className="px-6 py-4 text-gray-600">{u.phone || '-'}</td>
                    <td className="px-6 py-4 text-gray-600 font-mono text-xs">{u.vendorId || '-'}</td>
                    <td className="px-6 py-4 text-gray-500">{u.createdAt ? u.createdAt.slice(0, 10) : '-'}</td>
                    <td className="px-6 py-4">
                      <button
                        onClick={() => handleImpersonate(u.id)}
                        className="px-3 py-1.5 text-xs bg-purple-600 text-white rounded hover:bg-purple-700 transition-colors"
                      >
                        전환
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </main>
    </div>
  );
};

export default AdminPage;
