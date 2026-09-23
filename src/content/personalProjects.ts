import type { Project, TechGroup } from "./types";

const SHOT_W = 1620;

export const personalProjects: Project[] = [
  {
    id: "robot-fleet-console",
    name: "Robot Fleet Console — 로봇 플릿 관제 콘솔",
    period: "2026.06 ~ 진행 중",
    meta: "기획 · 설계 · 개발 단독",
    role: "실무 모니터링 경험을 기반으로 대규모 제조·물류 현장의 관제 시나리오를 직접 설계. 공장 4곳, 로봇 3종. 프론트엔드 약 4,350 line.",
    points: [
      "도메인 단위 features 아키텍처로 분리 (fleet / floor / sites / deployment / flow-map / monitoring)",
      "Next.js API Routes를 Mock BFF로 구성해 백엔드 의존 없이 화면·상태 구조 검증",
      "폴링 훅을 상태 관리 라이브러리 없이 직접 구현 — 의존성 변경 시 이전 데이터 잔상 제거, ref로 최신 fetcher 유지해 불필요한 재구독 차단, 화면 이탈 시 잔여 요청 정리",
      "OpenLayers로 지리 좌표와 평면도 좌표 두 좌표계를 함께 처리",
      "상태 판정·지표 정의·그래프 구성을 lib 계층으로 분리하고, 순수 함수 대상 단위 테스트 작성",
      "로봇 개체 등록·수정은 도메인 지식 한계를 명시하고 범위에서 의도적으로 제외",
    ],
    stack:
      "React 19 · Next.js 15 App Router · TypeScript 5.7 · OpenLayers 10 · Vitest 2 · Testing Library · CSS Modules · pnpm",
    shotsNote:
      "각 이미지를 클릭하면 확대해서 볼 수 있습니다. 로컬 실행 화면을 캡처한 것으로, 데이터는 Mock BFF에서 생성한 가상 값입니다.",
    shots: [
      {
        src: "/assets/rfc-sites.webp",
        width: SHOT_W,
        height: 1005,
        route: "/sites",
        caption: "거점 맵 — 지리 좌표 위 거점 상태, 마커에서 해당 공장 평면 맵으로 이동",
        alt: "거점 맵 화면. 세계 지도 위에 공장 4곳이 마커로 표시되고, 오른쪽에 공장별 로봇 수와 가동률, 알람 수가 카드로 나열되어 있다.",
      },
      {
        src: "/assets/rfc-fleet-kpi.webp",
        width: SHOT_W,
        height: 1005,
        route: "/fleet",
        caption: "플릿 대시보드 — KPI 카드와 가동률·알람 순위",
        alt: "플릿 대시보드 상단. 총 로봇 268대, 가동 중 241대, 알람 6건 KPI 카드와 공장별 가동률·알람 순위 목록.",
      },
      {
        src: "/assets/rfc-fleet-dist.webp",
        width: SHOT_W,
        height: 1005,
        route: "/fleet",
        caption: "공장 × 상태 히트맵과 공장별 현황 스택 바",
        alt: "플릿 대시보드 하단. 공장과 상태를 축으로 한 히트맵과 공장별 현황 카드에 상태 분포 스택 바가 표시되어 있다.",
      },
      {
        src: "/assets/rfc-robot-list.webp",
        width: SHOT_W,
        height: 1005,
        route: "/fleet/[factoryId]",
        caption: "공장 로봇 목록 — 타입·상태·버전 정렬",
        alt: "공장 로봇 목록 화면. 이름, 타입, 상태, 버전, 오늘 가동 시간 열로 구성된 정렬 가능한 표.",
      },
      {
        src: "/assets/rfc-floor.webp",
        width: SHOT_W,
        height: 1005,
        route: "/floor/[factoryId]",
        caption: "공장 평면 맵 — 평면도 좌표계, 격자·평면도 전환",
        alt: "공장 평면 맵 화면. 평면도 구역 위에 로봇 86대가 상태별 색상 점으로 배치되고, 오른쪽에 상태별 대수 범례가 있다.",
      },
      {
        src: "/assets/rfc-deployment.webp",
        width: SHOT_W,
        height: 1005,
        route: "/deployments/[id]",
        caption: "배포 프로세스 — 단계별 진행·실패 지점과 분기 경로",
        alt: "배포 상세 화면. 대기열 등록부터 배포 완료까지 8단계가 플로우 그래프로 이어지고 현재 단계가 진행 중으로 강조되어 있다.",
      },
    ],
  },
  {
    id: "my-games",
    name: "My Games — 플랫폼 통합 게임 라이브러리",
    period: "2026.05 ~ 진행 중",
    meta: "기획 · FE · BE · 로컬 인프라 단독",
    role: "외부 플랫폼에서 소유 게임을 가져와 저장하고, 수동 등록 게임과 함께 조회하는 라이브러리. 프론트엔드 약 4,000 line.",
    points: [
      "외부 API 호출과 DB 조회를 화면 단위로 분리 — 동기화 화면은 방금 받은 응답을 그대로 보여주고, 라이브러리 화면은 저장본만 조회해 재호출하지 않음",
      "같은 게임 목록을 두 경로로 볼 수 있게 하되, 각 화면이 어느 데이터를 보고 있는지 화면 상단에 명시해 혼동 방지",
      "표시 언어 전환에 따라 플랫폼 API의 로케일 파라미터를 함께 바꿔, 설명·에디션 정보를 해당 언어 응답으로 받아 표시",
      "앱 내 WebView 탑재를 전제로 반응형 구조 설계 — 화면 폭에 따라 아이콘 중심과 텍스트 라벨 내비게이션으로 분기, 가로 스크롤 제스처가 뒤로 가기로 전환되는 현상 완화, 좁은 폭에서 레이아웃 붕괴 방지",
      "NestJS와 Prisma로 API를 직접 구성하고 PostgreSQL을 Docker로 운영",
    ],
    stack:
      "React 18 · TypeScript · Vite · React Router · TanStack Query · Zustand · Zod · Tailwind CSS · NestJS · Prisma · PostgreSQL · Docker",
    shotsNote:
      "계정 식별 정보는 예시 값으로 대체했습니다. 로컬 실행 화면이며, 외부 플랫폼 데이터는 실제 응답입니다.",
    shots: [
      {
        src: "/assets/mg-sync.webp",
        width: SHOT_W,
        height: 1009,
        route: "/sync",
        caption: "플랫폼 동기화 — 방금 받은 응답을 그대로 표시, 완료 시각과 게임 수 요약",
        alt: "플랫폼 동기화 화면. 계정 정보 입력 후 동기화를 실행하면 완료 시각과 게임 수가 표시되고, 방금 받은 응답의 게임 목록이 카드로 나열된다.",
      },
      {
        src: "/assets/mg-library.webp",
        width: SHOT_W,
        height: 1009,
        route: "/library",
        caption: "라이브러리 — DB 저장본만 조회, 외부 API 재호출 없음",
        alt: "라이브러리 화면. 저장된 게임 62개가 카드 목록으로 표시되고, 각 카드에 플랫폼 태그와 플레이 시간, 최근 플레이 일시가 들어 있다.",
      },
      {
        src: "/assets/mg-search.webp",
        width: SHOT_W,
        height: 1009,
        route: "/steam-search",
        caption: "게임 검색 — 카탈로그 키워드·ID 검색, 페이지당 개수 지정",
        alt: "게임 검색 화면. 키워드와 앱 ID, 페이지당 개수를 입력해 검색하면 일치 항목이 카드 목록으로 표시된다.",
      },
      {
        src: "/assets/mg-locale-ko.webp",
        width: SHOT_W,
        height: 1009,
        caption: "상세 응답 미리보기 — 표시 언어 한국어",
        alt: "검색 결과 상세 모달. 표시 언어를 한국어로 두었을 때 게임 소개와 에디션 정보가 한국어로 표시된다.",
      },
      {
        src: "/assets/mg-locale-en.webp",
        width: SHOT_W,
        height: 1009,
        caption: "같은 항목, 표시 언어 English — 로케일 파라미터가 응답에 반영되는지 확인",
        alt: "같은 게임의 상세 응답 미리보기. 표시 언어를 English로 바꾸면 동일 항목이 영어 응답으로 표시된다.",
      },
    ],
  },
];

export const techGroups: TechGroup[] = [
  {
    title: "실무 · 4년 9개월",
    entries: [
      { term: "언어", description: "TypeScript, JavaScript" },
      { term: "프레임워크", description: "Vue 3 Composition API, Vue 2" },
      { term: "상태", description: "TanStack Query, Pinia, Vuex" },
      {
        term: "UI · 시각화",
        description: "Ant Design Vue, PrimeVue, ECharts, vue-grid-layout",
      },
      {
        term: "빌드 · 품질",
        description: "Vite, Webpack, Yarn Berry PnP, pnpm, ESLint, Prettier, Husky, MSW",
      },
      { term: "협업", description: "Jira, Confluence, GitLab, Bitbucket" },
      { term: "AI 도구", description: "Claude(주력), Cursor" },
    ],
  },
  {
    title: "개인 프로젝트 · 약 1년",
    entries: [
      { term: "프레임워크", description: "React 19 / 18, Next.js 15 App Router" },
      {
        term: "상태",
        description: "TanStack Query, Zustand, 커스텀 폴링 훅 직접 구현",
      },
      { term: "검증 · 지도", description: "Zod, OpenLayers 10" },
      {
        term: "스타일 · 테스트",
        description: "Tailwind CSS, CSS Modules, Vitest 2, Testing Library",
      },
      { term: "백엔드 · 인프라", description: "NestJS, Prisma, PostgreSQL, Docker" },
    ],
  },
];

/** 정직하게 관리하는 미경험 영역. 항목이 옮겨갈 때마다 여기서 지운다. */
export const notYetExperienced = [
  "네이티브 브릿지 연동 — WebView 환경을 전제로 한 반응형 설계까지만 경험했고, 브릿지 통신은 구현하지 않았습니다",
  "CI/CD 파이프라인 구축 — 파이프라인과 리뷰어 규칙이 있는 환경에서 프로세스에 참여했으나 구축은 담당하지 않았습니다",
  "컴포넌트 테스트와 E2E — 순수 로직 단위 테스트만 작성했고, Cypress와 Playwright는 경험이 없습니다",
  "B2C 서비스와 모바일 네이티브 앱",
];
