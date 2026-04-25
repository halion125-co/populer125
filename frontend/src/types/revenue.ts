export interface RevenueHistoryItem {
  vendorItemId: number;
  productName: string;
  vendorItemName: string;
  salePrice: number;
  quantity: number;
  saleAmount: number;
  serviceFee: number;
  serviceFeeRatio: number;
  settlementAmount: number;
  externalSellerSkuCode: string;
}

export interface RevenueItem {
  orderId: number;
  saleType: 'SALE' | 'REFUND';
  saleDate: string;
  recognitionDate: string;
  settlementDate: string;
  finalSettlementDate: string;
  deliveryFeeAmount: number;
  deliverySettlementAmount: number;
  items: RevenueHistoryItem[];
}

export interface RevenueResponse {
  code: string;
  data: RevenueItem[];
  total: number;
  lastSyncedAt: string;
}
