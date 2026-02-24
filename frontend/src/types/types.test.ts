import { describe, it, expect } from 'vitest';
import type { Product } from './product';
import type { Order } from './order';
import type { InventoryItem } from './inventory';

describe('Type Definitions', () => {
  it('TC007: Product type has required fields', () => {
    const product: Product = {
      sellerProductId: 123,
      sellerProductName: 'Test Product',
      displayCategoryCode: 456,
      categoryId: 789,
      saleStartedAt: '2024-01-01',
      saleEndedAt: '2024-12-31',
      brand: 'Test Brand',
      statusName: '승인완료',
      registrationType: 'GENERAL',
      itemCount: 0,
      syncedAt: '2024-01-01',
    };

    expect(product.sellerProductId).toBe(123);
    expect(product.sellerProductName).toBe('Test Product');
  });

  it('TC008: Order type structure is valid', () => {
    const order: Order = {
      orderId: 12345,
      paidAt: '2024-01-15',
      syncedAt: '2024-01-15',
      orderItems: [{
        vendorItemId: 111,
        productName: 'Test Item',
        salesQuantity: 2,
        unitPrice: 10000,
        salesPrice: 20000,
      }],
    };

    expect(order.orderId).toBe(12345);
    expect(order.orderItems.length).toBe(1);
  });

  it('TC009: InventoryItem type structure is valid', () => {
    const item: InventoryItem = {
      vendorItemId: 123,
      productName: 'Test Product',
      itemName: 'Test Option',
      statusName: '판매중',
      stockQuantity: 100,
      salesLast30Days: 10,
      isMapped: true,
    };

    expect(item.vendorItemId).toBe(123);
    expect(item.stockQuantity).toBe(100);
  });
});
