#!/bin/bash

# RocketGrowth NAS 배포 스크립트

NAS_HOST="172.30.1.27"
NAS_USER="halion"
SSH_KEY="$HOME/.ssh/nas_key"
DEPLOY_PATH="/volume2/docker/populer125"

echo "🚀 NAS 배포 시작..."

ssh -i "$SSH_KEY" "$NAS_USER@$NAS_HOST" "
  cd $DEPLOY_PATH &&
  git pull &&
  PATH=/usr/local/bin:\$PATH /usr/local/bin/docker-compose -f docker-compose.prod.yml build --no-cache &&
  PATH=/usr/local/bin:\$PATH /usr/local/bin/docker-compose -f docker-compose.prod.yml up -d &&
  PATH=/usr/local/bin:\$PATH /usr/local/bin/docker-compose -f docker-compose.prod.yml ps
"

echo ""
echo "✅ 배포 완료!"
echo "Frontend: http://$NAS_HOST:8080"
echo "Backend:  http://$NAS_HOST:8000"
