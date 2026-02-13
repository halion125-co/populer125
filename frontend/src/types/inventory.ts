// 통합된 재고 아이템 (상품 정보 + 재고 정보)
export interface InventoryItem {
  sellerProductName: string;      // 상품명
  vendorItemId: number;           // SKU ID
  vendorItemName: string;         // 옵션명 (예: "5cm 핑크")
  quantity: number;               // 재고 수량
  stockAvailableQuantity: number; // 판매가능 수량
  warehouseQuantity: number;      // 창고 수량
  salePrice: number;              // 판매가
  originalPrice: number;          // 원가/비용
  statusName: string;             // 상품 상태
}

export interface InventoryResponse {
  code: string;
  message: string;
  data: InventoryItem[];
}
