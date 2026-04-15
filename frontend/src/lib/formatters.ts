// UTC 시간 문자열을 KST yyyy-MM-dd HH:mm 형식으로 변환
export const formatKST = (t: string, fallback = '-'): string => {
  if (!t) return fallback;
  try {
    // SQLite CURRENT_TIMESTAMP 형식 ("2026-04-15 02:37:00") → ISO 8601 UTC로 정규화
    const normalized = t.includes('T') ? t : t.replace(' ', 'T') + 'Z';
    const kst = new Date(new Date(normalized).getTime() + 9 * 60 * 60 * 1000);
    return kst.toISOString().slice(0, 16).replace('T', ' ');
  } catch {
    return fallback;
  }
};
