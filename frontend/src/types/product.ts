export interface ProductItem {
  itemId: number;
  itemName: string;
  sellerProductItemName: string;
  externalVendorSku: string;
  originalPrice: number;
  salePrice: number;
  statusName: string;
  rocketGrowthItemData?: {
    vendorItemId: number;
  };
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
