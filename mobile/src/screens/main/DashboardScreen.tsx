import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TouchableOpacity,
  RefreshControl, ActivityIndicator, Dimensions,
} from 'react-native';
import dayjs from 'dayjs';
import { BarChart } from 'react-native-chart-kit';
import { getOrders } from '../../api/coupang';

const SCREEN_WIDTH = Dimensions.get('window').width;

type RangeKey = '7' | '30' | '90';

interface DayData {
  label: string;
  sales: number;
  count: number;
}

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7', label: '7일' },
  { key: '30', label: '30일' },
  { key: '90', label: '90일' },
];

export default function DashboardScreen() {
  const [range, setRange] = useState<RangeKey>('7');
  const [chartData, setChartData] = useState<DayData[]>([]);
  const [totalQty, setTotalQty] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async (r: RangeKey = range) => {
    try {
      const toDate = dayjs().format('YYYY-MM-DD');
      const fromDate = dayjs().subtract(Number(r) - 1, 'day').format('YYYY-MM-DD');
      const data = await getOrders({ createdAtFrom: fromDate, createdAtTo: toDate });
      const orders: any[] = data.data ?? [];

      // 날짜별 집계
      const map: Record<string, { sales: number; count: number }> = {};
      for (let i = 0; i < Number(r); i++) {
        const d = dayjs().subtract(Number(r) - 1 - i, 'day').format('YYYY-MM-DD');
        map[d] = { sales: 0, count: 0 };
      }
      let qty = 0, amount = 0;
      for (const order of orders) {
        const d = dayjs(order.paidAt).format('YYYY-MM-DD');
        if (map[d]) {
          for (const oi of order.orderItems ?? []) {
            map[d].sales += (oi.unitPrice ?? 0) * (oi.salesQuantity ?? 0);
            map[d].count += oi.salesQuantity ?? 0;
            qty += oi.salesQuantity ?? 0;
            amount += (oi.unitPrice ?? 0) * (oi.salesQuantity ?? 0);
          }
        }
      }

      const days = Object.entries(map).map(([date, v]) => ({
        label: dayjs(date).format(Number(r) <= 7 ? 'M/D' : Number(r) <= 30 ? 'D일' : 'M/D'),
        sales: v.sales,
        count: v.count,
      }));

      setChartData(days);
      setTotalQty(qty);
      setTotalAmount(amount);
    } catch (e) {
      console.warn('dashboard load error', e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(range); }, [range]);

  const fmt = (n: number) =>
    Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  // 차트 데이터가 모두 0이면 최솟값 설정 (0만 있으면 그래프가 안 그려짐)
  const barValues = chartData.map(d => Math.round(d.sales / 10000));
  const hasData = barValues.some(v => v > 0);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FF6000" /></View>;
  }

  return (
    <ScrollView
      style={styles.container}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(range); }} />}
    >
      {/* 기간 선택 */}
      <View style={styles.rangeRow}>
        {RANGES.map(r => (
          <TouchableOpacity
            key={r.key}
            style={[styles.rangeBtn, range === r.key && styles.rangeBtnActive]}
            onPress={() => { setRange(r.key); }}
          >
            <Text style={[styles.rangeBtnText, range === r.key && styles.rangeBtnTextActive]}>
              {r.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* 요약 카드 */}
      <View style={styles.row}>
        <View style={[styles.card, { flex: 1, marginRight: 8 }]}>
          <Text style={styles.cardLabel}>총 판매 수량</Text>
          <Text style={styles.cardValue}>{totalQty}개</Text>
        </View>
        <View style={[styles.card, { flex: 1 }]}>
          <Text style={styles.cardLabel}>총 판매 금액</Text>
          <Text style={[styles.cardValue, { fontSize: 20 }]}>{fmt(totalAmount)}원</Text>
        </View>
      </View>

      {/* 막대 그래프 */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>일별 판매 금액 (만원)</Text>
        {hasData ? (
          <BarChart
            data={{
              labels: chartData.map(d => d.label),
              datasets: [{ data: barValues }],
            }}
            width={SCREEN_WIDTH - 32}
            height={220}
            yAxisLabel=""
            yAxisSuffix="만"
            fromZero
            chartConfig={{
              backgroundColor: '#fff',
              backgroundGradientFrom: '#fff',
              backgroundGradientTo: '#fff',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(255, 96, 0, ${opacity})`,
              labelColor: () => '#888',
              barPercentage: Number(range) <= 7 ? 0.6 : Number(range) <= 30 ? 0.5 : 0.4,
              propsForLabels: { fontSize: 10 },
            }}
            style={{ borderRadius: 8 }}
            showValuesOnTopOfBars={Number(range) <= 7}
          />
        ) : (
          <View style={styles.noData}>
            <Text style={styles.noDataText}>해당 기간 판매 데이터가 없습니다.</Text>
          </View>
        )}
      </View>

      {/* 일별 상세 목록 */}
      <View style={styles.chartCard}>
        <Text style={styles.chartTitle}>일별 상세</Text>
        {chartData.filter(d => d.sales > 0).length === 0 ? (
          <Text style={styles.noDataText}>데이터 없음</Text>
        ) : (
          chartData.slice().reverse().filter(d => d.sales > 0).map((d, i) => (
            <View key={i} style={styles.detailRow}>
              <Text style={styles.detailLabel}>{d.label}</Text>
              <Text style={styles.detailCount}>{d.count}개</Text>
              <Text style={styles.detailAmount}>{fmt(d.sales)}원</Text>
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#f5f5f5' },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  rangeRow: { flexDirection: 'row', padding: 16, paddingBottom: 8, gap: 8 },
  rangeBtn: {
    flex: 1, paddingVertical: 8, borderRadius: 8,
    backgroundColor: '#fff', alignItems: 'center',
    borderWidth: 1, borderColor: '#e0e0e0',
  },
  rangeBtnActive: { backgroundColor: '#FF6000', borderColor: '#FF6000' },
  rangeBtnText: { fontSize: 14, color: '#666', fontWeight: '500' },
  rangeBtnTextActive: { color: '#fff', fontWeight: '700' },
  row: { flexDirection: 'row', paddingHorizontal: 16, paddingBottom: 12 },
  card: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    elevation: 1, shadowColor: '#000', shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08, shadowRadius: 2,
  },
  cardLabel: { fontSize: 12, color: '#888', marginBottom: 4 },
  cardValue: { fontSize: 22, fontWeight: '700', color: '#FF6000' },
  chartCard: {
    backgroundColor: '#fff', borderRadius: 12, padding: 16,
    marginHorizontal: 16, marginBottom: 12, elevation: 1,
  },
  chartTitle: { fontSize: 14, fontWeight: '600', color: '#333', marginBottom: 12 },
  noData: { height: 100, justifyContent: 'center', alignItems: 'center' },
  noDataText: { color: '#aaa', fontSize: 13 },
  detailRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f5f5',
  },
  detailLabel: { fontSize: 13, color: '#555', flex: 1 },
  detailCount: { fontSize: 13, color: '#888', width: 50, textAlign: 'right' },
  detailAmount: { fontSize: 13, color: '#333', fontWeight: '600', width: 100, textAlign: 'right' },
});
