export interface ReturnItem {
  receiptId: number;
  orderId: number;
  returnInvoiceNumber?: string;
  statusName?: string;
  status?: string;
  productName?: string;
  vendorItemId?: number;
  quantity?: number;
  returnCount?: number;
  salesQuantity?: number;
  returnReason?: string;
  returnReasonCode?: string;
  createdAt?: string;
  cancelledAt?: string;
  returnedAt?: string;
  holdbackStatus?: string;
  holdbackDetailedReason?: string;
  [key: string]: unknown;
}

export interface ReturnsResponse {
  code: string;
  data: ReturnItem[];
  total: number;
  createdAtFrom: string;
  createdAtTo: string;
  status: string;
}

export const RETURN_STATUSES = [
  { value: '', label: '전체' },
  { value: 'UC', label: 'UC - 미확인' },
  { value: 'RU', label: 'RU - 처리중' },
  { value: 'CC', label: 'CC - 취소완료' },
  { value: 'PR', label: 'PR - 부분반품' },
];
