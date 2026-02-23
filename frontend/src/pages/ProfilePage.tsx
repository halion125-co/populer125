import { useState, useContext, useEffect, useCallback } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { AuthContext } from '../contexts/AuthContext';
import { apiClient } from '../lib/api';

type Tab = 'basic' | 'coupang' | 'security';

declare global {
  interface Window {
    daum: {
      Postcode: new (options: {
        oncomplete: (data: DaumAddressData) => void;
      }) => { open: () => void };
    };
  }
}

interface DaumAddressData {
  zonecode: string;
  roadAddress: string;
  roadAddressEnglish: string;
  jibunAddress: string;
  buildingName: string;
  apartment: string;
}

const ProfilePage = () => {
  const auth = useContext(AuthContext);
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<Tab>('basic');

  const [basicForm, setBasicForm] = useState({
    email: auth?.user?.email || '',
    phone: auth?.user?.phone || '',
    nameKo: auth?.user?.nameKo || '',
    nameEn: auth?.user?.nameEn || '',
    zipcode: auth?.user?.zipcode || '',
    addressKo: auth?.user?.addressKo || '',
    addressDetailKo: auth?.user?.addressDetailKo || '',
    addressEn: auth?.user?.addressEn || '',
    addressDetailEn: auth?.user?.addressDetailEn || '',
    customsType: auth?.user?.customsType || 'personal',
    customsNumber: auth?.user?.customsNumber || '',
  });

  const [coupangForm, setCoupangForm] = useState({
    vendorId: auth?.user?.vendorId || '',
    accessKey: auth?.user?.accessKey || '',
    secretKey: '',
  });

  const [pwForm, setPwForm] = useState({
    currentPassword: '',
    newPassword: '',
    newPasswordConfirm: '',
  });

  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (auth?.user) {
      setBasicForm({
        email: auth.user.email,
        phone: auth.user.phone,
        nameKo: auth.user.nameKo || '',
        nameEn: auth.user.nameEn || '',
        zipcode: auth.user.zipcode || '',
        addressKo: auth.user.addressKo || '',
        addressDetailKo: auth.user.addressDetailKo || '',
        addressEn: auth.user.addressEn || '',
        addressDetailEn: auth.user.addressDetailEn || '',
        customsType: auth.user.customsType || 'personal',
        customsNumber: auth.user.customsNumber || '',
      });
      setCoupangForm(f => ({ ...f, vendorId: auth.user!.vendorId, accessKey: auth.user!.accessKey }));
    }
  }, [auth?.user]);

  // Load Daum Postcode script
  useEffect(() => {
    if (document.getElementById('daum-postcode-script')) return;
    const script = document.createElement('script');
    script.id = 'daum-postcode-script';
    script.src = 'https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js';
    script.async = true;
    document.head.appendChild(script);
  }, []);

  const handleAddressSearch = useCallback(() => {
    if (!window.daum?.Postcode) {
      alert('주소 검색 서비스를 불러오는 중입니다. 잠시 후 다시 시도해주세요.');
      return;
    }
    new window.daum.Postcode({
      oncomplete: (data: DaumAddressData) => {
        const roadAddr = data.roadAddress;
        const roadAddrEn = data.roadAddressEnglish;
        const building = data.buildingName && data.apartment === 'Y' ? ` (${data.buildingName})` : '';

        setBasicForm(f => ({
          ...f,
          zipcode: data.zonecode,
          addressKo: roadAddr + building,
          addressEn: roadAddrEn,
          addressDetailKo: '',
          addressDetailEn: '',
        }));
      },
    }).open();
  }, []);

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
        nameKo: basicForm.nameKo,
        nameEn: basicForm.nameEn,
        zipcode: basicForm.zipcode,
        addressKo: basicForm.addressKo,
        addressDetailKo: basicForm.addressDetailKo,
        addressEn: basicForm.addressEn,
        addressDetailEn: basicForm.addressDetailEn,
        customsType: basicForm.customsType,
        customsNumber: basicForm.customsNumber,
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
        nameKo: basicForm.nameKo,
        nameEn: basicForm.nameEn,
        zipcode: basicForm.zipcode,
        addressKo: basicForm.addressKo,
        addressDetailKo: basicForm.addressDetailKo,
        addressEn: basicForm.addressEn,
        addressDetailEn: basicForm.addressDetailEn,
        customsType: basicForm.customsType,
        customsNumber: basicForm.customsNumber,
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

  const inputClass = 'w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm';
  const labelClass = 'block text-sm font-medium text-gray-700 mb-1';

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
              <div className="space-y-5 max-w-lg">
                {/* 이름 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>이름 (한글)</label>
                    <input
                      type="text"
                      value={basicForm.nameKo}
                      onChange={e => setBasicForm({ ...basicForm, nameKo: e.target.value })}
                      className={inputClass}
                      placeholder="홍길동"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>이름 (영문)</label>
                    <input
                      type="text"
                      value={basicForm.nameEn}
                      onChange={e => setBasicForm({ ...basicForm, nameEn: e.target.value })}
                      className={inputClass}
                      placeholder="HONG GILDONG"
                    />
                  </div>
                </div>

                {/* 이메일 / 전화번호 */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className={labelClass}>이메일</label>
                    <input
                      type="email"
                      value={basicForm.email}
                      onChange={e => setBasicForm({ ...basicForm, email: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>휴대폰 번호</label>
                    <input
                      type="tel"
                      value={basicForm.phone}
                      onChange={e => setBasicForm({ ...basicForm, phone: e.target.value })}
                      className={inputClass}
                      placeholder="010-0000-0000"
                    />
                  </div>
                </div>

                {/* 주소 */}
                <div>
                  <label className={labelClass}>주소 (한글)</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      type="text"
                      value={basicForm.zipcode}
                      readOnly
                      className={`${inputClass} w-32 bg-gray-50 cursor-default`}
                      placeholder="우편번호"
                    />
                    <button
                      type="button"
                      onClick={handleAddressSearch}
                      className="px-4 py-2 bg-gray-600 text-white text-sm rounded-md hover:bg-gray-700 whitespace-nowrap"
                    >
                      주소 검색
                    </button>
                  </div>
                  <input
                    type="text"
                    value={basicForm.addressKo}
                    readOnly
                    className={`${inputClass} bg-gray-50 cursor-default mb-2`}
                    placeholder="도로명 주소"
                  />
                  <input
                    type="text"
                    value={basicForm.addressDetailKo}
                    onChange={e => setBasicForm({ ...basicForm, addressDetailKo: e.target.value })}
                    className={inputClass}
                    placeholder="상세주소 (동/호수 등)"
                  />
                </div>

                {/* 영문 주소 */}
                <div>
                  <label className={labelClass}>주소 (영문)</label>
                  <input
                    type="text"
                    value={basicForm.addressEn}
                    readOnly
                    className={`${inputClass} bg-gray-50 cursor-default mb-2`}
                    placeholder="영문 주소 (주소 검색 시 자동 입력)"
                  />
                  <input
                    type="text"
                    value={basicForm.addressDetailEn}
                    onChange={e => setBasicForm({ ...basicForm, addressDetailEn: e.target.value })}
                    className={inputClass}
                    placeholder="영문 상세주소"
                  />
                </div>

                {/* 통관 정보 */}
                <div>
                  <label className={labelClass}>통관구분</label>
                  <div className="flex gap-4 mb-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="customsType"
                        value="personal"
                        checked={basicForm.customsType === 'personal'}
                        onChange={() => setBasicForm({ ...basicForm, customsType: 'personal' })}
                        className="accent-blue-500"
                      />
                      <span className="text-sm text-gray-700">개인</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="customsType"
                        value="business"
                        checked={basicForm.customsType === 'business'}
                        onChange={() => setBasicForm({ ...basicForm, customsType: 'business' })}
                        className="accent-blue-500"
                      />
                      <span className="text-sm text-gray-700">사업자</span>
                    </label>
                  </div>
                  <div>
                    <label className={labelClass}>
                      {basicForm.customsType === 'personal' ? '개인통관번호' : '사업자번호'}
                    </label>
                    <input
                      type="text"
                      value={basicForm.customsNumber}
                      onChange={e => setBasicForm({ ...basicForm, customsNumber: e.target.value })}
                      className={inputClass}
                      placeholder={basicForm.customsType === 'personal' ? 'P로 시작하는 개인통관번호' : '사업자등록번호'}
                    />
                  </div>
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
                  <label className={labelClass}>업체코드 (Vendor ID)</label>
                  <input
                    type="text"
                    value={coupangForm.vendorId}
                    onChange={e => setCoupangForm({ ...coupangForm, vendorId: e.target.value })}
                    className={inputClass}
                    placeholder="A01234567"
                  />
                </div>
                <div>
                  <label className={labelClass}>Access Key</label>
                  <input
                    type="text"
                    value={coupangForm.accessKey}
                    onChange={e => setCoupangForm({ ...coupangForm, accessKey: e.target.value })}
                    className={inputClass}
                    placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                  />
                </div>
                <div>
                  <label className={labelClass}>
                    Secret Key
                    {auth?.user?.hasSecret && (
                      <span className="ml-2 text-xs text-green-600 font-normal">✓ 설정됨</span>
                    )}
                  </label>
                  <input
                    type="password"
                    value={coupangForm.secretKey}
                    onChange={e => setCoupangForm({ ...coupangForm, secretKey: e.target.value })}
                    className={inputClass}
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
                <div className="space-y-4">
                  <h3 className="font-medium text-gray-800">비밀번호 변경</h3>
                  <div>
                    <label className={labelClass}>현재 비밀번호</label>
                    <input
                      type="password"
                      value={pwForm.currentPassword}
                      onChange={e => setPwForm({ ...pwForm, currentPassword: e.target.value })}
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>새 비밀번호</label>
                    <input
                      type="password"
                      value={pwForm.newPassword}
                      onChange={e => setPwForm({ ...pwForm, newPassword: e.target.value })}
                      className={inputClass}
                      placeholder="6자 이상"
                    />
                  </div>
                  <div>
                    <label className={labelClass}>새 비밀번호 확인</label>
                    <input
                      type="password"
                      value={pwForm.newPasswordConfirm}
                      onChange={e => setPwForm({ ...pwForm, newPasswordConfirm: e.target.value })}
                      className={inputClass}
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
