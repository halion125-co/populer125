import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator, TouchableOpacity
} from 'react-native';
import dayjs from 'dayjs';
import { getOrders } from '../../api/coupang';

interface OrderItem {
  productName: string;
  salesQuantity: number;
  unitPrice: number;
}

interface Order {
  orderId: number;
  paidAt: string;
  orderItems: OrderItem[];
}

export default function OrdersScreen() {
  const [selectedDate, setSelectedDate] = useState(dayjs());
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (date = selectedDate) => {
    try {
      const d = date.format('YYYY-MM-DD');
      const data = await getOrders({ createdAtFrom: d, createdAtTo: d });
      setOrders(data.data ?? []);
    } catch (e) {
      console.warn('orders load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    setLoading(true);
    load(selectedDate);
  }, [selectedDate]);

  const prevDay = () => setSelectedDate(d => d.subtract(1, 'day'));
  const nextDay = () => {
    const next = selectedDate.add(1, 'day');
    if (next.isAfter(dayjs(), 'day')) return; // 미래는 이동 불가
    setSelectedDate(next);
  };

  const isToday = selectedDate.isSame(dayjs(), 'day');

  const formatAmount = (n: number) =>
    Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  const totalQty = orders.reduce((s, o) =>
    s + (o.orderItems ?? []).reduce((a, i) => a + i.salesQuantity, 0), 0);
  const totalAmount = orders.reduce((s, o) =>
    s + (o.orderItems ?? []).reduce((a, i) => a + i.unitPrice * i.salesQuantity, 0), 0);

  return (
    <View style={styles.container}>
      {/* 날짜 네비게이터 */}
      <View style={styles.dateNav}>
        <TouchableOpacity style={styles.arrow} onPress={prevDay}>
          <Text style={styles.arrowText}>‹</Text>
        </TouchableOpacity>
        <View style={styles.dateCenter}>
          <Text style={styles.dateText}>
            {selectedDate.format('YYYY년 M월 D일')}
            {isToday ? '  (오늘)' : ` (${['일', '월', '화', '수', '목', '금', '토'][selectedDate.day()]})`}
          </Text>
        </View>
        <TouchableOpacity style={styles.arrow} onPress={nextDay} disabled={isToday}>
          <Text style={[styles.arrowText, isToday && styles.arrowDisabled]}>›</Text>
        </TouchableOpacity>
      </View>

      {/* 요약 */}
      <View style={styles.summary}>
        <Text style={styles.summaryText}>총 {totalQty}개</Text>
        <Text style={styles.summaryDivider}>|</Text>
        <Text style={styles.summaryAmount}>{formatAmount(totalAmount)}원</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color="#FF6000" /></View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.orderId)}
          contentContainerStyle={styles.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(selectedDate); }} />
          }
          ListEmptyComponent={
            <View style={styles.emptyBox}>
              <Text style={styles.empty}>해당 날짜의 주문이 없습니다.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <View style={styles.card}>
              <Text style={styles.time}>{dayjs(item.paidAt).format('HH:mm')}</Text>
              {(item.orderItems ?? []).map((oi, idx) => (
                <Text key={idx} style={styles.item}>
                  • {oi.productName} / {oi.salesQuantity}개 / {formatAmount(oi.unitPrice)}원
                </Text>
              ))}
            </View>
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  dateNav: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: '#fff', paddingVertical: 12,
    borderBottomWidth: 1, borderBottomColor: '#eee',
  },
  arrow: { width: 48, alignItems: 'center', justifyContent: 'center' },
  arrowText: { fontSize: 28, color: '#FF6000', fontWeight: '300' },
  arrowDisabled: { color: '#ccc' },
  dateCenter: { flex: 1, alignItems: 'center' },
  dateText: { fontSize: 16, fontWeight: '600', color: '#333' },
  summary: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    backgroundColor: '#fff8f0', paddingVertical: 10, gap: 12,
    borderBottomWidth: 1, borderBottomColor: '#ffe0cc',
  },
  summaryText: { fontSize: 15, color: '#555', fontWeight: '500' },
  summaryDivider: { color: '#ddd', fontSize: 16 },
  summaryAmount: { fontSize: 15, color: '#FF6000', fontWeight: '700' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  emptyBox: { paddingTop: 60, alignItems: 'center' },
  empty: { color: '#aaa', fontSize: 14 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginBottom: 10, elevation: 1,
  },
  time: { fontSize: 12, color: '#aaa', marginBottom: 6, fontWeight: '500' },
  item: { fontSize: 14, color: '#333', lineHeight: 22 },
});
