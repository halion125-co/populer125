import React from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import dayjs from 'dayjs';
import { NotificationHistoryItem } from '../../api/notifications';

export default function NotificationDetailScreen({ route }: { route: any }) {
  const item: NotificationHistoryItem = route.params.item;

  const formatAmount = (n: number) =>
    n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  return (
    <ScrollView style={styles.container}>
      <Text style={styles.date}>{dayjs(item.sent_at).format('YYYY-MM-DD HH:mm')}</Text>
      <View style={styles.summaryBox}>
        <Text style={styles.summary}>
          판매현황 총 {item.total_qty}개 / 총 {formatAmount(item.total_amount)}원
        </Text>
      </View>
      <View style={styles.divider} />
      {(item.detail_json ?? []).map((line, idx) => (
        <Text key={idx} style={styles.line}>{line}</Text>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#fff', padding: 20 },
  date: { fontSize: 13, color: '#aaa', marginBottom: 12 },
  summaryBox: {
    backgroundColor: '#fff8f0', borderRadius: 8,
    padding: 14, marginBottom: 16,
  },
  summary: { fontSize: 16, fontWeight: '700', color: '#FF6000' },
  divider: { height: 1, backgroundColor: '#f0f0f0', marginBottom: 16 },
  line: { fontSize: 14, color: '#444', lineHeight: 24 },
});
