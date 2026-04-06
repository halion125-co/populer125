// UTC 시간 문자열을 KST yyyy-MM-dd HH:mm 형식으로 변환
export const formatKST = (t: string, fallback = '-'): string => {
  if (!t) return fallback;
  try {
    const kst = new Date(new Date(t).getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return t.slice(0, 16).replace('T', ' ');
  }
};
