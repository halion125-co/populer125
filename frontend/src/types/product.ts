export interface ProductItem {
  vendorItemId: number;
  itemName: string;
  statusName: string;
  stockQuantity: number;
  salesLast30Days: number;
}

export interface Product {
  sellerProductId: number;
  sellerProductName: string;
  displayCategoryCode: number;
  categoryId: number;
  saleStartedAt: string;
  saleEndedAt: string;
  brand: string;
  statusName: string;
  registrationType: string;
  itemCount: number;
  syncedAt: string;
}

export interface ProductItemsResponse {
  code: string;
  sellerProductId: number;
  sellerProductName: string;
  statusName: string;
  brand: string;
  items: ProductItem[];
}

export interface ProductsResponse {
  code: string;
  data: Product[];
  total: number;
  lastSyncedAt: string;
}
