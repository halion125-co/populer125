import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { apiClient } from '../lib/api';

const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [done, setDone] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      await apiClient.post('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
      setDone(true);
    } catch {
      setError('요청 처리 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-2xl font-bold text-blue-600 mb-2 text-center">비밀번호 찾기</h1>
        <p className="text-center text-gray-500 mb-8 text-sm">가입한 이메일로 임시 비밀번호를 발송합니다</p>

        {done ? (
          <div className="space-y-4">
            <div className="p-4 bg-green-50 border border-green-200 rounded-md text-green-700 text-sm text-center">
              임시 비밀번호를 발송했습니다.<br />
              이메일을 확인하고 로그인 후 비밀번호를 변경해주세요.
            </div>
            <button
              onClick={() => navigate({ to: '/login' })}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 font-medium"
            >
              로그인하러 가기
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="example@email.com"
                required
                autoFocus
              />
            </div>

            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md text-red-600 text-sm">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-2 px-4 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed font-medium"
            >
              {isLoading ? '발송 중...' : '임시 비밀번호 발송'}
            </button>
          </form>
        )}

        <div className="mt-6 text-center">
          <button
            onClick={() => navigate({ to: '/login' })}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            로그인으로 돌아가기
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForgotPasswordPage;
