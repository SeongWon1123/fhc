# 소스코드 패키지 인벤토리 템플릿

목적: 저작권 등록 복제물, SW임치물, 기술자료 임치물에 포함되는 소스코드와 설명자료를 명확히 기록한다.

## 1. 패키지 메타데이터

| 항목 | 작성값 |
| --- | --- |
| 패키지명 | `[예: fitconnect-mvp-v0.1.0-source-escrow]` |
| 생성일 | `[YYYY-MM-DD HH:mm KST]` |
| 생성 책임자 | `[이름/역할]` |
| 기준 저장소 | `food+health+clothes` |
| 기준 커밋/태그 | `[ ]` |
| 압축파일명 | `[ ]` |
| 압축파일 SHA-256 | `[ ]` |
| 보관 위치 | `[내부 드라이브/USB/기관 제출번호]` |

## 2. 포함 범위

| 경로 | 포함 여부 | 이유 |
| --- | --- | --- |
| `apps/mobile` | `[ ]` | Expo 모바일 앱 |
| `apps/web` | `[ ]` | React/Vite 관리자 웹 |
| `services/api-fastapi` | `[ ]` | FastAPI Core API |
| `services/api-node` | `[ ]` | Node.js BFF |
| `infra/supabase` | `[ ]` | DB 스키마, seed, RAG seed |
| `nginx` | `[ ]` | 배포 라우팅 구성 |
| `docker-compose.yml` | `[ ]` | 로컬/배포 재현 구성 |
| `README.md`, `docs/DEPLOYMENT.md` | `[ ]` | 빌드/실행 설명 |
| `docs/legal/evidence/*` | `[ ]` | 해시/증거 인벤토리 |

## 3. 제외 범위

| 제외 항목 | 이유 | 확인 |
| --- | --- | --- |
| `.git` | 내부 이력 전체는 별도 증거로 보관, 임치물에는 필요 범위만 포함 | `[ ]` |
| `.env`, `.env.local`, 운영 비밀값 | 비밀정보/운영 권한 노출 방지 | `[ ]` |
| `node_modules`, `venv`, 빌드 산출물 | 오픈소스/생성물, 재현 가능 | `[ ]` |
| 사용자 개인정보/실서비스 로그 | 개인정보 및 보안 위험 | `[ ]` |
| 외부 비공개 자료 | 권리 미확정 | `[ ]` |

## 4. 자동 생성 인벤토리

스크립트 실행:

```powershell
.\scripts\ip\Generate-IpEvidencePackage.ps1
```

기본 산출물:

| 산출물 | 설명 |
| --- | --- |
| `docs/legal/evidence/source_package_inventory.csv` | 파일 경로, 크기, 수정시각, SHA-256 |
| `docs/legal/evidence/hash_manifest.sha256` | 해시 검증용 매니페스트 |
| `docs/legal/evidence/dependency_inventory.csv` | `package.json`, `requirements.txt` 기반 의존성 목록 |
| `docs/legal/evidence/filing_snapshot.md` | 생성 시점, Git 상태, 제외 규칙, 공식 제출 전 확인사항 |

## 5. 수기 파일 인벤토리

자동 생성 CSV의 요약본을 아래에 붙인다.

| 상대 경로 | SHA-256 | 크기(bytes) | 설명 | 포함 근거 |
| --- | --- | --- | --- | --- |
| `[path]` | `[hash]` | `[size]` | `[ ]` | `[팀 창작/설정/문서]` |

## 6. 빌드/실행 재현 정보

| 영역 | 명령 | 비고 |
| --- | --- | --- |
| 전체 Compose | `docker compose config --quiet` | 환경변수는 샘플값 사용 |
| 전체 실행 | `.\deploy-local.ps1` | 운영 비밀값 없이 로컬 검증 |
| Web | `cd apps\web; npm install; npm run build` | Vite |
| Mobile | `cd apps\mobile; npm install; npx expo start` | Expo |
| Node BFF | `cd services\api-node; npm install; npm start` | `/health` 확인 |
| FastAPI | `cd services\api-fastapi; pip install -r requirements.txt; python -m compileall .` | `/health` 확인 |

## 7. 검증 체크

- `[ ]` 인벤토리 CSV 파일 수와 압축파일 내부 파일 수가 일치한다.
- `[ ]` 압축 후 해시를 계산했고 기록했다.
- `[ ]` 제출용 압축파일을 새 폴더에 풀어 빌드/실행 설명이 재현되는지 확인했다.
- `[ ]` 생성물에 비밀정보와 개인정보가 없음을 별도 검색했다.
- `[ ]` 오픈소스 라이선스 증빙 파일이 함께 보관된다.
