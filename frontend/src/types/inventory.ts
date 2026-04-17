export interface InventoryItem {
  vendorItemId: number;
  productName: string;
  itemName: string;
  statusName: string;
  stockQuantity: number;
  salesLast30Days: number;
  isMapped: boolean;
  syncedAt: string;
  createdAt: string;
  outOfStockAt: string;
}

export interface InventoryResponse {
  code: string;
  data: InventoryItem[];
  total: number;
  totalAll: number;
  totalInStock: number;
  totalOutOfStock: number;
  page: number;
  pageSize: number;
  totalPages: number;
  lastSyncedAt: string;
}

export interface AlertItem {
  alertType: 'new' | 'out_of_stock';
  vendorItemId: number;
  productName: string;
  itemName: string;
  stockQuantity: number;
  salesLast30Days: number;
  alertAt: string;
}

export interface InventoryAlertsResponse {
  code: string;
  newItems: AlertItem[];
  outOfStock: AlertItem[];
}
