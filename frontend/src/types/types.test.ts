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
      productId: 999,
      vendorId: 'A01407257',
      mdId: null,
      mdName: null,
      saleStartedAt: '2024-01-01',
      saleEndedAt: '2024-12-31',
      brand: 'Test Brand',
      statusName: '승인완료',
      createdAt: '2024-01-01',
      registrationType: 'GENERAL',
    };

    expect(product.sellerProductId).toBe(123);
    expect(product.sellerProductName).toBe('Test Product');
  });

  it('TC008: Order type structure is valid', () => {
    const order: Order = {
      orderId: 12345,
      vendorId: 'A01407257',
      paidAt: '1234567890000',
      orderItems: [{
        vendorItemId: 111,
        productName: 'Test Item',
        salesQuantity: 2,
        unitSalesPrice: 10000,
        currency: 'KRW',
      }],
    };

    expect(order.orderId).toBe(12345);
    expect(order.orderItems.length).toBe(1);
  });

  it('TC009: InventoryItem type structure is valid', () => {
    const item: InventoryItem = {
      sellerProductName: 'Test Product',
      vendorItemId: 123,
      vendorItemName: 'Test Option',
      salePrice: 10000,
      originalPrice: 8000,
      statusName: '판매중',
      inventory: {
        quantity: 100,
        stockAvailableQuantity: 95,
        warehouseQuantity: 100,
      },
    };

    expect(item.vendorItemId).toBe(123);
    expect(item.inventory?.stockAvailableQuantity).toBe(95);
  });
});
