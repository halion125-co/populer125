export interface Product {
  sellerProductId: number;
  sellerProductName: string;
  displayCategoryCode: number;
  categoryId: number;
  productId: number;
  vendorId: string;
  mdId: string | null;
  mdName: string | null;
  saleStartedAt: string;
  saleEndedAt: string;
  brand: string;
  statusName: string;
  createdAt: string;
  registrationType: string;
}

export interface ProductsResponse {
  code: string;
  message: string;
  nextToken: string;
  data: Product[];
}
