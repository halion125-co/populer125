# 🚀 RocketGrowth NAS 배포 가이드

Synology NAS에 Docker Compose를 통해 RocketGrowth를 배포하는 가이드입니다.

## 📋 목차

- [사전 준비](#사전-준비)
- [NAS 환경 설정](#nas-환경-설정)
- [수동 배포](#수동-배포)
- [자동 배포 (GitHub Actions)](#자동-배포-github-actions)
- [도메인 및 SSL 설정](#도메인-및-ssl-설정)
- [문제 해결](#문제-해결)

---

## 사전 준비

### 1. NAS 정보
- **주소**: http://172.30.1.27:5003/#/signin
- **계정**: halion / eu125love!
- **NPM 레지스트리**: https://halion125.synology.me/
- **GitHub**: https://github.com/halion125-co/populer125

### 2. 필요한 소프트웨어
- Synology NAS에 Docker 패키지 설치
- SSH 접속 활성화
- Git (선택사항)

---

## NAS 환경 설정

### 1. SSH 접속 활성화

Synology DSM에서:
1. **제어판** → **터미널 및 SNMP**
2. **SSH 서비스 활성화** 체크
3. 포트: 22 (기본값)

### 2. Docker 설치

1. **패키지 센터**에서 **Docker** 검색 및 설치
2. Docker Compose가 자동으로 포함됨

### 3. 배포 디렉토리 생성

SSH로 NAS 접속 후:

```bash
ssh halion@172.30.1.27

# 배포 디렉토리 생성
mkdir -p /volume1/docker/populer125
cd /volume1/docker/populer125
```

---

## 수동 배포

### 방법 1: 배포 스크립트 사용 (권장)

로컬 개발 환경(Windows Git Bash)에서:

```bash
# 간단한 배포 스크립트 실행
./deploy-simple.sh
```

그 후 NAS에 SSH 접속하여:

```bash
ssh halion@172.30.1.27
cd /volume1/docker/populer125

# Docker Compose 실행
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 상태 확인
docker-compose -f docker-compose.prod.yml ps
docker-compose -f docker-compose.prod.yml logs -f
```

### 방법 2: 직접 파일 전송

#### Windows에서 rsync 사용

```bash
# Git Bash에서 실행
rsync -avz --progress \
  --exclude 'node_modules' \
  --exclude '.git' \
  --exclude 'data/*.db' \
  --exclude 'bin' \
  ./ halion@172.30.1.27:/volume1/docker/populer125/
```

#### 또는 WinSCP/FileZilla 사용

GUI 도구로 파일을 직접 전송

---

## 자동 배포 (GitHub Actions)

### 1. GitHub Secrets 설정

GitHub 리포지토리에서:
- **Settings** → **Secrets and variables** → **Actions**
- 다음 secrets 추가:

| Secret 이름 | 값 |
|------------|-----|
| `NAS_HOST` | `172.30.1.27` |
| `NAS_USER` | `halion` |
| `NAS_SSH_PRIVATE_KEY` | SSH 개인키 내용 |
| `DEPLOY_PATH` | `/volume1/docker/populer125` |

### 2. SSH 키 생성 (아직 없는 경우)

로컬에서:

```bash
# SSH 키 생성
ssh-keygen -t ed25519 -C "github-actions-deploy"

# 공개키를 NAS에 복사
ssh-copy-id halion@172.30.1.27

# 개인키 내용을 GitHub Secrets에 등록
cat ~/.ssh/id_ed25519
```

### 3. 자동 배포 실행

이제 `main` 브랜치에 push하면 자동으로 배포됩니다:

```bash
git add .
git commit -m "feat: update feature"
git push origin main
```

---

## 도메인 및 SSL 설정

### 1. Synology 역방향 프록시 설정

DSM에서:
1. **제어판** → **로그인 포털** → **고급** → **역방향 프록시**
2. **생성** 클릭

#### Frontend 설정
- **설명**: RocketGrowth Frontend
- **소스**:
  - 프로토콜: HTTPS
  - 호스트 이름: halion125.synology.me
  - 포트: 443
- **대상**:
  - 프로토콜: HTTP
  - 호스트 이름: localhost
  - 포트: 8080

#### Backend API 설정
- **설명**: RocketGrowth API
- **소스**:
  - 프로토콜: HTTPS
  - 호스트 이름: api.halion125.synology.me
  - 포트: 443
- **대상**:
  - 프로토콜: HTTP
  - 호스트 이름: localhost
  - 포트: 8000

### 2. SSL 인증서 설정

Let's Encrypt를 통한 무료 SSL 인증서:

1. **제어판** → **보안** → **인증서**
2. **추가** → **새 인증서 추가**
3. **Let's Encrypt에서 인증서 받기**
4. 도메인 입력: `halion125.synology.me`, `api.halion125.synology.me`

---

## 서비스 접속

배포 완료 후:

- **Frontend**: https://halion125.synology.me
- **Backend API**: https://api.halion125.synology.me
- **Health Check**: https://api.halion125.synology.me/api/health

또는 로컬 네트워크에서:

- **Frontend**: http://172.30.1.27:8080
- **Backend API**: http://172.30.1.27:8000
- **Health Check**: http://172.30.1.27:8000/api/health

---

## 문제 해결

### 컨테이너가 시작되지 않는 경우

```bash
# 로그 확인
docker-compose -f docker-compose.prod.yml logs

# 특정 서비스 로그
docker-compose -f docker-compose.prod.yml logs backend
docker-compose -f docker-compose.prod.yml logs frontend
```

### 포트 충돌

```bash
# 사용 중인 포트 확인
netstat -tuln | grep 8000
netstat -tuln | grep 8080

# 충돌 시 docker-compose.prod.yml에서 포트 변경
```

### 빌드 실패

```bash
# 캐시 없이 재빌드
docker-compose -f docker-compose.prod.yml build --no-cache

# 이전 이미지 정리
docker system prune -a
```

### 데이터베이스 초기화

```bash
# 데이터 디렉토리 백업
cp -r ./data ./data.backup.$(date +%Y%m%d_%H%M%S)

# 데이터베이스 재생성
rm ./data/app.db
docker-compose -f docker-compose.prod.yml restart backend
```

### NPM 빌드 오류

Frontend 빌드 시 NPM 레지스트리 설정:

```bash
# .npmrc 파일 생성
echo "registry=https://halion125.synology.me/" > frontend/.npmrc
```

---

## 백업 및 복구

### 정기 백업

```bash
# 백업 스크립트
#!/bin/bash
BACKUP_DIR="/volume1/backups/populer125"
DATE=$(date +%Y%m%d_%H%M%S)

mkdir -p $BACKUP_DIR

# 데이터베이스 백업
cp -r /volume1/docker/populer125/data $BACKUP_DIR/data_$DATE

# 7일 이상 된 백업 삭제
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;
```

### 복구

```bash
# 백업에서 복구
cd /volume1/docker/populer125
docker-compose -f docker-compose.prod.yml down
cp -r /volume1/backups/populer125/data_20260213_100000 ./data
docker-compose -f docker-compose.prod.yml up -d
```

---

## 모니터링

### Docker 리소스 모니터링

```bash
# 컨테이너 리소스 사용량
docker stats populer125_backend populer125_frontend

# 디스크 사용량
docker system df
```

### 로그 모니터링

```bash
# 실시간 로그 확인
docker-compose -f docker-compose.prod.yml logs -f

# 최근 100줄
docker-compose -f docker-compose.prod.yml logs --tail=100
```

---

## 유지보수

### 컨테이너 재시작

```bash
docker-compose -f docker-compose.prod.yml restart
```

### 이미지 업데이트

```bash
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d
```

### 컨테이너 완전 제거

```bash
docker-compose -f docker-compose.prod.yml down -v
```

---

## 보안 권장사항

1. **.env.prod 파일 보안**
   - 프로덕션 환경에서는 강력한 `JWT_SECRET` 사용
   - 파일 권한: `chmod 600 .env.prod`

2. **방화벽 설정**
   - NAS 방화벽에서 필요한 포트만 개방
   - 8000, 8080 포트는 내부 네트워크만 허용

3. **SSL/TLS 사용**
   - 외부 접속은 반드시 HTTPS 사용
   - Let's Encrypt 자동 갱신 설정

4. **정기 업데이트**
   - Docker 이미지 정기 업데이트
   - 보안 패치 적용

---

## 추가 자료

- [Docker Compose 문서](https://docs.docker.com/compose/)
- [Synology Docker 가이드](https://www.synology.com/ko-kr/dsm/packages/Docker)
- [GitHub Actions 문서](https://docs.github.com/en/actions)
