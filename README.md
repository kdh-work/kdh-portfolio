# 권다혜 포트폴리오

Next.js 16 App Router · TypeScript · CSS Modules

## 실행

```bash
npm install
npm run dev        # http://localhost:3000
npm run build      # 프로덕션 빌드
npm run typecheck  # 타입 검사
```

## 구조

```
src/
  app/                     라우트와 전역 스타일
    layout.tsx             폰트·메타데이터·라이트박스 프로바이더
    globals.css            디자인 토큰 (색·간격·safe-area 변수)
    page.tsx               포트폴리오 본문
    demo/page.tsx          설정 위저드 데모

  content/                 콘텐츠 데이터. 지원처가 바뀌면 여기만 수정한다
    types.ts               콘텐츠 타입 정의
    profile.ts             기본 정보 · 회사 · 경력 요약
    caseStudy.ts           VISTA 설정 구조 재설계 서사
    workProjects.ts        실무 프로젝트 5건
    personalProjects.ts    개인 프로젝트 2건 · 기술 스택 · 미경험 영역

  components/
    layout/                SiteHeader · SiteFooter(연락)
    media/                 Lightbox (확대 보기) · ShotGrid (스크린샷 격자)
    sections/              페이지 섹션 단위 컴포넌트
      Hero · CareerSummary · MatrixPreview · CaseStudy
      WorkProjects · PersonalProjects (ProjectList 공용) · TechStack
      Block.module.css     섹션 공통 프레임(제목·리드·본문 간격)

  features/settings-wizard/
    model/                 도메인 로직. UI 없이 단독으로 테스트 가능
      types.ts             필드·컴포넌트·섹션 타입
      registry.ts          조건 3층 (섹션 목록 / 조합 매트릭스 / 필드 빌더)
      rules.ts             필드 검증 규칙 (교차 검증 포함)
      useWizard.ts         상태 훅
    ui/                    표현 컴포넌트
      Wizard.tsx           화면 조립. 상태는 useWizard 에만 있다
      CombinationMatrix    조합 표. 메인 페이지 미리보기와 공용
      StepTabs · SectionForm · FieldControl · TracePanel · ResetDialog · DonePanel

  lib/bridge/              WebView 브릿지 계약 (네이티브 셸 연동 예정)
    types.ts               웹↔네이티브 메시지 타입
    client.ts              전송·수신 래퍼. 브라우저에서는 무동작

public/assets/             스크린샷 (WebP, 1620px)
```

## 설계 메모

**콘텐츠와 화면 분리** — 포트폴리오 텍스트는 전부 `src/content` 에 데이터로 두었다.
지원처별 버전을 만들 때 컴포넌트를 건드리지 않는다.

**조건 3층 분리** — `registry.ts` 에서 자원 유형→섹션, 조합→컴포넌트는 조회
테이블로, 필드 값→하위 필드는 `build(values)` 런타임 계산으로 나눴다.
해석 시점이 다르기 때문이며, 실무에서 이 구조로 화면 코드의 조건 분기를
데이터로 옮겼다.

**초기화 확인을 의도 객체로** — `useWizard` 는 확인 대기 상태를 콜백이 아니라
`PendingIntent` 값으로 들고 있다. 어떤 확인이 떠 있는지 상태만 보고 알 수 있고,
확인·취소 처리가 한곳에 모인다.

**safe-area 변수** — `globals.css` 의 `--safe-top` / `--safe-bottom` 은 브라우저에서
0 이고, WebView 에서 네이티브가 노치 값을 주입할 자리다.

## 남은 작업

- [x] 섹션 컴포넌트 이식: Hero · CareerSummary · MatrixPreview · CaseStudy · WorkProjects · TechStack · Contact
- [x] 위저드 UI: StepTabs · CombinationMatrix · SectionForm · FieldControl · TracePanel · ResetDialog
- [ ] 이력서·경력기술서 PDF 연결 (`profile.docsHref` 를 채우면 연락 섹션에 링크가 나타난다)
- [ ] 모델 계층 단위 테스트 (Vitest) — `resolveSections`, `rules`
- [ ] WebView 셸 연동: 안드로이드 뒤로 가기 ↔ 히스토리, safe-area 주입, 공유 시트
