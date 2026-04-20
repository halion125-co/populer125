import { apiClient } from './client';

export async function getOrders(params?: Record<string, string>) {
  const res = await apiClient.get('/api/coupang/orders', { params });
  return res.data;
}

export async function getProducts() {
  const res = await apiClient.get('/api/coupang/products');
  return res.data;
}

export async function getInventory() {
  const res = await apiClient.get('/api/coupang/inventory');
  return res.data;
}

export async function getInventoryAlerts() {
  const res = await apiClient.get('/api/coupang/inventory/alerts');
  return res.data;
}

export async function getReturns() {
  const res = await apiClient.get('/api/coupang/returns');
  return res.data;
}

export async function getProfile() {
  const res = await apiClient.get('/api/profile');
  return res.data;
}
