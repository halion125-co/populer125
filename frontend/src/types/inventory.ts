export interface InventoryItem {
  vendorItemId: number;
  productName: string;
  itemName: string;
  statusName: string;
  stockQuantity: number;
  salesLast30Days: number;
  isMapped: boolean;
}

export interface InventoryResponse {
  code: string;
  message: string;
  data: InventoryItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}
