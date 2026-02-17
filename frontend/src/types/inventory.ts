export interface InventoryItem {
  vendorItemId: number;      // SKU ID
  productName: string;       // 상품명
  itemName: string;          // 옵션명
  statusName: string;        // 상품 상태
  stockQuantity: number;     // 재고수량
  salesLast30Days: number;   // 30일 판매량 (API에서 직접 제공)
}

export interface InventoryResponse {
  code: string;
  message: string;
  data: InventoryItem[];
}
