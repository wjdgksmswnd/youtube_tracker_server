# YouTube Music Tracker (ODO) Server

YouTube Music 청취 시간과 통계를 추적하는 API 서버입니다.

## 개요

이 서버는 YouTube Music 트래커 Chrome 확장 프로그램과 함께 작동하여 사용자의 YouTube Music 청취 활동을 추적하고 저장합니다. 사용자는 승인된 플레이리스트 내 곡들을 들을 때 재생 기록을 서버에 저장하고, 이익을 공유할 수 있습니다.

## 주요 기능

- 사용자 인증 및 세션 관리
- 청취 기록 저장 및 조회
- 사용자 그룹 관리
- 권한 관리
- 통계 집계 및 보고서
- 플레이리스트 관리

## 기술 스택

- **백엔드**: Node.js, Express
- **데이터베이스**: PostgreSQL
- **인증**: JWT, 세션 기반 인증
- **보안**: PostgreSQL 내장 암호화 (pgcrypto)

## 프로젝트 구조

```
.
├── src/
│   ├── controllers/       # 컨트롤러 모듈
│   ├── db/                # 데이터베이스 연결 및 쿼리
│   ├── middleware/        # 미들웨어
│   ├── routes/            # API 라우터
│   ├── utils/             # 유틸리티 함수
│   ├── index.js           # 앱 진입점
├── logs/                  # 로그 파일
├── public/                # 정적 파일 (대시보드 UI)
├── .env                   # 환경 변수
├── .env.example           # 환경 변수 예시
├── package.json           # 프로젝트 정보 및 의존성
├── README.md              # 프로젝트 문서
```

## 설치 및 실행

### 사전 요구사항

- Node.js 14.x 이상
- PostgreSQL 12.x 이상
- pgcrypto 확장 모듈 활성화

### 설치 단계

1. 저장소 클론

```bash
git clone https://github.com/your-repo/odo-server.git
cd odo-server
```

2. 의존성 설치

```bash
npm install
```

3. 환경 변수 설정

`.env.example`을 복사하여 `.env` 파일 생성 후 적절한 값으로 수정

```bash
cp .env.example .env
```

4. 데이터베이스 설정

PostgreSQL에서 데이터베이스 생성 및 pgcrypto 확장 활성화

```sql
CREATE DATABASE odo_db;
\c odo_db;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
```

5. 데이터베이스 스키마 초기화

프로젝트 루트에 있는 `db.sql` 파일을 PostgreSQL에 import

```bash
psql -U postgres -d odo_db -f db.sql
```

6. 서버 실행

```bash
# 개발 모드
npm run dev

# 프로덕션 모드
npm start
```

## API 엔드포인트

### 인증 관련 API
- `POST /api/login` - 사용자 로그인
- `POST /api/session` - 새 세션 생성 (Chrome Extension용)
- `DELETE /api/session` - 세션 종료
- `GET /api/user/verify` - 토큰 검증

### 사용자 관련 API
- `POST /api/user/create` - 사용자 생성
- `POST /api/user/bulk-create` - 다수 사용자 생성
- `GET /api/user/list` - 사용자 목록 조회
- `PUT /api/user/:userId` - 사용자 정보 업데이트
- `PUT /api/user/:userId/password-reset` - 비밀번호 초기화
- `PUT /api/user/:userId/level` - 사용자 레벨 변경
- `PUT /api/user/:userId/group` - 사용자 그룹 변경
- `PUT /api/user/change-password` - 비밀번호 변경

### 청취 관련 API
- `POST /api/listening/event` - 청취 이벤트 전송 (재생, 일시정지 등)
- `POST /api/listening` - 청취 기록 저장
- `GET /api/listening/history` - 청취 기록 조회
- `GET /api/listening/recent` - 최근 청취 기록 조회

### 관리자 API
- `GET /api/admin/su` - 슈퍼유저 생성 페이지 (localhost에서만 접근 가능)
- `POST /api/admin/su/create` - 슈퍼유저 생성 (localhost에서만 접근 가능)

## 보안 기능

- JWT 토큰 기반 인증
- 세션 관리를 통한 중복 로그인 방지
- PostgreSQL의 pgcrypto 모듈을 사용한 비밀번호 암호화
- 관리자 기능은 localhost에서만 접근 가능
- 권한 기반 접근 제어

## 라이센스

© ODO Team. 모든 권리 보유.