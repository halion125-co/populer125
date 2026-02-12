export interface OrderItem {
  vendorItemId: number;
  productName: string;
  salesQuantity: number;
  salesPrice?: number; // 문서에는 salesPrice
  unitSalesPrice?: number; // 실제 응답에는 unitSalesPrice일 수 있음
  currency: string;
}

export interface Order {
  orderId: number;
  vendorId: string;
  paidAt: string; // timestamp in milliseconds (e.g., "1746093162000")
  orderItems: OrderItem[];
}

export interface OrdersResponse {
  code: number;
  message: string;
  data: Order[];
  nextToken?: string;
}
