import { useState, useContext, useEffect } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AuthContext } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

type Tab = 'basic' | 'coupang' | 'security';

const ProfilePage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  // Basic info form
  const [basicForm, setBasicForm] = useState({
    email: auth?.user?.email || '',
    phone: auth?.user?.phone || '',
  });

  // Coupang API form
  const [coupangForm, setCoupangForm] = useState({
    vendorId: auth?.user?.vendorId || '',
    accessKey: auth?.user?.accessKey || '',
    secretKey: '',
  });

  // Password form
  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (auth?.user) {
      setBasicForm({ email: auth.user.email, phone: auth.user.phone });
      setCoupangForm(f => ({ ...f, vendorId: auth.user!.vendorId, accessKey: auth.user!.accessKey }));
    }
  }, [auth?.user]);

  const showMsg = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  };

  const handleBasicSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/profile', {
        email: basicForm.email,
        phone: basicForm.phone,
        vendorId: coupangForm.vendorId,
        accessKey: coupangForm.accessKey,
        secretKey: '',
      });
      await auth?.refreshUser();
      showMsg('success', '기본 정보가 저장되었습니다.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      showMsg('error', axiosErr.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCoupangSave = async () => {
    setSaving(true);
    try {
      await apiClient.put('/api/profile', {
        email: basicForm.email,
        phone: basicForm.phone,
        vendorId: coupangForm.vendorId,
        accessKey: coupangForm.accessKey,
        secretKey: coupangForm.secretKey,
      });
      setCoupangForm(f => ({ ...f, secretKey: '' }));
      await auth?.refreshUser();
      showMsg('success', '쿠팡 API 정보가 저장되었습니다.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      showMsg('error', axiosErr.response?.data?.message || '저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handlePasswordSave = async () => {
    if (pwForm.newPassword !== pwForm.newPasswordConfirm) {
      showMsg('error', '새 비밀번호가 일치하지 않습니다.');
      return;
    }
    if (pwForm.newPassword.length < 6) {
      showMsg('error', '새 비밀번호는 6자 이상이어야 합니다.');
      return;
    }
    setSaving(true);
    try {
      await apiClient.put('/api/profile/password', {
        currentPassword: pwForm.currentPassword,
        newPassword: pwForm.newPassword,
      });
      setPwForm({ currentPassword: '', newPassword: '', newPasswordConfirm: '' });
      showMsg('success', '비밀번호가 변경되었습니다.');
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      showMsg('error', axiosErr.response?.data?.message || '비밀번호 변경에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const tabs: { key: Tab; label: string }[] = [
    { key: 'basic', label: '기본 정보' },
    { key: 'coupang', label: '쿠팡 API' },
    { key: 'security', label: '보안' },
  ];

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <header className="bg-white shadow">
        <div className="max-w-4xl mx-auto px-4 py-4 flex items-center gap-4">
          <button onClick={() => navigate({ to: '/' })} className="text-blue-600 hover:text-blue-800 font-medium">
            &larr; 뒤로
          </button>
          <h1 className="text-xl font-bold text-gray-800">개인정보 관리</h1>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {/* User summary */}
        <div className="bg-white rounded-lg shadow p-5 mb-6 flex items-center gap-4">
          <div className="w-14 h-14 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 text-xl font-bold">
            {auth?.user?.email?.[0]?.toUpperCase() || 'U'}
          </div>
          <div>
            <p className="font-semibold text-gray-800">{auth?.user?.email}</p>
            <p className="text-sm text-gray-500">
              가입일: {auth?.user?.createdAt ? new Date(auth.user.createdAt).toLocaleDateString('ko-KR') : '-'}
            </p>
          </div>
        </div>

        {/* Toast message */}
        {message && (
          <div className={`mb-4 p-3 rounded-md text-sm ${
            message.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-600'
          }`}>
            {message.text}
          </div>
        )}

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {/* Tab navigation */}
          <div className="border-b border-gray-200 flex">
            {tabs.map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-6 py-3 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="p-6">
            {/* 기본 정보 탭 */}
            {activeTab === 'basic' && (
              <div className="space-y-4 max-w-md">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">이메일</label>
                  <input
                    type="email"
                    value={basicForm.email}
                    onChange={e => setBasicForm({ ...basicForm, email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">전화번호</label>
                  <input
                    type="tel"
                    value={basicForm.phone}
                    onChange={e => setBasicForm({ ...basicForm, phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="010-0000-0000"
                  />
                </div>
                <button
                  onClick={handleBasicSave}
                  disabled={saving}
                  className="px-5 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 font-medium text-sm"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            )}

            {/* 쿠팡 API 탭 */}
            {activeTab === 'coupang' && (
              <div className="space-y-4 max-w-md">
                <p className="text-sm text-gray-500">
                  쿠팡 RocketGrowth API 접속 정보를 입력하세요.
                  쿠팡 판매자 포털에서 발급받을 수 있습니다.
                </p>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">업체코드 (Vendor ID)</label>
                  <input
                    type="text"
                    value={coupangForm.vendorId}
                    onChange={e => setCoupangForm({ ...coupangForm, vendorId: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="A01234567"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Access Key</label>
                  <input
                    type="text"
                    value={coupangForm.accessKey}
                    onChange={e => setCoupangForm({ ...coupangForm, accessKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Secret Key
                    {auth?.user?.hasSecret && (
                      <span className="ml-2 text-xs text-green-600 font-normal">✓ 설정됨</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={coupangForm.secretKey}
                    onChange={e => setCoupangForm({ ...coupangForm, secretKey: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder={auth?.user?.hasSecret ? '변경 시에만 입력 (미입력 시 유지)' : 'Secret Key 입력'}
                  />
                </div>
                <button
                  onClick={handleCoupangSave}
                  disabled={saving}
                  className="px-5 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 font-medium text-sm"
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            )}

            {/* 보안 탭 */}
            {activeTab === 'security' && (
              <div className="space-y-6 max-w-md">
                {/* 비밀번호 변경 */}
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-800">비밀번호 변경</h3>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">현재 비밀번호</label>
                    <input
                      type="password"
                      value={pwForm.currentPassword}
                      onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호</label>
                    <input
                      type="password"
                      value={pwForm.newPassword}
                      onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      placeholder="6자 이상"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={pwForm.newPasswordConfirm}
                      onChange={e => setPwForm({ ...pwForm, newPasswordConfirm: e.target.value })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <button
                    onClick={handlePasswordSave}
                    disabled={saving}
                    className="px-5 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:bg-gray-400 font-medium text-sm"
                  >
                    {saving ? '변경 중...' : '비밀번호 변경'}
                  </button>
                </div>

                {/* 이메일 인증 (추후 구현) */}
                <div className="border-t border-gray-100 pt-6">
                  <h3 className="font-medium text-gray-800 mb-2">이메일 인증으로 비밀번호 초기화</h3>
                  <p className="text-sm text-gray-500 mb-3">
                    등록된 이메일로 인증 코드를 발송하여 비밀번호를 초기화합니다.
                  </p>
                  <button
                    disabled
                    className="px-5 py-2 bg-gray-200 text-gray-400 rounded-md cursor-not-allowed font-medium text-sm"
                    title="추후 지원 예정"
                  >
                    인증 코드 발송 (준비 중)
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 로그아웃 */}
        <div className="mt-6 text-center">
          <button
            onClick={() => { auth?.logout(); navigate({ to: '/login' }); }}
            className="px-5 py-2 text-sm text-red-500 hover:text-red-700 border border-red-200 rounded-md hover:bg-red-50"
          >
            로그아웃
          </button>
        </div>
      </main>
    </div>
  );
};

export default ProfilePage;
