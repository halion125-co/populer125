export interface OrderItem {
  vendorItemId: number;
  productName: string;
  salesQuantity: number;
  unitPrice: number;
  salesPrice: number;
}

export interface Order {
  orderId: number;
  paidAt: string; // ISO date string from DB (e.g., "2025-01-15")
  syncedAt: string;
  orderItems: OrderItem[];
}

export interface OrdersResponse {
  code: string;
  data: Order[];
  total: number;
  lastSyncedAt: string;
}
