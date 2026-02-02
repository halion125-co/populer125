# populer125 — Coupang RocketGrowth Console

로켓그로스 판매자 운영 콘솔(내부용) 프로젝트입니다.

- Frontend: React (Vite) + TypeScript + TanStack Query + React Router
- Backend: Python FastAPI (Coupang API proxy) + HMAC 서명 + 표준 에러 포맷
- Design: Figma 와이어프레임(SVG) — `docs/figma/rocketgrowth_figma_wireframes_svg.zip`

## Monorepo 구조

```
frontend/   # React 앱
backend/    # FastAPI 서버
docs/       # 설계/와이어프레임/아키텍처 문서
```

## 빠른 시작

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

환경변수:
- `COUPANG_ACCESS_KEY`
- `COUPANG_SECRET_KEY`
- `COUPANG_VENDOR_ID` (옵션: 기본 vendor)

### Frontend

```bash
cd frontend
npm install
npm run dev
```

기본적으로 프론트는 `VITE_API_BASE_URL=http://localhost:8000` 를 사용합니다.

## Git 워크플로

- main: 배포/안정
- develop: 통합
- feature/*: 기능 개발

## 참고
- `docs/architecture/api-contracts.md`: 프론트-백 내부 API 계약
- `docs/figma/*`: 와이어프레임
