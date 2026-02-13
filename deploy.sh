#!/bin/bash

# RocketGrowth NAS 배포 스크립트
# Synology NAS에 Docker Compose를 통해 배포

set -e

echo "🚀 RocketGrowth 배포 시작..."

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# NAS 접속 정보
NAS_HOST="172.30.1.27"
NAS_USER="halion"
NAS_PORT="22"
DEPLOY_PATH="/volume1/docker/populer125"

# 배포 모드 확인
MODE=${1:-prod}

echo -e "${GREEN}배포 모드: ${MODE}${NC}"

# 1. 로컬에서 빌드 (선택사항 - NAS에서 직접 빌드할 수도 있음)
echo -e "${YELLOW}Step 1: 로컬 빌드 건너뛰기 (NAS에서 빌드)${NC}"

# 2. 파일 동기화
echo -e "${YELLOW}Step 2: NAS로 파일 전송...${NC}"
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'data/*.db' \
  --exclude 'bin' \
  --exclude 'frontend/dist' \
  --exclude 'backend/server' \
  -e "ssh -p ${NAS_PORT}" \
  ./ ${NAS_USER}@${NAS_HOST}:${DEPLOY_PATH}/

echo -e "${GREEN}파일 전송 완료!${NC}"

# 3. NAS에서 Docker Compose 실행
echo -e "${YELLOW}Step 3: NAS에서 Docker Compose 실행...${NC}"
ssh -p ${NAS_PORT} ${NAS_USER}@${NAS_HOST} << 'ENDSSH'
cd /volume1/docker/populer125

# 기존 컨테이너 중지 및 제거
echo "기존 컨테이너 중지 중..."
docker-compose -f docker-compose.prod.yml down

# 새 이미지 빌드 및 컨테이너 시작
echo "새 이미지 빌드 중..."
docker-compose -f docker-compose.prod.yml build --no-cache

echo "컨테이너 시작 중..."
docker-compose -f docker-compose.prod.yml up -d

# 컨테이너 상태 확인
echo "컨테이너 상태:"
docker-compose -f docker-compose.prod.yml ps

# 로그 확인
echo "최근 로그:"
docker-compose -f docker-compose.prod.yml logs --tail=50
ENDSSH

echo -e "${GREEN}✅ 배포 완료!${NC}"
echo -e "${GREEN}Frontend: http://172.30.1.27:8080${NC}"
echo -e "${GREEN}Backend API: http://172.30.1.27:8000${NC}"
echo -e "${GREEN}Health Check: http://172.30.1.27:8000/api/health${NC}"
