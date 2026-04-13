// KST 시간 문자열(+09:00)을 yyyy-MM-dd HH:mm 형식으로 변환
export const formatKST = (t: string, fallback = '-'): string => {
  if (!t) return fallback;
  try {
    return t.slice(0, 16).replace('T', ' ');
  } catch {
    return fallback;
  }
};
