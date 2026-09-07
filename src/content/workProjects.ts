import type { Project } from "./types";

export const workProjects: Project[] = [
  {
    id: "cmp",
    name: "OKESTRO 멀티 하이브리드 클라우드 통합 관리 솔루션 CMP",
    period: "2026.01 ~ 진행 중",
    meta: "오케스트로 · 60명 규모",
    role: "클라우드 플랫폼 연결 설정 및 관리 기능 화면 프론트엔드",
    points: [
      "기획 문서와 변경 이력이 부족한 상태에서 중도 합류해, 기존 코드와 API 흐름으로 기능 기준을 역으로 정리한 뒤 개발을 이어받음",
      "플랫폼별 데이터 단위와 환산 기준을 분석해 서로 다른 표현 방식을 공통 기준으로 정리, 화면 간 일관성 확보",
      "API 응답과 화면 상태가 어긋나는 문제를 UI 상태 동기화 구조로 개선",
      "기획 검증 과정에서 UI와 데이터 불일치를 개발 전에 식별하고 개선안 제안",
      "기능 기준과 변경 이력을 문서화해 반복 확인 비용 절감",
    ],
    stack:
      "Vue 3 · TypeScript · TanStack Query · Pinia · Yup · Ant Design Vue · ECharts · vue-grid-layout · pnpm · GitLab · Jira · Confluence",
  },
  {
    id: "vista",
    name: "하나금융TI 통합 모니터링 솔루션 VISTA",
    period: "2023.07 ~ 2026.03",
    meta: "하나금융TI · 22명 규모",
    role: "모니터링 대상 장치·플랫폼 통합 설정 파트 리드, 프론트엔드",
    detailHref: "#case",
    points: [
      "설정 구조 재설계로 등록 단계 7단계 → 2단계",
      "공통 컴포넌트 라이브러리를 대부분 직접 설계·구현하고 프로젝트 후반 약 1년간 유지보수 담당",
      "화면 기획 개선 제안으로 동일 API 중복 호출을 2회 이상에서 1회로 단축",
      "클라우드 플랫폼 라우팅을 SPA 구조로 전환해 초기화·URL 이동 이슈 해결",
      "Infinite scroll + virtual scroll과 pagination 성능 비교 후, 데이터 규모에 따라 편차가 큰 전자보다 일관된 인터랙션 성능을 내는 후자를 운영 기준으로 판단 (체크박스 전체 선택 소요 시간 최대 72.3% 단축)",
      "프론트엔드 인수인계 문서 중 통합 파트 전체 작성 (v1.1 2025.07 / v1.2 2025.12)",
      "사용자 교육이 제공되지 않는 환경을 전제로, 별도 안내 없이 다음 행동을 판단할 수 있는 구조를 기준으로 설계",
    ],
    stack:
      "Vue 3 · TypeScript · TanStack Query · Pinia · PrimeVue · ECharts · Vite · Yarn Berry · MSW · ESLint · Husky · Bitbucket · Jira",
  },
  {
    id: "kb",
    name: "KB국민은행 IQ+ DevOps 시스템 구축",
    period: "2023.10 ~ 2024.01",
    meta: "KB국민은행 · 약 100명 규모",
    role: "소스 코드 관리 · 테스트 코드 메뉴 담당, 프론트엔드",
    points: [
      "미구현 상태로 인수한 화면을 완성하고 API 바인딩 수행, 추가 개발이 필요한 기능을 식별해 공유",
      "사용자 권한별 화면 분기 처리 및 권한 조합에 따른 이슈 시나리오 도출",
      "기획과 고객 요구사항이 어긋난 부분을 주도적으로 협의해 기획 수정",
      "개발이 불가한 설계에 대해 근거를 정리해 전달하고 상세 설계 보완 요청",
      "단기 대응과 장기 개선 방안을 구분해 제안, 담당 화면의 후속 작업을 문서로 정리해 인수자에게 전달",
    ],
    stack: "Vue 3 · JavaScript · Pinia · Ant Design Vue · ECharts · npm · GitLab",
  },
  {
    id: "scp",
    name: "삼성 SCP OpenStack 플랫폼 구축",
    period: "2022.07 ~ 2023.04",
    meta: "삼성SDS · 약 13명 규모",
    role: "클라우드 모니터링 유저 콘솔 프론트엔드",
    points: [
      "OpenStack 전환으로 지원이 중단된 기능을 대체하고 변경된 데이터 구조에 맞춰 UI 재구성",
      "삭제된 이벤트가 활성 상태로 남는 이슈의 원인을 데이터 구조·기능 흐름 기준으로 파악하고 해결 방법 제시",
      "메트릭 단위 자동 환산 처리로 표시 영역을 벗어나는 이슈 해결",
      "유효성 메시지 처리를 공통 함수로 분리해 재사용성 확보",
      "테스트 시나리오 작성 및 QA 수행, 통과율 98%",
    ],
    stack: "Vue 2 · JavaScript · ECharts · npm · pnpm · GitLab · Bitbucket",
  },
  {
    id: "gongje",
    name: "건설공제 고객 중심 정보시스템 고도화",
    period: "2022.02 ~ 2022.06",
    meta: "건설공제조합 · 약 70명 규모",
    role: "고객 관리 파트 SI",
    points: [
      "WebSquare 3 기반 화면을 WebSquare 5로 마이그레이션, 기존 기능 유지 및 신규 요구사항 반영",
      "3개월간 19개 화면 마이그레이션, 해당 화면 QA 이슈 5건",
      "API 바인딩 처리 및 실제 데이터와 설계 간 불일치 수정",
    ],
    stack: "WebSquare 5 · Java · Eclipse · SVN",
  },
];
