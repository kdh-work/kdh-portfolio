# 권다혜 포트폴리오

Next.js 16 App Router · TypeScript · CSS Modules · Three.js(자원 관계도 WebGL 렌더러에만, 지연 로드)

## 실행

```bash
npm install
npm run dev        # http://localhost:3000/kdh-portfolio
npm run build      # 정적 빌드 → out/
npm run typecheck  # 타입 검사
```

린트 스크립트는 두지 않았다. `tsconfig` 를 `strict` + `noUncheckedIndexedAccess`
로 조여 두어 `typecheck` 가 대신한다.

Node 22 이상이 필요하다 (`.nvmrc` 참고, `nvm use`).

## 배포 — GitHub Pages

`main` 에 푸시하면 `.github/workflows/deploy-pages.yml` 이 빌드해서 Pages 에 올린다.
공개 주소는 `https://kdh-work.github.io/kdh-portfolio/`.

- 사이트가 `/kdh-portfolio` 하위 경로에 놓이므로 `next.config.ts` 의 `basePath` 가 켜져 있다.
  저장소 이름을 바꾸면 이 값을 같이 바꾼다. 루트 도메인으로 옮기면 `""` 로 비운다.
- `next/image` 의 `src` 에는 basePath 가 자동으로 붙지 않아 `src/lib/paths.ts` 의 `withBasePath` 로 붙인다.
- `public/.nojekyll` 은 Pages 가 `_next` 폴더를 무시하지 않게 하는 빈 파일이다.

## 구조

```
src/
  app/                     라우트와 전역 스타일
    layout.tsx             폰트·메타데이터·라이트박스 프로바이더
    globals.css            디자인 토큰 (색·간격·safe-area 변수)
    page.tsx               포트폴리오 본문
    demo/page.tsx          설정 위저드 데모
    iso-map/page.tsx       자원 관계도 데모 + 라벨 배치 검토 기록

  content/                 콘텐츠 데이터. 지원처가 바뀌면 여기만 수정한다
    types.ts               콘텐츠 타입 정의
    profile.ts             기본 정보 · 회사 · 경력 요약
    caseStudy.ts           VISTA 설정 구조 재설계 서사
    isoMap.ts              자원 관계도 입력 데이터(가상) · 문구 · 라벨 검토 기록
    workProjects.ts        실무 프로젝트 5건
    personalProjects.ts    개인 프로젝트 2건 · 기술 스택 · 미경험 영역

  components/
    layout/                SiteHeader · SiteFooter(연락)
    media/                 Lightbox (확대 보기) · ShotGrid (스크린샷 격자)
    sections/              페이지 섹션 단위 컴포넌트
      Hero · CareerSummary · MatrixPreview · CaseStudy · IsoMapPreview
      WorkProjects · PersonalProjects (ProjectList 공용) · TechStack
      Block.module.css     섹션 공통 프레임(제목·리드·본문 간격)

  features/iso-map/        자원 관계도. 3계층 경계를 디렉토리로 분리했다
    scene/                 프로바이더 무관. 도메인을 전혀 모른다
      types.ts             장면 모델 (IsoScene / IsoNode / IsoZone / IsoTone)
      projection.ts        축측 투영 · 박스 3면 · 엘보 · 바닥 텍스트 행렬
    vpc/                   VPC 어댑터. 도메인 지식이 여기에만 있다
      sourceTypes.ts       입력 타입 (자원 맵 응답의 부분집합)
      buildVpcLayout.ts    응답 → IsoScene (배치·색·라벨 결정)
    ui/
      IsoMap.tsx           SVG 렌더러. IsoScene 을 받아 그리기만 한다
      VpcIsoMap.tsx        어댑터 래퍼 (모드·배율·시점·렌더러 상태)
      useYawDrag.ts        끌어서 회전. 두 렌더러가 공유한다
      labels.ts            박스 이름 줄임. 두 렌더러가 공유한다
      LabelStudy.tsx       라벨 배치 검토 도식. 같은 투영 함수로 그린다
      RendererComparison.tsx  SVG·WebGL 비교 기록
      three/               WebGL 렌더러 (지연 로드)
        camera.ts          SVG 투영과 같아지는 직교 카메라 유도
        rail.ts            구획 레일 띠 메시 (WebGL 은 선 굵기가 없다)
        floorText.ts       바닥에 눕는 이름 = 캔버스 텍스처
        tones.ts           계열 색을 CSS 에서 읽어 온다
        IsoMapThree.tsx    렌더러 본체

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

**WebGL 없는 시점 회전** — 아이소메트릭은 3D 렌더링이 아니라 아핀 변환이므로,
지면 회전각(`yawDeg`) 하나를 투영식에 넣으면 SVG 상태로 시점이 돌아간다. 글자는
그대로 글자로 남고 박스는 키보드로 이동할 수 있는 DOM 요소로 남는다. 대신 각도에
딸려 오는 것이 네 개 있고(가시면 선택, painter's algorithm 정렬 키, 바닥 글자의
전단 행렬, 구획 이름이 놓일 변) 넷 다 축의 화면 방향에서 유도한다. 기본 45° 에서는
예전 cos30/sin30 상수식과 부동소수점 정밀도로 일치한다.

**두 렌더러가 하나의 배치를 그린다** — 어댑터가 같은 레이아웃을 두 형태로
내보낸다. `IsoScene` 은 화면 좌표까지 계산된 SVG path 이고, `IsoScene.solid` 는
투영 전 그리드 좌표다(WebGL 은 투영을 카메라가 하므로 후자가 필요하다). 레이아웃
계산이 한 곳뿐이라 두 렌더러가 어긋날 수 없다. `solid` 는 배율·시야각과 무관해서
한 번만 만든다.

**아이소메트릭은 직교 카메라의 특수한 경우다** — SVG 투영식과 카메라 파라미터를
항별로 맞춰 보면 고각이 35.264°(=asin(tan30°))로 떨어지는데, 이것이 표준
아이소메트릭 고각이다. 유도 결과 두 렌더러의 화면 좌표 차이는 1e-13 px 이고,
브라우저에서 실측한 노드 11개의 가로 위치 차이는 0.00px 다. 덤으로 알게 된 것:
`SPAN_X · cos(35.264°) = 1` 이므로 원본 도식은 진짜 아이소메트릭보다 박스를
1.294 배 높게 그려 왔다(의도된 과장이며 3D 에서도 그대로 재현한다).

**구획 이름은 윤곽선을 끊어 넣는다** — 글자 뒤에 판이나 외곽선을 깔아 가리는
방식은 판이 글자 수에 끌려다니거나 획 사이로 선이 비치고, 어느 쪽이든 덮는 색이
배경에 의존한다. 윤곽선 path 자체를 이름 자리만큼 비우면 가릴 것이 없어진다.
검토 과정은 `/iso-map` 하단 "검토 기록" 섹션에 남겼다.

## 남은 작업

- [x] 섹션 컴포넌트 이식: Hero · CareerSummary · MatrixPreview · CaseStudy · WorkProjects · TechStack · Contact
- [x] 위저드 UI: StepTabs · CombinationMatrix · SectionForm · FieldControl · TracePanel · ResetDialog
- [x] GitHub Pages 배포 워크플로우
- [x] 자원 관계도 이식 (`features/iso-map`) — 3D·2D · 시점 회전 · 라벨 배치 검토 기록
- [ ] 이력서·경력기술서 PDF 연결 (`profile.docsHref` 를 채우면 연락 섹션에 링크가 나타난다)
- [ ] 모델 계층 단위 테스트 (Vitest) — `resolveSections`, `rules`, `projection`, `buildVpcLayout`
- [x] 자원 관계도 Three.js 비교 구현 — 토글 뒤 지연 로드(gzip 121KB 별도 청크), 박스 이름은 HTML 오버레이, 바닥 이름은 캔버스 텍스처
- [ ] WebView 셸 연동: 안드로이드 뒤로 가기 ↔ 히스토리, safe-area 주입, 공유 시트
