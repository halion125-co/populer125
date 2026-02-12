// 쿠팡 재고 API 응답 구조
export interface CoupangInventory {
  quantity: number;
  stockAvailableQuantity: number; // 판매가능 수량
  warehouseQuantity: number;
}

// 통합된 재고 아이템 (상품 정보 + 재고 정보)
export interface InventoryItem {
  sellerProductName: string;    // 상품명
  vendorItemId: number;          // SKU ID
  vendorItemName: string;        // 옵션명 (예: "5cm 핑크")
  salePrice: number;             // 판매가
  originalPrice: number;         // 원가/비용
  statusName: string;            // 상품 상태
  inventory?: CoupangInventory;  // 재고 정보 (옵셔널)
}

export interface InventoryResponse {
  code: string;
  message: string;
  data: InventoryItem[];
}
