# RocketGrowth Console

쿠팡 판매자를 위한 통합 관리 콘솔

## 주요 기능

- 🔐 **다중 계정 관리**: 여러 쿠팡 판매자 계정 연동 및 전환
- 📦 **재고 관리**: 실시간 재고 현황 조회, 수정, 이력 추적
- 📊 **판매 현황**: 일별 판매량 및 통계 대시보드
- 📋 **주문 관리**: 주문 목록 조회 및 상태 관리
- 🔔 **알림 시스템**: 재고 변경 및 부족 알림

## 기술 스택

### Frontend
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite
- **Styling**: Tailwind CSS
- **Routing**: TanStack Router
- **State Management**: TanStack Query
- **Charts**: Recharts

### Backend
- **Language**: Go 1.22
- **Framework**: Echo
- **Database**: SQLite
- **Authentication**: API Key + JWT

### Infrastructure
- **Container**: Docker + Docker Compose
- **Hot Reload**: air (Backend), Vite HMR (Frontend)

## 개발 환경 구성

### 사전 요구사항

- Docker 및 Docker Compose
- Node.js 20+ (로컬 개발 시)
- Go 1.22+ (로컬 개발 시)

### 빠른 시작

1. **환경 변수 설정**
   ```bash
   cp .env.example .env
   # .env 파일에서 쿠팡 API 키 설정
   ```

2. **Docker Compose로 실행**
   ```bash
   docker-compose up
   ```

3. **접속**
   - Frontend: http://localhost:5173
   - Backend API: http://localhost:8000
   - Health Check: http://localhost:8000/api/health

### 로컬 개발 (Docker 없이)

#### Frontend
```bash
cd frontend
npm install
npm run dev
```

#### Backend
```bash
cd backend
go mod download
go run main.go
```

## 프로젝트 구조

```
rocketgrowth/
├── frontend/              # React 프론트엔드
│   ├── src/
│   │   ├── routes/       # TanStack Router 라우트
│   │   ├── components/   # 재사용 가능한 컴포넌트
│   │   ├── lib/          # API 클라이언트, 유틸리티
│   │   └── main.tsx      # 엔트리 포인트
│   ├── Dockerfile.dev    # 개발용 Dockerfile
│   ├── Dockerfile        # 프로덕션용 Dockerfile
│   └── package.json
│
├── backend/              # Go 백엔드
│   ├── cmd/             # 메인 애플리케이션
│   ├── internal/        # 내부 패키지
│   │   ├── handlers/    # HTTP 핸들러
│   │   ├── database/    # DB 연결 및 쿼리
│   │   ├── models/      # 데이터 모델
│   │   ├── middleware/  # 미들웨어
│   │   └── coupang/     # 쿠팡 API 클라이언트
│   ├── migrations/      # DB 마이그레이션
│   ├── Dockerfile.dev   # 개발용 Dockerfile
│   ├── Dockerfile       # 프로덕션용 Dockerfile
│   ├── .air.toml        # air 설정
│   └── go.mod
│
├── data/                # SQLite 데이터베이스 파일
├── docs/                # 문서
│   ├── prd-prep.md      # PRD 준비 문서
│   └── api/             # API 스펙
│
├── docker-compose.yml   # Docker Compose 설정
├── .env.example         # 환경 변수 예시
└── README.md

```

## API 문서

### 주요 엔드포인트

#### 인증
- `POST /api/auth/login` - 로그인 (API Key 검증)
- `POST /api/auth/accounts` - 쿠팡 계정 연동

#### 재고 관리
- `GET /api/inventory` - 재고 목록 조회
- `GET /api/inventory/:id` - 재고 상세 조회
- `PUT /api/inventory/:id` - 재고 수정
- `GET /api/inventory/:id/history` - 재고 이력 조회

#### 판매 현황
- `GET /api/sales/daily` - 일별 판매량 조회
- `GET /api/sales/stats` - 판매 통계

#### 주문 관리
- `GET /api/orders` - 주문 목록 조회
- `GET /api/orders/:id` - 주문 상세 조회

자세한 API 스펙은 [API 문서](docs/api/)를 참고하세요.

## 개발 가이드

### 코드 스타일 (Agentic Coding 원칙)

- **단순성 우선**: 복잡한 추상화 회피
- **명시적 타입**: TypeScript, Go의 타입 시스템 활용
- **Plain SQL**: ORM 대신 명시적 SQL 쿼리
- **에러 처리**: 명시적 에러 반환 및 처리

### Git Workflow

```bash
# Feature 브랜치 생성
git checkout -b feature/inventory-management

# 커밋
git add .
git commit -m "feat: add inventory list page"

# Push
git push origin feature/inventory-management
```

### 테스트

#### Frontend
```bash
cd frontend
npm run test
```

#### Backend
```bash
cd backend
go test ./...
```

## 배포

### 프로덕션 빌드

```bash
docker-compose -f docker-compose.prod.yml up -d
```

### 데이터 백업

```bash
# SQLite 파일 백업
cp ./data/rocketgrowth.db ./backups/$(date +%Y%m%d_%H%M%S).db
```

## 라이선스

MIT License

## 문의

프로젝트 관련 문의: [GitHub Issues](https://github.com/yourorg/rocketgrowth/issues)
