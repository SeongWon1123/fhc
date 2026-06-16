# 오픈소스 라이선스 증빙 템플릿

목적: FitConnect MVP가 사용하는 오픈소스 의존성의 출처, 라이선스, 고지 의무, 소스공개 의무를 등록/임치 전에 확인한다.

## 1. 자동 목록 생성

```powershell
.\scripts\ip\Generate-IpEvidencePackage.ps1
```

생성 파일:

- `docs/legal/evidence/dependency_inventory.csv`
- `docs/legal/evidence/open_source_license_evidence.md`

자동 생성 목록은 의존성 이름과 선언 범위를 모으는 용도다. 실제 라이선스명, 라이선스 원문, NOTICE 요구사항은 팀이 공식 패키지 저장소, npm/PyPI, GitHub, 패키지 파일에서 직접 확인한다.

## 2. 라이선스 검토 테이블

| 패키지/자료 | 생태계 | 버전/범위 | 사용 위치 | 라이선스 | 출처 URL | 고지 의무 | 소스공개/수정공개 의무 | 검토 상태 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `[react]` | `npm` | `[ ]` | `apps/web` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[미확인/확인]` |
| `[expo]` | `npm` | `[ ]` | `apps/mobile` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[미확인/확인]` |
| `[fastapi]` | `pip` | `[ ]` | `services/api-fastapi` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[미확인/확인]` |

## 3. 제3자 서비스/모델/데이터

| 항목 | 사용 위치 | 권리/약관 확인 | 등록 대상 포함 여부 | 비고 |
| --- | --- | --- | --- | --- |
| Supabase | 서버/클라이언트 인증 및 DB | `[ ]` | `[제외/설명만 포함]` | 서비스 자체는 팀 저작물 아님 |
| Redis | 캐시 | `[ ]` | `[제외/설명만 포함]` | |
| Ollama | 로컬 LLM 실행 | `[ ]` | `[제외/설명만 포함]` | 모델 라이선스 별도 확인 |
| LLM 모델 | 식단/운동 응답 | `[ ]` | `[제외/설명만 포함]` | 모델별 라이선스 필요 |
| 이미지/아이콘/폰트 | Web/Mobile assets | `[ ]` | `[포함/제외]` | 출처 확인 |
| RAG seed 문서 | `infra/supabase/rag_seed.sql` | `[ ]` | `[포함/제외]` | 제3자 문서 여부 확인 |

## 4. 고지 파일 초안

제품 또는 임치 패키지에 포함할 `THIRD_PARTY_NOTICES.md` 초안:

```markdown
# Third Party Notices

This product includes open source software components. Each component remains governed by its own license.

| Component | Version | License | Source |
| --- | --- | --- | --- |
| [name] | [version] | [license] | [url] |
```

## 5. 위험 플래그

다음 항목이 있으면 제출 전 책임자 검토가 필요하다.

- `[ ]` GPL/AGPL/LGPL/MPL/EPL 등 소스공개 또는 파일 단위 공개 의무가 있는 라이선스
- `[ ]` 라이선스가 확인되지 않은 패키지
- `[ ]` 개인 또는 기업이 임의 배포한 코드 조각
- `[ ]` 이미지, 폰트, 아이콘의 상업적 사용 제한
- `[ ]` 모델 가중치 또는 데이터셋의 재배포 제한
- `[ ]` 특허 조항, 상표 사용 제한, attribution 요구사항

## 6. 최종 확인

- `[ ]` 모든 npm/pip 의존성에 라이선스와 출처 URL을 기록했다.
- `[ ]` 배포물/임치물에 포함되는 라이선스 원문 또는 링크를 보관했다.
- `[ ]` 등록 대상 설명에서 오픈소스와 외부 모델을 팀 창작물로 표현하지 않았다.
- `[ ]` 고지 의무가 있는 항목은 `THIRD_PARTY_NOTICES.md` 또는 동등한 문서에 반영했다.
- `[ ]` 라이선스 미확인 항목은 제거, 대체, 또는 별도 승인 처리했다.
