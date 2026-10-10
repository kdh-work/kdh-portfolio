import type { Profile, Company, CareerFact } from "./types";

export const profile: Profile = {
  name: "권다혜",
  role: "프론트엔드 개발자",
  headline: "설정이 많은 화면을 조합으로 정리합니다",
  lede: "통합 모니터링과 클라우드 관리 플랫폼에서 장치·플랫폼 설정 영역을 담당했습니다. 조건이 얽혀 사용자가 판단하기 어려운 화면을, 앞단의 선택 하나가 이후 구성을 결정하는 구조로 바꿔왔습니다.",
  facts: [
    { label: "4년 9개월", note: "2021.12 ~ 재직 중" },
    { label: "Vue 3 · TypeScript", note: "실무 주력" },
    { label: "React · Next.js", note: "개인 프로젝트" },
    { label: "B2B 엔터프라이즈 콘솔", note: "담당 도메인" },
  ],
  email: "kdhtoon@gmail.com",
  location: "경기도 수원시",
  education: "동국대학교 컴퓨터공학전공 학사",
  updatedAt: "2026.10",
};

export const companies: Company[] = [
  {
    name: "오케스트로㈜",
    period: "2022.07 ~ 재직 중",
    department: "CMP실 인벤토리2팀",
    title: "주임",
    projects: [
      {
        name: "OKESTRO CMP 클라우드 통합 관리 솔루션",
        period: "2026.01 ~ 진행 중",
        role: "플랫폼 연결 설정 · 개요 화면 인터랙션 · 자원 관계도 · 신규 기능 기획·설계 검토",
      },
      {
        name: "하나금융TI 통합 모니터링 솔루션 VISTA",
        period: "2023.07 ~ 2026.03",
        role: "통합 설정 파트 프론트엔드 단독 담당",
      },
      {
        name: "KB국민은행 IQ+ DevOps 시스템 구축",
        period: "2023.10 ~ 2024.01",
        role: "소스 코드 관리 · 테스트 코드 메뉴",
      },
      {
        name: "삼성 SCP OpenStack 플랫폼 구축",
        period: "2022.07 ~ 2023.04",
        role: "클라우드 모니터링 유저 콘솔",
      },
    ],
  },
  {
    name: "대보정보통신㈜",
    period: "2021.12 ~ 2022.06",
    department: "전략기술팀",
    title: "사원",
    projects: [
      {
        name: "건설공제 고객 중심 정보시스템 고도화",
        period: "2022.02 ~ 2022.06",
        role: "고객 관리 파트 SI",
      },
    ],
  },
];

export const careerFacts: CareerFact[] = [
  {
    term: "담당 도메인",
    description:
      "클라우드 관리 · 통합 모니터링 · DevOps 콘솔. 경력 전체가 B2B 엔터프라이즈 웹 콘솔과 데스크톱 환경입니다. 권한에 따라 화면이 분기되는 단일 콘솔과 접속 경로가 분리된 콘솔을 모두 담당했습니다.",
  },
  {
    term: "일하는 방식",
    description:
      "얽힌 도메인 규칙을 화면 구조로 정리하고, 공통 기반과 판단 근거를 문서로 남깁니다. 기존 코드를 이어받아 구현하며 드러난 문제를 개선하는 일이 많았고, 최근에는 기획·설계 단계부터 참여해 구현 가능성과 API·데이터 구조를 미리 검토합니다.",
  },
  {
    term: "AI 활용",
    description: [
      "작은 수정 — 초안을 만든 뒤 동작을 확인하고 필요한 부분만 반영",
      "새로운 기술 검토 — 기존 접근과 AI의 제안을 비교해 적용 여부 판단",
      "큰 작업 — 구현 전에 규칙·작업 순서·검증 기준을 먼저 정리",
      "화면 시안 — 여러 안을 빠르게 만들어 비교",
      "최종 판단 — 구조와 데이터 흐름에 영향을 주는 변경은 직접 확인하고 검증",
    ],
  },
  {
    term: "주력 스택",
    description: ["실무 — Vue, JavaScript, TypeScript", "개인 프로젝트 — React, Next.js, Vite"],
  },
  {
    term: "학력",
    description: "동국대학교 컴퓨터공학전공 학사 (2018.03 ~ 2022.02)",
  },
];
