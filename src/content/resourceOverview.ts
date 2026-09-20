/** 공개용으로 새로 만든 예제. 회사 자원·API·판정 규칙을 포함하지 않는다. */
export const resourceStates = [
  { id: "risk", label: "위험", color: "var(--err)" },
  { id: "review", label: "확인 필요", color: "var(--warn)" },
  { id: "healthy", label: "정상", color: "var(--signal)" },
  { id: "idle", label: "미사용", color: "var(--muted)" },
  { id: "unknown", label: "측정 불가", color: "#88939e" },
] as const;
export type ResourceState = (typeof resourceStates)[number]["id"];
export type ResourceExample = { id: string; name: string; counts: Record<ResourceState, number> };
export const resourceExamples: ResourceExample[] = [
  { id: "compute", name: "가상 서버", counts: { risk: 2, review: 3, healthy: 24, idle: 3, unknown: 0 } },
  { id: "network", name: "네트워크", counts: { risk: 1, review: 1, healthy: 13, idle: 1, unknown: 0 } },
  { id: "storage", name: "저장 볼륨", counts: { risk: 0, review: 4, healthy: 28, idle: 4, unknown: 0 } },
  { id: "backup", name: "백업", counts: { risk: 1, review: 0, healthy: 10, idle: 4, unknown: 0 } },
];

export const overviewCopy = {
  title: "요약에서 필요한 자원까지",
  mark: "자원 현황 · 섹션 배치",
  lede: "클라우드 플랫폼 개요 화면에서 담당한 바형 자원 현황·필터링과 섹션 배치 인터랙션을 재구성했습니다. 상태를 고르고, 관련 자원을 찾고, 섹션을 옮기는 흐름을 직접 조작할 수 있습니다.",
  disclosure: "전체 레이아웃은 기획에서 정의했고, 담당 범위는 자원 현황 바·필터링 및 섹션 그리드 배치·상하 이동의 상세 동작과 구현입니다. 이 페이지는 가상 데이터로 새로 만든 축약 데모이며, 실제 제품의 API·상태 판정 기준이나 적용 완료를 나타내지 않습니다.",
  notes: [
    { title: "전체와 선택 결과의 기준을 나누기", body: "필터를 바꿔도 요약의 수량과 비율은 전체 기준을 유지합니다. 아래 목록만 선택 수량 / 전체 수량으로 바꿔, 무엇을 기준으로 읽는 숫자인지 구분했습니다. 0건 상태도 선택할 수 있고, 필터 해제는 전체 보기에서만 합니다." },
    { title: "요약과 목록 사이의 위치 연결", body: "상태 아래의 자원 유형을 누르면 해당 상태로 필터를 바꾸고 목록에서 같은 유형을 잠깐 강조합니다. 화면 밖에 있으면 위치를 안내하고, 연속 선택해도 강조는 하나만 남습니다. 이 데모에서는 목록을 누르면 가상의 유형 상세를 보여줍니다." },
    { title: "정보 표현과 클릭 영역을 따로 판단", body: "비율 막대는 구성비를 보여주지만 작은 구간은 누르기 어렵습니다. 같은 필터를 상태 카드에서도 선택하게 했습니다. 수량을 색만으로 구분하지 않고 상태 이름과 숫자를 함께 표시합니다." },
    { title: "배치 방식은 비교 목업으로", body: "원래 작업에서는 그리드 배치와 상하 이동을 비교 구현했습니다. 공개 데모는 그리드를 순서 이동과 반폭·전체 폭 조절로 축약했습니다. 두 방식의 상태는 별도로 보관하며, 이 브라우저에서만 복원합니다. 제품 적용이나 계정별 저장을 의미하지 않습니다." },
  ],
  experiment: { title: "번외 · 색에 움직임을 더한다면", body: "자원 현황의 표현을 살펴보다 개인적으로 만든 스크롤 반응형 수면 실험입니다. 업무 기능 및 제품 적용과 분리해 소개합니다.", label: "개인 인터랙션 실험 보기" },
};

export const overviewUI = {
  modeLabel: "섹션 배치 방식",
  modes: [{ id: "grid", label: "그리드 배치" }, { id: "order", label: "상하 이동" }] as const,
  gridHint: "이동 손잡이를 다른 섹션으로 끌어 놓으세요. 오른쪽 아래 손잡이로 폭을 조절하거나 반폭·전체 폭 버튼을 사용할 수 있습니다. 좁은 화면에서는 한 열로 표시합니다.",
  orderHint: "위·아래 버튼으로 한 칸씩 옮깁니다. 이동 버튼에 포커스한 상태에서 Alt / Option + ↑↓도 사용할 수 있습니다.",
  panels: { summary: "자원 현황", resources: "자원 유형", detail: "선택한 유형" },
  all: "전체 보기", reset: "현재 배치 초기화", undo: "되돌리기",
  summaryNote: "요약 수량·비율은 항상 전체 기준입니다. 상태 카드나 막대를 눌러 필터를 선택하세요.",
  empty: "선택한 상태에 해당하는 자원이 없습니다. 전체 보기로 돌아가 다른 상태를 선택하세요.",
  detailEmpty: "자원 유형 목록에서 항목을 선택하면 상태별 수량을 확인할 수 있습니다.",
  mock: "가상 데이터 · 회사의 상태 판정 규칙을 사용하지 않습니다.",
};
