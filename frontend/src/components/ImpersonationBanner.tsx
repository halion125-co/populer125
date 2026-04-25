import { useContext } from 'react';
import { AuthContext } from '../contexts/AuthContext';

export default function ImpersonationBanner() {
  const auth = useContext(AuthContext)!;

  if (!auth.impersonating) return null;

  return (
    <div className="bg-amber-500 text-white px-4 py-2 flex items-center justify-between text-sm font-medium z-50">
      <span>
        👤 <strong>{auth.user?.nameKo || auth.user?.email}</strong> 님으로 보는 중
      </span>
      <button
        onClick={auth.stopImpersonation}
        className="ml-4 px-3 py-1 bg-white text-amber-600 rounded text-xs font-semibold hover:bg-amber-50 transition-colors"
      >
        관리자로 돌아가기
      </button>
    </div>
  );
}
