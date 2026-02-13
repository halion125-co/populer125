# 🚀 빠른 시작 가이드

NAS에 RocketGrowth를 배포하기 위한 빠른 시작 가이드입니다.

## ⚡ 3단계로 배포하기

### 1단계: 파일 전송

Windows Git Bash에서:

```bash
# 간단한 배포 스크립트 실행
./deploy-simple.sh
```

또는 수동으로:

```bash
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'data/*.db' \
  ./ halion@172.30.1.27:/volume1/docker/populer125/
```

### 2단계: NAS 접속

```bash
ssh halion@172.30.1.27
cd /volume1/docker/populer125
```

### 3단계: Docker 실행

```bash
# 컨테이너 중지 (기존에 실행 중이면)
docker-compose -f docker-compose.prod.yml down

# 이미지 빌드
docker-compose -f docker-compose.prod.yml build --no-cache

# 컨테이너 시작
docker-compose -f docker-compose.prod.yml up -d

# 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f
```

## ✅ 접속 확인

### 로컬 네트워크
- Frontend: http://172.30.1.27:8080
- Backend API: http://172.30.1.27:8000
- Health Check: http://172.30.1.27:8000/api/health

### 도메인 (역방향 프록시 설정 후)
- Frontend: https://halion125.synology.me
- Backend API: https://api.halion125.synology.me

## 🔧 유용한 명령어

```bash
# 컨테이너 재시작
docker-compose -f docker-compose.prod.yml restart

# 로그 실시간 확인
docker-compose -f docker-compose.prod.yml logs -f

# 특정 서비스 로그
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend

# 컨테이너 중지
docker-compose -f docker-compose.prod.yml down

# 리소스 사용량 확인
docker stats populer125_backend populer125_frontend
```

## 📚 더 자세한 정보

- [전체 배포 가이드](docs/DEPLOYMENT.md)
- [README](README.md)

## 🆘 문제 해결

### 빌드 실패 시

```bash
# Docker 캐시 정리
docker system prune -a

# 재빌드
docker-compose -f docker-compose.prod.yml build --no-cache
```

### 포트 충돌 시

```bash
# 사용 중인 포트 확인
netstat -tuln | grep 8000
netstat -tuln | grep 8080
```

### 데이터베이스 문제

```bash
# 데이터 백업
cp -r ./data ./data.backup

# 데이터베이스 재생성
rm ./data/app.db
docker-compose -f docker-compose.prod.yml restart backend
```
