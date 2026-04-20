import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  TouchableOpacity, RefreshControl, ActivityIndicator, ListRenderItem
} from 'react-native';
import dayjs from 'dayjs';
import { useNavigation } from '@react-navigation/native';
import { getNotificationHistory, NotificationHistoryItem } from '../../api/notifications';

export default function NotificationHistoryScreen() {
  const navigation = useNavigation<any>();
  const [items, setItems] = useState<NotificationHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = async (reset = false) => {
    const currentPage = reset ? 1 : page;
    try {
      const data = await getNotificationHistory(currentPage, 20);
      const newItems = data.items;
      if (reset) {
        setItems(newItems);
        setPage(2);
      } else {
        setItems((prev) => [...prev, ...newItems]);
        setPage((p) => p + 1);
      }
      setHasMore(newItems.length === 20);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => { load(true); }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMore || loadingMore) return;
    setLoadingMore(true);
    load();
  }, [hasMore, loadingMore, page]);

  const formatAmount = (n: number) =>
    n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FF6000" /></View>;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => String(i.id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
      onEndReached={handleLoadMore}
      onEndReachedThreshold={0.3}
      ListEmptyComponent={<Text style={styles.empty}>알림 내역이 없습니다.</Text>}
      ListFooterComponent={loadingMore ? <ActivityIndicator style={{ marginVertical: 12 }} color="#FF6000" /> : null}
      renderItem={({ item }) => (
        <TouchableOpacity
          style={styles.card}
          onPress={() => navigation.navigate('NotificationDetail', { item })}
        >
          <Text style={styles.time}>{dayjs(item.sent_at).format('M/D HH:mm')}</Text>
          <Text style={styles.title}>판매현황 총 {item.total_qty}개</Text>
          <Text style={styles.amount}>총 {formatAmount(item.total_amount)}원</Text>
        </TouchableOpacity>
      )}
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  empty: { textAlign: 'center', color: '#888', marginTop: 40 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, elevation: 1,
  },
  time: { fontSize: 12, color: '#aaa', marginBottom: 4 },
  title: { fontSize: 15, fontWeight: '600', color: '#333' },
  amount: { fontSize: 14, color: '#FF6000', marginTop: 2 },
});
