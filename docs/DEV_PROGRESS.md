# 개발 진행 현황 및 개발 기준

> 최종 업데이트: 2026-04-10
> 프로젝트: populer125 (RocketGrowth - 쿠팡 판매 관리 대시보드)

---

## 기술 스택

| 영역 | 기술 |
|------|------|
| 백엔드 | Go + Echo 프레임워크 |
| 프론트엔드 | React + TypeScript + Tailwind CSS |
| DB | SQLite (modernc.org/sqlite) |
| 차트 | Recharts |
| 배포 | Docker Compose (로컬), NAS (운영) |
| 인증 | JWT |

---

## 개발 기준 (모든 기능 개발 시 반드시 준수)

### 코드 품질
- [ ] 기존 public interface 변경 금지 — 변경 필요 시 사전 협의
- [ ] 부작용(side effect) 최소화 — 함수는 단일 책임 원칙 준수
- [ ] 버그 수정 시 **재현 테스트 먼저 작성 → 수정 → 회귀 방지 테스트** 순서로 진행
- [ ] 음수/경계값 방어 — 금액, 수량 등 숫자 필드는 0 미만 불가 처리 필수

### 보안
- [ ] SQL Injection 방지 — 반드시 파라미터 바인딩 사용 (`?` placeholder)
- [ ] 인증 확인 — 모든 API 핸들러에서 `c.Get("user").(*middleware.UserContext)` 로 user 추출
- [ ] 사용자 격리 — DB 조회/수정 시 반드시 `user_id` 조건 포함

### DB 변경
- [ ] 테이블 신규 생성: `createTables()` 에 `CREATE TABLE IF NOT EXISTS` 추가
- [ ] 기존 테이블 컬럼 추가: `migrateXxx()` 함수에 `ALTER TABLE ADD COLUMN` 추가 (idempotent)
- [ ] 기본값 필수 — 신규 컬럼은 반드시 `DEFAULT` 값 지정

### Git
- [ ] 커밋 메시지 형식: `feat/fix/refactor/docs: 한국어 설명`
- [ ] 작업 완료 후 반드시 `git push origin main`

### 환경 분리
- [ ] 로컬 슬랙 채널과 NAS 운영 슬랙 채널 분리 (DB에서 사용자별 관리)
- [ ] `.env`에 민감 정보 직접 하드코딩 금지 — DB 또는 환경변수로 관리

---

## 완료된 개발 내역

### 슬랙 알림 시스템

| 커밋 | 내용 |
|------|------|
| `beebc47` | 슬랙 신규 주문 알림 기능 추가 |
| `7249755` | 슬랙 알림 개선 - 오늘 판매현황 총계 표시 + 즉시 발송 API 추가 |
| `fd187c4` | [임시] 신규 주문 없을 때도 현황 발송 (폴링 동작 확인용) |
| `235d375` | 슬랙 웹훅 URL 사용자별 DB 관리로 변경 (`slack_webhooks` 테이블) |
| `44d705c` | 슬랙 웹훅 핸들러 user_id 타입 단언 오류 수정 |
| `99047c2` | 폴링 간격 사용자별 DB 관리 및 슬랙 알림 탭 UI 추가 |
| `03daf9c` | 신규 주문 없을 때 슬랙 발송 로직 주석 처리 (주문 있을 때만 발송) |

**현재 슬랙 구조:**
- `slack_webhooks` 테이블: `id, user_id, name, webhook_url, enabled`
- `users.polling_interval_min`: 사용자별 폴링 간격 (기본 10분, 선택: 5/10/20/30/60분)
- 폴링 루프: 1분 ticker + 사용자별 `lastRun` 맵으로 간격 경과 시만 실행
- 프로필 → 슬랙 알림 탭: 웹훅 목록/추가/삭제/활성토글 + 폴링 간격 설정

### 주문 관리 화면

| 커밋 | 내용 |
|------|------|
| `49b3d2d` | 시간 단위 그래프 - 오늘 조회 시 현재 KST 시간까지만 표시 |
| `06c489f` | 주문관리 검색조건 - 상품명 멀티셀렉트 드롭다운으로 변경 |
| `86fb981` | 그래프 Y축 항상 만원 단위로 고정 |
| `71f5775` | 모바일 카드형 레이아웃 추가, PC에서 주문번호/판매금액 컬럼 제거 |
| `d9a05e0` | 모바일 헤더 개선 및 X축 라벨 간격 자동 조절 (모바일 전용) |
| `c056da1` | 모바일 UI 개선 - 날짜 한줄/버튼 4열 그리드/통계 3열 압축 |
| `2485d62` | 오늘/어제 버튼 클릭시 시간 뷰 자동 전환, 모바일 시간축 3시간 단위 |
| `3905199` | 날짜 검색 PC/모바일 레이아웃 완전 분리 (`md:hidden` / `hidden md:block`) |

### 폴링 안정화

| 커밋 | 내용 |
|------|------|
| `5869f0d` | 폴링 30분→10분 변경, 정각 기준 실행 |
| `97ad594` | 폴링 루프 구조 수정 |
| `4c2ef2f` | 정각 대기 후 즉시 1회 실행, 이후 반복 |
| `65a785d` | 폴링 API 호출을 `GetOrders`로 통일 (동기화 버튼과 동일한 로직) |

---

## DB 스키마 현황

```
users
  - id, email, password, phone, vendor_id, access_key, secret_key
  - name_ko, name_en, zipcode, address_ko/en, address_detail_ko/en
  - customs_type, customs_number
  - polling_interval_min (DEFAULT 10)
  - created_at, updated_at

slack_webhooks
  - id, user_id, name, webhook_url, enabled, created_at

orders
  - id, user_id, order_id, paid_at, synced_at

order_items
  - id, user_id, order_id, vendor_item_id, product_name
  - sales_quantity, unit_price, sales_price

products / product_items / inventory / returns / sync_status
order_sync_ranges / batch_jobs / batch_logs
```

---

## 주요 API 엔드포인트

| 메서드 | 경로 | 설명 |
|--------|------|------|
| GET | `/api/slack/webhooks` | 웹훅 목록 조회 |
| POST | `/api/slack/webhooks` | 웹훅 추가 |
| PUT | `/api/slack/webhooks/:id` | 웹훅 수정 (이름/URL/활성여부) |
| DELETE | `/api/slack/webhooks/:id` | 웹훅 삭제 |
| GET | `/api/slack/settings` | 폴링 간격 조회 |
| PUT | `/api/slack/settings` | 폴링 간격 저장 |
| POST | `/api/slack/send-today` | 오늘 주문 현황 즉시 발송 |

---

## 알려진 임시 처리 / 향후 과제

- `main.go` 폴링 내 "신규 주문 없음" 슬랙 발송 블록 → 주석 처리됨, 필요 시 재활성화
- `main.go` 주석: `// startOrderPolling: 30분마다...` → 실제는 사용자별 간격, 주석 업데이트 필요
- 이메일 인증으로 비밀번호 초기화 기능 → UI만 존재, 미구현 (준비 중)
