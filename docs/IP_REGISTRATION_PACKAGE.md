# FitConnect 법적/IP 등록 준비 패키지

기준일: 2026-06-04
대상 저장소: `food+health+clothes`
대상 서비스: FitConnect MVP - 운동 코치 매칭, 식단 AI, 운동 종목별 의류 추천

이 문서는 팀 내부의 등록/임치 준비 작업용입니다. 외부 기관에 접수하거나 제출하지 않았으며, 실제 제출 전에는 대표자, 저작권자, 공동저작자, 학교/동아리 규정, 사업자 정보, 최신 수수료와 서식을 다시 확인해야 합니다.

## 1. 패키지 구성

| 파일 | 목적 |
| --- | --- |
| `docs/legal/01_software_copyright_registration_checklist.md` | 한국저작권위원회 저작권/컴퓨터프로그램저작물 등록 체크리스트 |
| `docs/legal/02_technology_escrow_checklist.md` | 한국저작권위원회 SW임치, 대·중소기업·농어업협력재단 기술자료임치센터, 기술보증기금 Tech Safe 임치 준비 체크리스트 |
| `docs/legal/03_authorship_evidence_template.md` | 팀원별 창작 기여, 커밋/회의/산출물 증거 정리 템플릿 |
| `docs/legal/04_source_code_package_inventory_template.md` | 소스코드 임치/등록용 패키지 인벤토리 템플릿 |
| `docs/legal/05_open_source_license_evidence_template.md` | 오픈소스 라이선스 증빙 및 고지 의무 검토 템플릿 |
| `docs/legal/06_filing_data_sheet.md` | 실제 신청 화면/서식에 옮겨 적을 데이터 시트 |
| `docs/legal/07_package_signoff_template.md` | 제출 전 내부 승인 및 비밀정보 제거 확인서 |
| `scripts/ip/Generate-IpEvidencePackage.ps1` | 현재 저장소 기준 해시 인벤토리와 의존성 목록 생성 스크립트 |

## 2. 공식 절차 기준 요약

| 목적 | 우선 검토 기관/시스템 | 공식 근거/포털 | 내부 준비 산출물 |
| --- | --- | --- | --- |
| 소프트웨어 저작권 등록 | 한국저작권위원회 저작권등록 시스템 | `https://www.copyright.or.kr/business/registration/index.do`, `https://www.cros.or.kr` | 등록대상 버전, 저작자/저작권자 데이터, 프로그램 설명, 복제물, 창작/공표 증거 |
| SW 소스코드 임치 | 한국저작권위원회 SW임치 시스템 | `https://www.copyright.or.kr/business/sw-deposit/index.do`, `https://www.swes.or.kr` | 임치신청서/계약서 입력자료, 임치물, 사업자등록증, 위임장 여부 |
| 기술자료 임치 | 대·중소기업·농어업협력재단 기술자료임치센터 | `https://www.kescrow.or.kr/tems/main/page.do` | 신규계약 신청자료, 임치물, 교부조건, 수수료/지원사업 확인 |
| 기술자료 임치/보유자 증명 | 기술보증기금 Tech Safe | `https://ts.kibo.or.kr/bailment/tbms01/TBMS010102Page.do` | 단독/다자간/3자간 계약 유형 결정, 임치물, 거래기업/사용권자 정보 |
| 임치기술 활용지원 | 중소벤처기업부 기술보호울타리 | `https://www.ultari.go.kr/portal/psi/techDataSub.do` | 임치 완료 후 활용지원 가능 여부, 중소기업 요건, 사업화 단계 증빙 |

## 3. 권장 진행 순서

1. 등록 대상 버전 고정
   - 제품명, 버전명, 릴리스 일자, 커밋/태그, 배포 범위를 확정한다.
   - 현재 저장소에는 `.env`가 있으므로 증거 패키지에는 비밀값을 포함하지 않는다.

2. 권리자와 저작자 확정
   - 팀원, 학교/동아리, 외주/멘토/코치, 데이터 제공자 등 권리 관계자를 모두 식별한다.
   - 공동저작, 업무상저작물, 양도/이용허락 여부는 제출 전 문서로 확인한다.

3. 증거 패키지 생성
   - `scripts/ip/Generate-IpEvidencePackage.ps1`를 실행하여 파일 해시, 인벤토리, 의존성 목록을 생성한다.
   - 생성물은 기본적으로 `docs/legal/evidence/`에 저장된다.

4. 오픈소스 라이선스 증빙 검토
   - Node, Python, Expo, React, FastAPI, Supabase 관련 의존성을 정리한다.
   - 각 라이선스 원문, 출처 URL, 고지/소스공개/상표/특허 조항을 확인한다.

5. 저작권 등록 데이터 시트 작성
   - `docs/legal/06_filing_data_sheet.md`의 저작권 등록 섹션을 작성한다.
   - 창작연월일과 공표연월일은 증빙자료와 일치해야 한다.

6. 임치 경로 선택
   - 소프트웨어 사용권자 보호 목적이면 한국저작권위원회 SW임치를 우선 검토한다.
   - 기술 유출 분쟁 대비, 거래처 교부조건, 보유자 증명 목적이면 기술자료임치센터 또는 KIBO Tech Safe를 검토한다.

7. 내부 승인
   - `docs/legal/07_package_signoff_template.md`를 이용해 비밀정보 제거, 권리자 동의, OSS 검토, 제출자료 일치 여부를 확인한다.

## 4. 제출 전 필수 확인

- 공식 사이트의 최신 서식, 수수료, 인증서/회원가입 요건을 확인했다.
- 등록 대상 프로그램명과 버전이 모든 문서에서 동일하다.
- 신청인, 저작자, 저작권자, 대리인 정보가 실제 제출자와 일치한다.
- 창작연월일, 공표연월일, 최초 배포/시연일을 증명할 수 있다.
- 소스 패키지에 `.env`, 토큰, API 키, DB 비밀번호, 개인정보, 제3자 비공개 자료가 없다.
- 오픈소스 라이선스 고지 파일과 의존성 목록이 최신이다.
- 임치물 압축파일의 해시값이 인벤토리와 일치한다.

## 5. 현재 남은 팀 입력 항목

- 신청 주체: 개인, 팀, 법인, 학교 산학협력단 중 누구인지.
- 저작자/저작권자: 팀원별 창작 지분 또는 권리 귀속 방식.
- 창작연월일과 공표연월일: 증빙 가능한 날짜.
- 등록 대상 범위: 모바일 앱, 관리자 웹, FastAPI, Node BFF, DB 스키마, AI 프롬프트/규칙, 디자인/문서 포함 여부.
- 임치 경로: KCC SW임치, 기술자료임치센터, KIBO Tech Safe 중 선택.
- 사용권자/거래기업 존재 여부: 3자 계약 또는 사용권자 등록 필요 여부.
- 사업자등록증, 대표자, 위임장, 공동인증서 준비 여부.

## 6. 참고 공식 출처

- 한국저작권위원회 저작권 등록: https://www.copyright.or.kr/business/registration/index.do
- 한국저작권위원회 저작권등록 시스템: https://www.cros.or.kr
- 문화체육관광부 저작권 등록 안내: https://www.mcst.go.kr/site/s_policy/copyright/knowledge/know12.jsp
- 한국저작권위원회 SW임치: https://www.copyright.or.kr/business/sw-deposit/index.do
- 한국저작권위원회 SW임치 시스템: https://www.swes.or.kr
- 대·중소기업·농어업협력재단 기술자료임치센터: https://www.kescrow.or.kr/tems/main/page.do
- 기술보증기금 Tech Safe: https://ts.kibo.or.kr/bailment/tbms01/TBMS010102Page.do
- 중소벤처기업부 기술보호울타리 임치기술 활용지원: https://www.ultari.go.kr/portal/psi/techDataSub.do
