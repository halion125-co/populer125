# Internal API Contracts (Frontend ↔ Backend)

Base URL: `${VITE_API_BASE_URL}`

## Standard Response

### Success
```json
{ "data": {}, "meta": {"requestId": "..."} }
```

### Error
```json
{ "code": "...", "message": "...", "details": {}, "retryAfterSeconds": 0 }
```

## Endpoints

### Auth
- `POST /api/auth/test`

### Orders
- `GET /api/orders?paidDateFrom=yyyymmdd&paidDateTo=yyyymmdd&nextToken=`
- `GET /api/orders/{orderId}`

### Inventory
- `GET /api/inventory/summaries?vendorItemId=&nextToken=`

### Products
- `GET /api/products?businessType=&sellerProductId=&sellerProductName=&status=&manufacture=&createdAt=yyyy-MM-dd&maxPerPage=&nextToken=`
- `GET /api/products/{sellerProductId}`
- `PUT /api/products/{sellerProductId}` (body: full seller-product JSON)
- `POST /api/products` (body: create JSON)

### Categories
- `GET /api/categories?registrationType=RFM&locale=kr`
- `GET /api/categories/{displayCategoryCode}/metas`
