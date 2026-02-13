# ✅ 배포 체크리스트

NAS 배포 전 확인해야 할 사항들입니다.

## 📋 배포 전 준비사항

### NAS 환경
- [ ] Synology NAS Docker 패키지 설치 확인
- [ ] SSH 접속 활성화 (포트 22)
- [ ] 배포 디렉토리 생성 (`/volume1/docker/populer125`)
- [ ] 충분한 저장 공간 확인 (최소 5GB)

### 로컬 환경
- [ ] Git Bash 또는 WSL 설치 (Windows)
- [ ] rsync 사용 가능 확인
- [ ] SSH 키 설정 (비밀번호 없이 접속)

### 환경 변수
- [ ] `.env.prod` 파일 생성
- [ ] `JWT_SECRET` 강력한 값으로 변경
- [ ] 쿠팡 API 키 확인
- [ ] 데이터베이스 경로 확인

## 🚀 배포 단계

### 1. 파일 전송
- [ ] 불필요한 파일 제외 확인 (node_modules, .git 등)
- [ ] rsync로 NAS에 파일 전송
- [ ] 파일 권한 확인

### 2. Docker 빌드
- [ ] docker-compose.prod.yml 파일 확인
- [ ] 이미지 빌드 성공 확인
- [ ] 빌드 로그에서 오류 없는지 확인

### 3. 컨테이너 실행
- [ ] 기존 컨테이너 정상 종료
- [ ] 새 컨테이너 시작
- [ ] 컨테이너 상태 확인 (running)
- [ ] Health check 통과 확인

### 4. 접속 테스트
- [ ] Backend health check: `http://172.30.1.27:8000/api/health`
- [ ] Frontend 접속: `http://172.30.1.27:8080`
- [ ] 로그인 기능 테스트
- [ ] API 호출 테스트

## 🔐 보안 체크리스트

### 환경 변수
- [ ] `.env.prod` 파일이 Git에 포함되지 않음
- [ ] 프로덕션용 `JWT_SECRET` 사용
- [ ] 파일 권한 설정 (`chmod 600 .env.prod`)

### 네트워크
- [ ] NAS 방화벽 설정 확인
- [ ] 필요한 포트만 개방
- [ ] SSL/TLS 인증서 설정 (외부 접속 시)

### 데이터
- [ ] 데이터베이스 백업 스크립트 설정
- [ ] 정기 백업 스케줄 설정
- [ ] 백업 저장 위치 확인

## 🌐 도메인 및 SSL (선택사항)

### 역방향 프록시 설정
- [ ] Frontend: `halion125.synology.me` → `localhost:8080`
- [ ] Backend: `api.halion125.synology.me` → `localhost:8000`
- [ ] HTTPS 리디렉션 설정

### SSL 인증서
- [ ] Let's Encrypt 인증서 발급
- [ ] 자동 갱신 설정
- [ ] 인증서 적용 확인

## 🤖 GitHub Actions (선택사항)

### Secrets 설정
- [ ] `NAS_HOST` 설정
- [ ] `NAS_USER` 설정
- [ ] `NAS_SSH_PRIVATE_KEY` 설정
- [ ] `DEPLOY_PATH` 설정

### 워크플로우 테스트
- [ ] 수동 실행 테스트
- [ ] Push 시 자동 배포 확인
- [ ] 배포 실패 시 알림 설정

## 📊 모니터링

### 로그
- [ ] 컨테이너 로그 확인 방법 숙지
- [ ] 로그 로테이션 설정
- [ ] 에러 로그 모니터링

### 리소스
- [ ] CPU/메모리 사용량 모니터링
- [ ] 디스크 사용량 확인
- [ ] 네트워크 트래픽 모니터링

## 🆘 비상 대응

### 롤백 계획
- [ ] 이전 버전 이미지 보관
- [ ] 데이터베이스 백업 확인
- [ ] 빠른 롤백 스크립트 준비

### 문제 해결
- [ ] 일반적인 문제 해결 방법 숙지
- [ ] 로그 분석 방법 확인
- [ ] 지원 연락처 확보

## 📝 배포 후 작업

### 검증
- [ ] 모든 기능 정상 작동 확인
- [ ] 성능 테스트
- [ ] 보안 취약점 스캔

### 문서화
- [ ] 배포 일시 기록
- [ ] 변경 사항 문서화
- [ ] 문제 및 해결 방법 기록

### 팀 공유
- [ ] 배포 완료 알림
- [ ] 접속 정보 공유
- [ ] 변경 사항 설명

---

## 💡 유용한 명령어 모음

```bash
# 빠른 배포
./deploy-simple.sh

# 상태 확인
docker-compose -f docker-compose.prod.yml ps

# 로그 확인
docker-compose -f docker-compose.prod.yml logs -f

# 재시작
docker-compose -f docker-compose.prod.yml restart

# 완전 재배포
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml build --no-cache
docker-compose -f docker-compose.prod.yml up -d

# 백업
cp -r ./data ./data.backup.$(date +%Y%m%d_%H%M%S)

# 정리
docker system prune -a
```

---

## 📞 지원

문제가 발생하면:
1. [문제 해결 가이드](docs/DEPLOYMENT.md#문제-해결) 확인
2. [GitHub Issues](https://github.com/halion125-co/populer125/issues) 생성
3. 로그와 함께 상세 정보 제공
