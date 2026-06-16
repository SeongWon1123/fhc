# 법적/IP 등록 준비 폴더

이 폴더는 FitConnect MVP의 소프트웨어 저작권 등록, SW/기술자료 임치, 저작자 증빙, 소스 패키지 인벤토리, 오픈소스 라이선스 증빙을 준비하기 위한 내부 작업물입니다.

## 사용 순서

1. `../IP_REGISTRATION_PACKAGE.md`에서 전체 절차를 확인한다.
2. `06_filing_data_sheet.md`를 먼저 작성해 신청 주체와 등록 대상을 확정한다.
3. `03_authorship_evidence_template.md`에 팀원별 창작 증거를 모은다.
4. `scripts/ip/Generate-IpEvidencePackage.ps1`를 실행해 `evidence/` 산출물을 만든다.
5. `04_source_code_package_inventory_template.md`와 `05_open_source_license_evidence_template.md`에 생성 결과와 수기 검토 결과를 붙인다.
6. `01_software_copyright_registration_checklist.md` 또는 `02_technology_escrow_checklist.md`를 따라 제출 전 체크를 완료한다.
7. `07_package_signoff_template.md`에 책임자 확인을 남긴다.

## 관리 원칙

- 이 폴더에는 실제 비밀번호, API 키, 토큰, 개인정보, 미공개 계약서 원문을 저장하지 않는다.
- 외부 제출 전 최종 파일명, 해시, 버전, 날짜를 다시 생성하고 서명한다.
- 공식 절차와 수수료는 변경될 수 있으므로 제출일에 공식 사이트에서 다시 확인한다.
- 생성 증거물은 기본적으로 `docs/legal/evidence/`에 저장된다. 해당 폴더에 만들어지는 파일도 등록/임치 준비용 내부 증거일 뿐이다.

## 개인정보/서비스 약관 관련 문서

- `../../PRIVACY_POLICY_DRAFT.md`: 사용자 공개용 개인정보 처리방침 초안
- `../../TERMS_DRAFT.md`: 사용자 공개용 이용약관 초안
- `health_disclaimer.md`: 건강, 식단 AI, 운동 관련 면책 문구
- `data_retention_deletion_policy.md`: 데이터 보관, 삭제, 파기 운영 기준
- `app_privacy_nutrition_label_worksheet.md`: Apple App Privacy 및 Google Play Data safety 입력 준비표

위 문서는 IP 등록/임치 문서를 대체하지 않는다. 약관의 지식재산 조항을 확정할 때는 이 폴더의 IP 등록 패키지 문서와 함께 검토한다.

## 현재 공식 기준 링크

- 한국저작권위원회 저작권 등록: https://www.copyright.or.kr/business/registration/index.do
- 한국저작권위원회 SW임치: https://www.copyright.or.kr/business/sw-deposit/index.do
- 기술자료임치센터: https://www.kescrow.or.kr/tems/main/page.do
- 기술보증기금 Tech Safe: https://ts.kibo.or.kr/bailment/tbms01/TBMS010102Page.do
