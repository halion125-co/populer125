# 쿠팡 Open APIs - API Docs 엔드포인트 목록

- 기준 카테고리: `https://developers.coupangcorp.com/hc/ko/categories/360002105414`
- 생성일: `2026-04-25`
- 섹션 수: `10`
- 항목 수: `97`

## 정리 기준

- 원문 API 문서의 제목, HTTP Method, Path, Example Endpoint, 원문 URL, URL API Name을 섹션별로 정리했습니다.
- 긴 URL과 Path는 문자열 내부에 임의 줄바꿈을 넣지 않고 한 줄 값으로 보존했습니다.
- method가 PATCH PUT으로 표기된 항목은 원문 Path 영역의 표기를 그대로 보존했습니다.
- 택배사 코드처럼 엔드포인트가 아닌 참고 문서는 method, path, example_endpoint를 null로 두었습니다.
- 본 파일은 API 목록과 엔드포인트 중심 색인입니다. 각 API의 전체 Request/Response 파라미터 표는 source_url의 원문 문서를 기준으로 확인하세요.

## 섹션별 항목 수

| 섹션 | 항목 수 | 원문 섹션 URL |
| --- | ---: | --- |
| 물류센터 APIs | 8 | `https://developers.coupangcorp.com/hc/ko/sections/360005045373-%EB%AC%BC%EB%A5%98%EC%84%BC%ED%84%B0-APIs` |
| 카테고리 APIs | 6 | `https://developers.coupangcorp.com/hc/ko/sections/360005045393-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-APIs` |
| 상품 APIs | 22 | `https://developers.coupangcorp.com/hc/ko/sections/360005045413-%EC%83%81%ED%92%88-APIs` |
| 배송 / 환불 APIs | 12 | `https://developers.coupangcorp.com/hc/ko/sections/360005081913-%EB%B0%B0%EC%86%A1-%ED%99%98%EB%B6%88-APIs` |
| 반품 APIs | 7 | `https://developers.coupangcorp.com/hc/ko/sections/360005081933-%EB%B0%98%ED%92%88-APIs` |
| 교환 APIs | 4 | `https://developers.coupangcorp.com/hc/ko/sections/360005046554-%EA%B5%90%ED%99%98-APIs` |
| 쿠폰 / 캐시백 APIs | 21 | `https://developers.coupangcorp.com/hc/ko/sections/360005046574-%EC%BF%A0%ED%8F%B0-%EC%BA%90%EC%8B%9C%EB%B0%B1-APIs` |
| CS APIs | 6 | `https://developers.coupangcorp.com/hc/ko/sections/360005081953-CS-APIs` |
| 정산 APIs | 2 | `https://developers.coupangcorp.com/hc/ko/sections/360005081973-%EC%A0%95%EC%82%B0-APIs` |
| 로켓그로스 APIs | 9 | `https://developers.coupangcorp.com/hc/ko/sections/35157469062553-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-APIs` |

## API 목록

## 물류센터 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005045373-%EB%AC%BC%EB%A5%98%EC%84%BC%ED%84%B0-APIs
```

### 1. 출고지 생성

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/outboundShippingCenters
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/outboundShippingCenters
```

URL API Name:

```text
REGISTER_OUTBOUND_SHIPPING_CENTER
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033918753-%EC%B6%9C%EA%B3%A0%EC%A7%80-%EC%83%9D%EC%84%B1
```

### 2. 출고지 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/marketplace_openapi/apis/api/v2/vendor/shipping-place/outbound?pageSize=50&pageNum=1
```

URL API Name:

```text
OUTBOUND_SHIPPING_PLACE
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033918773-%EC%B6%9C%EA%B3%A0%EC%A7%80-%EC%A1%B0%ED%9A%8C
```

### 3. 출고지 수정

Method:

```text
PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/outboundShippingCenters/{outboundShippingPlaceCode}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/outboundShippingCenters/123456
```

URL API Name:

```text
UPDATE_OUTBOUND_SHIPPING_PLACECODE
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034203693-%EC%B6%9C%EA%B3%A0%EC%A7%80-%EC%88%98%EC%A0%95
```

### 4. 반품지 생성

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/returnShippingCenters
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/returnShippingCenters
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033918813-%EB%B0%98%ED%92%88%EC%A7%80-%EC%83%9D%EC%84%B1
```

### 5. 반품지 목록 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/returnShippingCenters
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v5/providers/openapi/apis/api/v5/vendors/A00012345/returnShippingCenters?pageNum=1&pageSize=50
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033918833-%EB%B0%98%ED%92%88%EC%A7%80-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C
```

비고:

```text
원문 Example Endpoint가 /v5/providers/... 형식으로 표기되어 있어 그대로 보존했습니다.
```

### 6. 반품지 수정

Method:

```text
PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/returnShippingCenters/{returnCenterCode}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/returnShippingCenters/1100044653
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034203753-%EB%B0%98%ED%92%88%EC%A7%80-%EC%88%98%EC%A0%95
```

### 7. 반품지 단건 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v3/return/shipping-places/center-code
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v3/return/shipping-places/center-code?returnCenterCodes=1000000051,1000006047
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034203773-%EB%B0%98%ED%92%88%EC%A7%80-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C
```

### 8. 택배사 코드

Method:

```text
null
```

Path:

```text
null
```

Example Endpoint:

```text
null
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034156033-%ED%83%9D%EB%B0%B0%EC%82%AC-%EC%BD%94%EB%93%9C
```

비고:

```text
엔드포인트 API가 아니라 택배사 코드 참고 문서입니다.
```

## 카테고리 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005045393-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-APIs
```

### 1. 카테고리 메타정보 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/{displayCategoryCode}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/78877
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033946873-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EB%A9%94%ED%83%80%EC%A0%95%EB%B3%B4-%EC%A1%B0%ED%9A%8C
```

### 2. 카테고리 추천

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v1/categorization/predict
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v1/categorization/predict
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360060575974-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EC%B6%94%EC%B2%9C
```

### 3. 카테고리 자동 매칭 서비스 동의 확인

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendors/{vendorId}/check-auto-category-agreed
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendors/A00123456/check-auto-category-agreed
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360060576254-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EC%9E%90%EB%8F%99-%EB%A7%A4%EC%B9%AD-%EC%84%9C%EB%B9%84%EC%8A%A4-%EB%8F%99%EC%9D%98-%ED%99%95%EC%9D%B8
```

### 4. 카테고리 목록조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947033-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EB%AA%A9%EB%A1%9D%EC%A1%B0%ED%9A%8C
```

### 5. 카테고리 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/{displayCategoryCode}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/0
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947053-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EC%A1%B0%ED%9A%8C
```

### 6. 카테고리 유효성 검사

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/{displayCategoryCode}/status
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories/{displayCategoryCode}/status
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360060576334-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EC%9C%A0%ED%9A%A8%EC%84%B1-%EA%B2%80%EC%82%AC
```

## 상품 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005045413-%EC%83%81%ED%92%88-APIs
```

### 1. 상품 생성

Method:

```text
POST
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

URL API Name:

```text
CREATE_PRODUCT
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947093-%EC%83%81%ED%92%88-%EC%83%9D%EC%84%B1
```

### 2. 상품 승인 요청

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/approvals
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/12345/approvals
```

URL API Name:

```text
APPROVE_PRODUCT
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947133-%EC%83%81%ED%92%88-%EC%8A%B9%EC%9D%B8-%EC%9A%94%EC%B2%AD
```

### 3. 상품 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}
```

URL API Name:

```text
GET_PRODUCT_BY_PRODUCT_ID
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947153-%EC%83%81%ED%92%88-%EC%A1%B0%ED%9A%8C
```

### 4. 상품 조회 (승인불필요)

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/partial
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/partial
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034552893-%EC%83%81%ED%92%88-%EC%A1%B0%ED%9A%8C-%EC%8A%B9%EC%9D%B8%EB%B6%88%ED%95%84%EC%9A%94
```

### 5. 상품 수정 (승인필요)

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

URL API Name:

```text
UPDATE_PRODUCT
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947173-%EC%83%81%ED%92%88-%EC%88%98%EC%A0%95-%EC%8A%B9%EC%9D%B8%ED%95%84%EC%9A%94
```

### 6. 상품 수정 (승인불필요)

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/partial
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/partial
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034525673-%EC%83%81%ED%92%88-%EC%88%98%EC%A0%95-%EC%8A%B9%EC%9D%B8%EB%B6%88%ED%95%84%EC%9A%94
```

### 7. 상품 삭제

Method:

```text
DELETE
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947193-%EC%83%81%ED%92%88-%EC%82%AD%EC%A0%9C
```

### 8. 상품 등록 현황 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/inflow-status
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/inflow-status?sellerProductIds=123
```

URL API Name:

```text
GET_INFLOW_STATUS
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947213-%EC%83%81%ED%92%88-%EB%93%B1%EB%A1%9D-%ED%98%84%ED%99%A9-%EC%A1%B0%ED%9A%8C
```

### 9. 상품 목록 페이징 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products?vendorId={vendorId}&nextToken={nextToken}&maxPerPage={maxPerSize}&sellerProductId={sellerProductId}&sellerProductName={sellerProductName}&status={status}&manufacture={manufacture}&createdAt={createdAt}&violationTypes=ATTR&violationTypes=MOTA_V2&violationTypeAndOr=OR
```

URL API Name:

```text
GET_PRODUCTS_BY_QUERY
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947233-%EC%83%81%ED%92%88-%EB%AA%A9%EB%A1%9D-%ED%8E%98%EC%9D%B4%EC%A7%95-%EC%A1%B0%ED%9A%8C
```

### 10. 상품 목록 구간 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/time-frame
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/time-frame?vendorId=A00012345&createdAtFrom=2020-02-19T10:43:30&createdAtTo=2020-02-19T10:50:30
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034525993-%EC%83%81%ED%92%88-%EB%AA%A9%EB%A1%9D-%EA%B5%AC%EA%B0%84-%EC%A1%B0%ED%9A%8C
```

### 11. 상품 상태변경이력 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/histories
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}/histories
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947253-%EC%83%81%ED%92%88-%EC%83%81%ED%83%9C%EB%B3%80%EA%B2%BD%EC%9D%B4%EB%A0%A5-%EC%A1%B0%ED%9A%8C
```

### 12. 상품 요약 정보 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/external-vendor-sku-codes/{externalVendorSkuCode}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/external-vendor-sku-codes/{externalVendorSkuCode}
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947273-%EC%83%81%ED%92%88-%EC%9A%94%EC%95%BD-%EC%A0%95%EB%B3%B4-%EC%A1%B0%ED%9A%8C
```

### 13. 상품 아이템별 수량/가격/상태 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/inventories
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/inventories
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947293-%EC%83%81%ED%92%88-%EC%95%84%EC%9D%B4%ED%85%9C%EB%B3%84-%EC%88%98%EB%9F%89-%EA%B0%80%EA%B2%A9-%EC%83%81%ED%83%9C-%EC%A1%B0%ED%9A%8C
```

### 14. 상품 아이템별 수량 변경

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/quantities/{quantity}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/quantities/{quantity}
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947313-%EC%83%81%ED%92%88-%EC%95%84%EC%9D%B4%ED%85%9C%EB%B3%84-%EC%88%98%EB%9F%89-%EB%B3%80%EA%B2%BD
```

### 15. 상품 아이템별 가격 변경

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/prices/{price}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/prices/{price}?forceSalePriceUpdate={forceSalePriceUpdate}
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947333-%EC%83%81%ED%92%88-%EC%95%84%EC%9D%B4%ED%85%9C%EB%B3%84-%EA%B0%80%EA%B2%A9-%EB%B3%80%EA%B2%BD
```

### 16. 상품 아이템별 판매 재개

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/sales/resume
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/sales/resume
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947353-%EC%83%81%ED%92%88-%EC%95%84%EC%9D%B4%ED%85%9C%EB%B3%84-%ED%8C%90%EB%A7%A4-%EC%9E%AC%EA%B0%9C
```

### 17. 상품 아이템별 판매 중지

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/sales/stop
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/sales/stop
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947373-%EC%83%81%ED%92%88-%EC%95%84%EC%9D%B4%ED%85%9C%EB%B3%84-%ED%8C%90%EB%A7%A4-%EC%A4%91%EC%A7%80
```

### 18. 상품 아이템별 할인율 기준가격 변경

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/original-prices/{originalPrice}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/original-prices/{originalPrice}
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033947393-%EC%83%81%ED%92%88-%EC%95%84%EC%9D%B4%ED%85%9C%EB%B3%84-%ED%95%A0%EC%9D%B8%EC%9C%A8-%EA%B8%B0%EC%A4%80%EA%B0%80%EA%B2%A9-%EB%B3%80%EA%B2%BD
```

### 19. 자동생성옵션 활성화 (옵션 상품 단위)

Method:

```text
POST
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/auto-generated/opt-in
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/auto-generated/opt-in
```

URL API Name:

```text
UPDATE_PRODUCT_UP_BUNDLING_OPT_IN
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360060576414-%EC%9E%90%EB%8F%99%EC%83%9D%EC%84%B1%EC%98%B5%EC%85%98-%ED%99%9C%EC%84%B1%ED%99%94-%EC%98%B5%EC%85%98-%EC%83%81%ED%92%88-%EB%8B%A8%EC%9C%84
```

### 20. 자동생성옵션 활성화 (전체 상품 단위)

Method:

```text
POST
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller/auto-generated/opt-in
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller/auto-generated/opt-in
```

URL API Name:

```text
UPDATE_SELLER_UP_BUNDLING_OPT_IN
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360060576434-%EC%9E%90%EB%8F%99%EC%83%9D%EC%84%B1%EC%98%B5%EC%85%98-%ED%99%9C%EC%84%B1%ED%99%94-%EC%A0%84%EC%B2%B4-%EC%83%81%ED%92%88-%EB%8B%A8%EC%9C%84
```

### 21. 자동생성옵션 비활성화 (옵션 상품 단위)

Method:

```text
POST
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/auto-generated/opt-out
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/vendor-items/{vendorItemId}/auto-generated/opt-out
```

URL API Name:

```text
UPDATE_PRODUCT_UP_BUNDLING_OPT_OUT
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360060576454-%EC%9E%90%EB%8F%99%EC%83%9D%EC%84%B1%EC%98%B5%EC%85%98-%EB%B9%84%ED%99%9C%EC%84%B1%ED%99%94-%EC%98%B5%EC%85%98-%EC%83%81%ED%92%88-%EB%8B%A8%EC%9C%84
```

### 22. 자동생성옵션 비활성화 (전체 상품 단위)

Method:

```text
POST
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller/auto-generated/opt-out
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller/auto-generated/opt-out
```

URL API Name:

```text
UPDATE_SELLER_UP_BUNDLING_OPT_OUT
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360060576474-%EC%9E%90%EB%8F%99%EC%83%9D%EC%84%B1%EC%98%B5%EC%85%98-%EB%B9%84%ED%99%9C%EC%84%B1%ED%99%94-%EC%A0%84%EC%B2%B4-%EC%83%81%ED%92%88-%EB%8B%A8%EC%9C%84
```

## 배송 / 환불 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005081913-%EB%B0%B0%EC%86%A1-%ED%99%98%EB%B6%88-APIs
```

### 1. 발주서 목록 조회(일단위 페이징)

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/ordersheets?createdAtFrom=2025-07-15%2B09:00&createdAtTo=2025-07-25%2B09:00&maxPerPage=50&status=INSTRUCT
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033919953-%EB%B0%9C%EC%A3%BC%EC%84%9C-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C-%EC%9D%BC%EB%8B%A8%EC%9C%84-%ED%8E%98%EC%9D%B4%EC%A7%95
```

### 2. 발주서 목록 조회(분단위 전체)

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/ordersheets?createdAtFrom=2025-07-29T00:01%2B09:00&createdAtTo=2025-07-29T23:59%2B09:00&searchType=timeFrame&status=DEPARTURE
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034151533-%EB%B0%9C%EC%A3%BC%EC%84%9C-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C-%EB%B6%84%EB%8B%A8%EC%9C%84-%EC%A0%84%EC%B2%B4
```

### 3. 발주서 단건 조회(shipmentBoxId)

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets/{shipmentBoxId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00000001/ordersheets/642538971006401429
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033919973-%EB%B0%9C%EC%A3%BC%EC%84%9C-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C-shipmentBoxId
```

### 4. 발주서 단건 조회(orderId)

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/{orderId}/ordersheets
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00013264/500000596/ordersheets
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034151573-%EB%B0%9C%EC%A3%BC%EC%84%9C-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C-orderId
```

### 5. 배송상태 변경 히스토리 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/ordersheets/{shipmentBoxId}/history
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/ordersheets/123456789/history
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033919993-%EB%B0%B0%EC%86%A1%EC%83%81%ED%83%9C-%EB%B3%80%EA%B2%BD-%ED%9E%88%EC%8A%A4%ED%86%A0%EB%A6%AC-%EC%A1%B0%ED%9A%8C
```

### 6. 상품준비중 처리

Method:

```text
PATCH PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/ordersheets/acknowledgement
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/ordersheets/acknowledgement
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033919413-%EC%83%81%ED%92%88%EC%A4%80%EB%B9%84%EC%A4%91-%EC%B2%98%EB%A6%AC
```

비고:

```text
원문 Path 영역의 Method 표기를 그대로 보존했습니다.
```

### 7. 송장업로드 처리

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/orders/invoices
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/orders/invoices
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034156173-%EC%86%A1%EC%9E%A5%EC%97%85%EB%A1%9C%EB%93%9C-%EC%B2%98%EB%A6%AC
```

### 8. 송장업데이트 처리

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/orders/updateInvoices
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/orders/updateInvoices
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034156193-%EC%86%A1%EC%9E%A5%EC%97%85%EB%8D%B0%EC%9D%B4%ED%8A%B8-%EC%B2%98%EB%A6%AC
```

### 9. 출고중지완료 처리

Method:

```text
PATCH PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnRequests/{receiptId}/stoppedShipment
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/returnRequests/363585/stoppedShipment
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033919433-%EC%B6%9C%EA%B3%A0%EC%A4%91%EC%A7%80%EC%99%84%EB%A3%8C-%EC%B2%98%EB%A6%AC
```

비고:

```text
원문 Path 영역의 Method 표기를 그대로 보존했습니다.
```

### 10. 이미출고 처리

Method:

```text
PATCH PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnRequests/{receiptId}/completedShipment
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/returnRequests/363585/completedShipment
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033919453-%EC%9D%B4%EB%AF%B8%EC%B6%9C%EA%B3%A0-%EC%B2%98%EB%A6%AC
```

비고:

```text
원문 Path 영역의 Method 표기를 그대로 보존했습니다.
```

### 11. 주문 상품 취소 처리

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/orders/{orderId}/cancel
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/orders/2000006593044/cancel
```

URL API Name:

```text
CANCEL_ORDER_PROCESSING
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033843154-%EC%A3%BC%EB%AC%B8-%EC%83%81%ED%92%88-%EC%B7%A8%EC%86%8C-%EC%B2%98%EB%A6%AC
```

### 12. 장기미배송 배송완료 처리

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/completeLongTermUndelivery
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/completeLongTermUndelivery
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034320713-%EC%9E%A5%EA%B8%B0%EB%AF%B8%EB%B0%B0%EC%86%A1-%EB%B0%B0%EC%86%A1%EC%99%84%EB%A3%8C-%EC%B2%98%EB%A6%AC
```

## 반품 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005081933-%EB%B0%98%ED%92%88-APIs
```

### 1. 반품 / 취소 요청 목록 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v6/vendors/{vendorId}/returnRequests
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v6/vendors/A00012345/returnRequests?searchType=timeFrame&createdAtFrom=2017-08-27T11:00&createdAtTo=2017-09-03T11:00&status=UC
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033919613-%EB%B0%98%ED%92%88-%EC%B7%A8%EC%86%8C-%EC%9A%94%EC%B2%AD-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C
```

### 2. 반품요청 단건 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v6/vendors/{vendorId}/returnRequests/{receiptId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v6/vendors/A00012697/returnRequests/363585
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034562353-%EB%B0%98%ED%92%88%EC%9A%94%EC%B2%AD-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C
```

### 3. 반품상품 입고 확인처리

Method:

```text
PATCH PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnRequests/{receiptId}/receiveConfirmation
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/returnRequests/363585/receiveConfirmation
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034027214-%EB%B0%98%ED%92%88%EC%83%81%ED%92%88-%EC%9E%85%EA%B3%A0-%ED%99%95%EC%9D%B8%EC%B2%98%EB%A6%AC
```

비고:

```text
원문 Path 영역의 Method 표기를 그대로 보존했습니다.
```

### 4. 반품요청 승인 처리

Method:

```text
PATCH PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnRequests/{receiptId}/approval
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00013264/returnRequests/363585/approval
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034562513-%EB%B0%98%ED%92%88%EC%9A%94%EC%B2%AD-%EC%8A%B9%EC%9D%B8-%EC%B2%98%EB%A6%AC
```

비고:

```text
원문 Path 영역의 Method 표기를 그대로 보존했습니다.
```

### 5. 반품철회 이력 기간별 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnWithdrawRequests
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/returnWithdrawRequests?sizePerPage=3&pageIndex=1&dateFrom=2018-11-03&dateTo=2018-11-06
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034027354-%EB%B0%98%ED%92%88%EC%B2%A0%ED%9A%8C-%EC%9D%B4%EB%A0%A5-%EA%B8%B0%EA%B0%84%EB%B3%84-%EC%A1%B0%ED%9A%8C
```

### 6. 반품철회 이력 접수번호로 조회

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/returnWithdrawList
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/returnWithdrawList
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034027374-%EB%B0%98%ED%92%88%EC%B2%A0%ED%9A%8C-%EC%9D%B4%EB%A0%A5-%EC%A0%91%EC%88%98%EB%B2%88%ED%98%B8%EB%A1%9C-%EC%A1%B0%ED%9A%8C
```

### 7. 회수 송장 등록

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/return-exchange-invoices/manual
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/return-exchange-invoices/manual
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034027394-%ED%9A%8C%EC%88%98-%EC%86%A1%EC%9E%A5-%EB%93%B1%EB%A1%9D
```

## 교환 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005046554-%EA%B5%90%ED%99%98-APIs
```

### 1. 교환요청 목록조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/exchangeRequests
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/exchangeRequests?createdAtFrom=2018-03-05T00:00:00&createdAtTo=2018-03-10T23:59:59&status=PROGRESS
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033397594-%EA%B5%90%ED%99%98%EC%9A%94%EC%B2%AD-%EB%AA%A9%EB%A1%9D%EC%A1%B0%ED%9A%8C
```

### 2. 교환요청상품 입고 확인처리

Method:

```text
PATCH PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/exchangeRequests/{exchangeId}/receiveConfirmation
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/exchangeRequests/40362/receiveConfirmation
```

URL API Name:

```text
CONFIRM_EXCHANGE_REQUEST
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034027834-%EA%B5%90%ED%99%98%EC%9A%94%EC%B2%AD%EC%83%81%ED%92%88-%EC%9E%85%EA%B3%A0-%ED%99%95%EC%9D%B8%EC%B2%98%EB%A6%AC
```

비고:

```text
원문 Path 영역의 Method 표기를 그대로 보존했습니다.
```

### 3. 교환요청 거부 처리

Method:

```text
PATCH PUT
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/exchangeRequests/{exchangeId}/rejection
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/exchangeRequests/100000070/rejection
```

URL API Name:

```text
REJECT_EXCHANGE_REQUEST
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034027874-%EA%B5%90%ED%99%98%EC%9A%94%EC%B2%AD-%EA%B1%B0%EB%B6%80-%EC%B2%98%EB%A6%AC
```

비고:

```text
원문 Path 영역의 Method 표기를 그대로 보존했습니다.
```

### 4. 교환상품 송장 업로드 처리

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/exchangeRequests/{exchangeId}/invoices
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/exchangeRequests/100000170/invoices
```

URL API Name:

```text
UPDATE_INVOICE_EXCHANGE_REQUEST
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034027954-%EA%B5%90%ED%99%98%EC%83%81%ED%92%88-%EC%86%A1%EC%9E%A5-%EC%97%85%EB%A1%9C%EB%93%9C-%EC%B2%98%EB%A6%AC
```

## 쿠폰 / 캐시백 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005046574-%EC%BF%A0%ED%8F%B0-%EC%BA%90%EC%8B%9C%EB%B0%B1-APIs
```

### 1. (공통)예산현황 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v1/vendors/{vendorId}/budgets
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00012345/budgets?contractId=-1&targetMonth=2017-08
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033922353--%EA%B3%B5%ED%86%B5-%EC%98%88%EC%82%B0%ED%98%84%ED%99%A9-%EC%A1%B0%ED%9A%8C
```

### 2. (공통)계약서 단건 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v2/vendors/{vendorId}/contract
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v2/vendors/A00012345/contract?contractId=9962
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034204213--%EA%B3%B5%ED%86%B5-%EA%B3%84%EC%95%BD%EC%84%9C-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C
```

### 3. (공통)계약서 목록 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v2/vendors/{vendorId}/contract/list
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v2/vendors/A00012345/contract/list
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034204233--%EA%B3%B5%ED%86%B5-%EA%B3%84%EC%95%BD%EC%84%9C-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C
```

### 4. [즉시할인쿠폰] 생성

Method:

```text
POST
```

Path:

```text
/v2/providers/fms/apis/api/v2/vendors/{vendorId}/coupon
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v2/vendors/A00012345/coupon
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034208913--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EC%83%9D%EC%84%B1
```

### 5. [즉시할인쿠폰] 파기

Method:

```text
PUT
```

Path:

```text
/v2/providers/fms/apis/api/v1/vendors/{vendorId}/coupons/{couponId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00012345/coupons/684245?action=expire
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034208973--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%ED%8C%8C%EA%B8%B0
```

### 6. [즉시할인쿠폰] 요청상태 확인

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v1/vendors/{vendorId}/requested/{requestedId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00000001/requested/649102321051192483
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033685834--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EC%9A%94%EC%B2%AD%EC%83%81%ED%83%9C-%ED%99%95%EC%9D%B8
```

### 7. [즉시할인쿠폰] 아이템 생성

Method:

```text
POST
```

Path:

```text
/v2/providers/fms/apis/api/v1/vendors/{vendorId}/coupons/{couponId}/items
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00012345/coupons/68/items
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034209053--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EC%95%84%EC%9D%B4%ED%85%9C-%EC%83%9D%EC%84%B1
```

### 8. [즉시할인쿠폰] 단건 조회(couponId)

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v2/vendors/{vendorId}/coupon
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v2/vendors/A00012345/coupon?couponId=91
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034209373--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C-couponId
```

### 9. [즉시할인쿠폰] 단건 조회(couponItemId)

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v1/vendors/{vendorId}/coupons/{couponId}/items/{couponItemId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00012345/coupons/77/items/80984?type=couponItemId
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034209413--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C-couponItemId
```

### 10. [즉시할인쿠폰] 단건 조회(vendorItemId)

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v1/vendors/{vendorId}/coupons/{couponId}/items/{vendorItemId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00000001/coupons/76/items/3223826213?type=vendorItemId
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033685594--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C-vendorItemId
```

### 11. [즉시할인쿠폰] 목록 조회(status)

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v2/vendors/{vendorId}/coupons
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v2/vendors/A00012345/coupons?status=APPLIED&page=1&size=10&sort=desc
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034209513--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C-status
```

### 12. [즉시할인쿠폰] 목록 조회(orderId)

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v2/vendors/{vendorId}/{orderId}/coupons
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v2/vendors/A00012345/8000000000294/coupons
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034209573--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C-orderId
```

### 13. [즉시할인쿠폰] 아이템 목록 조회(status)

Method:

```text
GET
```

Path:

```text
/v2/providers/fms/apis/api/v1/vendors/{vendorId}/coupons/{couponId}/items
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/fms/apis/api/v1/vendors/A00012345/coupons/99/items?status=APPLIED&page=1&size=10&sort=desc
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034209633--%EC%A6%89%EC%8B%9C%ED%95%A0%EC%9D%B8%EC%BF%A0%ED%8F%B0-%EC%95%84%EC%9D%B4%ED%85%9C-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C-status
```

### 14. [다운로드쿠폰] 생성

Method:

```text
POST
```

Path:

```text
/v2/providers/marketplace_openapi/apis/api/v1/coupons
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/marketplace_openapi/apis/api/v1/coupons
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034205493--%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C%EC%BF%A0%ED%8F%B0-%EC%83%9D%EC%84%B1
```

### 15. [다운로드쿠폰] 파기

Method:

```text
POST
```

Path:

```text
/v2/providers/marketplace_openapi/apis/api/v1/coupons/expire
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/marketplace_openapi/apis/api/v1/coupons/expire
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033683034--%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C%EC%BF%A0%ED%8F%B0-%ED%8C%8C%EA%B8%B0
```

### 16. [다운로드쿠폰] 아이템 생성

Method:

```text
PUT
```

Path:

```text
/v2/providers/marketplace_openapi/apis/api/v1/coupon-items
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/marketplace_openapi/apis/api/v1/coupon-items
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034208773--%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C%EC%BF%A0%ED%8F%B0-%EC%95%84%EC%9D%B4%ED%85%9C-%EC%83%9D%EC%84%B1
```

### 17. [다운로드쿠폰] 요청상태 확인

Method:

```text
GET
```

Path:

```text
/v2/providers/marketplace_openapi/apis/api/v1/coupons/transactionStatus
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/marketplace_openapi/apis/api/v1/coupons/transactionStatus?requestTransactionId=et5_154210571558673553106
```

URL API Name:

```text
GET_REQUEST_STATUS_BY_TRANSACTION_ID
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034209973--%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C%EC%BF%A0%ED%8F%B0-%EC%9A%94%EC%B2%AD%EC%83%81%ED%83%9C-%ED%99%95%EC%9D%B8
```

### 18. [다운로드쿠폰] 단건 조회(couponId)

Method:

```text
GET
```

Path:

```text
/v2/providers/marketplace_openapi/apis/api/v1/coupons/{couponId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/marketplace_openapi/apis/api/v1/coupons/11234224
```

URL API Name:

```text
GET_COUPON_BY_ID
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033685974--%EB%8B%A4%EC%9A%B4%EB%A1%9C%EB%93%9C%EC%BF%A0%ED%8F%B0-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C-couponId
```

### 19. [도서] 상품 캐시백 적용

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/products/items/cashback
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/products/items/cashback
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033645234--%EB%8F%84%EC%84%9C-%EC%83%81%ED%92%88-%EC%BA%90%EC%8B%9C%EB%B0%B1-%EC%A0%81%EC%9A%A9
```

### 20. [도서] 상품 캐시백 검색

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/products/items/cashback
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/products/items/cashback?ruleId=1&vendorItemId=3000000005
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033645254--%EB%8F%84%EC%84%9C-%EC%83%81%ED%92%88-%EC%BA%90%EC%8B%9C%EB%B0%B1-%EA%B2%80%EC%83%89
```

### 21. [도서] 상품 캐시백 삭제

Method:

```text
DELETE
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/products/items/cashback
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00012345/products/items/cashback?ruleId=3944&vendorItemId=3000001897
```

URL API Name:

```text
DELETE_PRODUCT_CASHBACK
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033645274--%EB%8F%84%EC%84%9C-%EC%83%81%ED%92%88-%EC%BA%90%EC%8B%9C%EB%B0%B1-%EC%82%AD%EC%A0%9C
```

## CS APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005081953-CS-APIs
```

### 1. 상품별 고객문의 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/onlineInquiries
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/onlineInquiries?inquiryStartAt=2019-06-25&inquiryEndAt=2019-06-26&vendorId=A00012345&answeredType=NOANSWER&pageSize=10&pageNum=1
```

URL API Name:

```text
GET_CUSTOMER_SERVICE_REQUEST
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033400754-%EC%83%81%ED%92%88%EB%B3%84-%EA%B3%A0%EA%B0%9D%EB%AC%B8%EC%9D%98-%EC%A1%B0%ED%9A%8C
```

### 2. 상품별 고객문의 답변

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/onlineInquiries/{inquiryId}/replies
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00010028/onlineInquiries/846/replies
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033645174-%EC%83%81%ED%92%88%EB%B3%84-%EA%B3%A0%EA%B0%9D%EB%AC%B8%EC%9D%98-%EB%8B%B5%EB%B3%80
```

### 3. 쿠팡 고객센터 문의조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/{vendorId}/callCenterInquiries
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/A00012345/callCenterInquiries?inquiryStartAt=2018-01-07&inquiryEndAt=2018-01-08&vendorId=A00012345&partnerCounselingStatus=NO_ANSWER&pageSize=10&pageNum=1
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033645354-%EC%BF%A0%ED%8C%A1-%EA%B3%A0%EA%B0%9D%EC%84%BC%ED%84%B0-%EB%AC%B8%EC%9D%98%EC%A1%B0%ED%9A%8C
```

### 4. 쿠팡 고객센터 문의 단건 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v5/vendors/callCenterInquiries/{inquiryId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v5/vendors/callCenterInquiries/1234567
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/20376877844249-%EC%BF%A0%ED%8C%A1-%EA%B3%A0%EA%B0%9D%EC%84%BC%ED%84%B0-%EB%AC%B8%EC%9D%98-%EB%8B%A8%EA%B1%B4-%EC%A1%B0%ED%9A%8C
```

### 5. 쿠팡 고객센터 문의답변

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/callCenterInquiries/{inquiryId}/replies
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00010028/callCenterInquiries/1007837444/replies
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034156233-%EC%BF%A0%ED%8C%A1-%EA%B3%A0%EA%B0%9D%EC%84%BC%ED%84%B0-%EB%AC%B8%EC%9D%98%EB%8B%B5%EB%B3%80
```

### 6. 쿠팡 고객센터 문의확인

Method:

```text
POST
```

Path:

```text
/v2/providers/openapi/apis/api/v4/vendors/{vendorId}/callCenterInquiries/{inquiryId}/confirms
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v4/vendors/A00010028/callCenterInquiries/1007837444/confirms
```

URL API Name:

```text
CONFIRM_INQUIRY
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034204013-%EC%BF%A0%ED%8C%A1-%EA%B3%A0%EA%B0%9D%EC%84%BC%ED%84%B0-%EB%AC%B8%EC%9D%98%ED%99%95%EC%9D%B8
```

## 정산 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/360005081973-%EC%A0%95%EC%82%B0-APIs
```

### 1. 매출내역 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/openapi/apis/api/v1/revenue-history
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/openapi/apis/api/v1/revenue-history?vendorId=A00012345&recognitionDateFrom=2019-10-01&recognitionDateTo=2019-10-30&token=&maxPerPage=
```

URL API Name:

```text
GET_REVENUE_HISTORY
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360033922413-%EB%A7%A4%EC%B6%9C%EB%82%B4%EC%97%AD-%EC%A1%B0%ED%9A%8C
```

### 2. 지급내역조회

Method:

```text
GET
```

Path:

```text
/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/marketplace_openapi/apis/api/v1/settlement-histories?revenueRecognitionYearMonth=2019-10
```

URL API Name:

```text
SETTLEMENT_HISTORIES
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/360034152213-%EC%A7%80%EA%B8%89%EB%82%B4%EC%97%AD%EC%A1%B0%ED%9A%8C
```

## 로켓그로스 APIs

원문 섹션 URL:

```text
https://developers.coupangcorp.com/hc/ko/sections/35157469062553-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-APIs
```

### 1. 로켓그로스 주문 API(목록 쿼리)

Method:

```text
GET
```

Path:

```text
/v2/providers/rg_open_api/apis/api/v1/vendors/{vendorId}/rg/orders
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/rg_open_api/apis/api/v1/vendors/A00123456/rg/orders
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/41131195825433-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EC%A3%BC%EB%AC%B8-API-%EB%AA%A9%EB%A1%9D-%EC%BF%BC%EB%A6%AC
```

### 2. 로켓그로스 주문API

Method:

```text
GET
```

Path:

```text
/v2/providers/rg_open_api/apis/api/v1/vendors/{vendorId}/rg/order/{orderId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/rg_open_api/apis/api/v1/vendors/A0023456/rg/order/122345566789
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/41129805240473-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EC%A3%BC%EB%AC%B8API
```

### 3. 로켓창고 재고 API

Method:

```text
GET
```

Path:

```text
/v2/providers/rg_open_api/apis/api/v1/vendors/{vendorId}/rg/inventory/summaries
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/rg_open_api/apis/api/v1/vendors/{vendorId}/rg/inventory/summaries
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/41090779386521-%EB%A1%9C%EC%BC%93%EC%B0%BD%EA%B3%A0-%EC%9E%AC%EA%B3%A0-API
```

### 4. 상품 목록 페이징 조회 (로켓그로스 및 로켓그로스/마켓플레이스 동시 운영 상품)

Method:

```text
GET
```

Path:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products?vendorId={vendorId}&nextToken={nextToken}&maxPerPage={maxPerSize}&sellerProductId={sellerProductId}&sellerProductName={sellerProductName}&status={status}&manufacture={manufacture}&createdAt={createdAt}&businessTypes={businessType}
```

URL API Name:

```text
GET_PRODUCTS_BY_QUERY
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/39427498030745-%EC%83%81%ED%92%88-%EB%AA%A9%EB%A1%9D-%ED%8E%98%EC%9D%B4%EC%A7%95-%EC%A1%B0%ED%9A%8C-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%B0%8F-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%A7%88%EC%BC%93%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4-%EB%8F%99%EC%8B%9C-%EC%9A%B4%EC%98%81-%EC%83%81%ED%92%88
```

비고:

```text
원문 Path에 전체 URL이 표기되어 있어 그대로 보존했습니다.
```

### 5. 상품 생성 (로켓그로스 및 마켓플레이스/로켓그로스 동시 운영 상품)

Method:

```text
POST
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

URL API Name:

```text
CREATE_PRODUCT
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/39406974365849-%EC%83%81%ED%92%88-%EC%83%9D%EC%84%B1-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%B0%8F-%EB%A7%88%EC%BC%93%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%8F%99%EC%8B%9C-%EC%9A%B4%EC%98%81-%EC%83%81%ED%92%88
```

### 6. 상품 수정 (로켓그로스 또는 마켓플레이스/로켓그로스 동시 운영 상품)

Method:

```text
PUT
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products
```

URL API Name:

```text
UPDATE_PRODUCT
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/39407792403609-%EC%83%81%ED%92%88-%EC%88%98%EC%A0%95-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%98%90%EB%8A%94-%EB%A7%88%EC%BC%93%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%8F%99%EC%8B%9C-%EC%9A%B4%EC%98%81-%EC%83%81%ED%92%88
```

### 7. 상품 조회 (로켓그로스 또는 마켓플레이스/로켓그로스 동시 운영 상품)

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/seller-products/{sellerProductId}
```

URL API Name:

```text
GET_PRODUCT_BY_PRODUCT_ID
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/37338749441689-%EC%83%81%ED%92%88-%EC%A1%B0%ED%9A%8C-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%98%90%EB%8A%94-%EB%A7%88%EC%BC%93%ED%94%8C%EB%A0%88%EC%9D%B4%EC%8A%A4-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EB%8F%99%EC%8B%9C-%EC%9A%B4%EC%98%81-%EC%83%81%ED%92%88
```

### 8. 카테고리 메타 정보 조회

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/{displayCategoryCode}
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/meta/category-related-metas/display-category-codes/78877
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/39429124103449-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EB%A9%94%ED%83%80-%EC%A0%95%EB%B3%B4-%EC%A1%B0%ED%9A%8C
```

비고:

```text
원문에 별도 Path heading 없이 Example Endpoint만 제공되어, endpoint의 displayCategoryCode 값을 placeholder로 치환해 path를 기재했습니다.
```

### 9. 카테고리 목록 조회 (로켓그로스 운영 카테고리)

Method:

```text
GET
```

Path:

```text
/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories
```

Example Endpoint:

```text
https://api-gateway.coupang.com/v2/providers/seller_api/apis/api/v1/marketplace/meta/display-categories?registrationType=RFM&locale=en
```

URL API Name:

```text
null
```

원문 문서 URL:

```text
https://developers.coupangcorp.com/hc/ko/articles/39428894927257-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC-%EB%AA%A9%EB%A1%9D-%EC%A1%B0%ED%9A%8C-%EB%A1%9C%EC%BC%93%EA%B7%B8%EB%A1%9C%EC%8A%A4-%EC%9A%B4%EC%98%81-%EC%B9%B4%ED%85%8C%EA%B3%A0%EB%A6%AC
```
