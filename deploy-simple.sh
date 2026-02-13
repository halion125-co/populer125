#!/bin/bash

# 간단한 배포 스크립트 (Windows Git Bash에서도 실행 가능)

# NAS 접속 정보
NAS_HOST="172.30.1.27"
NAS_USER="halion"
DEPLOY_PATH="/volume1/docker/populer125"

echo "🚀 파일을 NAS로 전송 중..."

# rsync 사용 (Git Bash에 포함됨)
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'data/*.db' \
  --exclude 'bin' \
  --exclude 'frontend/dist' \
  --exclude 'backend/server' \
  ./ ${NAS_USER}@${NAS_HOST}:${DEPLOY_PATH}/

echo "✅ 파일 전송 완료!"
echo ""
echo "다음 명령어로 NAS에 SSH 접속하여 배포를 완료하세요:"
echo "ssh ${NAS_USER}@${NAS_HOST}"
echo ""
echo "NAS에서 실행할 명령어:"
echo "cd ${DEPLOY_PATH}"
echo "docker-compose -f docker-compose.prod.yml down"
echo "docker-compose -f docker-compose.prod.yml build"
echo "docker-compose -f docker-compose.prod.yml up -d"
