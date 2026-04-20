import React, { useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, FlatList,
  RefreshControl, ActivityIndicator
} from 'react-native';
import { getInventory } from '../../api/coupang';

interface InventoryItem {
  vendor_item_id: number;
  product_name: string;
  item_name: string;
  stock_quantity: number;
  status_name: string;
}

export default function InventoryScreen() {
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try {
      const data = await getInventory();
      setItems(data.items ?? []);
    } catch {
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { load(); }, []);

  if (loading) {
    return <View style={styles.center}><ActivityIndicator size="large" color="#FF6000" /></View>;
  }

  return (
    <FlatList
      data={items}
      keyExtractor={(i) => String(i.vendor_item_id)}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} />}
      ListEmptyComponent={<Text style={styles.empty}>재고 정보가 없습니다.</Text>}
      renderItem={({ item }) => (
        <View style={styles.card}>
          <View style={styles.row}>
            <Text style={styles.name} numberOfLines={1}>{item.product_name}</Text>
            <View style={[styles.badge, item.stock_quantity === 0 && styles.badgeOut]}>
              <Text style={styles.badgeText}>{item.stock_quantity === 0 ? '품절' : item.status_name}</Text>
            </View>
          </View>
          {item.item_name ? <Text style={styles.sub}>{item.item_name}</Text> : null}
          <Text style={styles.stock}>재고: {item.stock_quantity}개</Text>
        </View>
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
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  name: { flex: 1, fontSize: 14, fontWeight: '600', color: '#333', marginRight: 8 },
  sub: { fontSize: 12, color: '#888', marginTop: 2 },
  stock: { fontSize: 13, color: '#555', marginTop: 6 },
  badge: {
    backgroundColor: '#e8f5e9', borderRadius: 4, paddingHorizontal: 8, paddingVertical: 2
  },
  badgeOut: { backgroundColor: '#ffebee' },
  badgeText: { fontSize: 11, color: '#333' },
});
