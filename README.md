Spec Checker - Full package (v3.0)

기능
- 팝업 내 탭: 검사 결과 / 규칙 편집 / 입력 확인 / 설정
- 규칙에 근거(reason) 표기 (SI 표준, 업계 관행 등)
- 하이라이트 옵션: 박스 또는 텍스트 깜빡임
- 이미지 OCR(오프라인 준비): vendor/tesseract.min.js를 넣으면 오프라인 작동
- CSV 내보내기, 선택적 교정(팝업 내에서 선택 후 적용)
- GitHub에 올릴 때 가독성/중복 주입 문제를 막기 위해 코드가 idempotent(중복 주입 방지)하게 작성됨

설치
1. 폴더를 압축 해제합니다.
2. Chrome/Edge에서 chrome://extensions/ 또는 edge://extensions/ 로 이동합니다.
3. 개발자 모드 켜기 → '압축 해제된 확장 프로그램 로드'로 폴더 선택.

오프라인 OCR 추가 방법
- Tesseract.js의 minified 파일(tesseract.min.js)을 vendor 폴더에 넣어주세요.
- 파일명은 vendor/tesseract.min.js 이어야 합니다.
- 브라우저 보안 정책에 따라 CDN에서 로드가 차단될 수 있으므로 로컬 파일을 권장합니다.

GitHub 업로드 팁
- 전체 폴더(또는 주요 파일)를 그대로 푸시하면 됩니다.
- vendor/tesseract.min.js 파일은 용량이 클 수 있으니 LFS 사용을 고려하세요.
