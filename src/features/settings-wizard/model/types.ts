/**
 * 설정 위저드 도메인 타입.
 *
 * 조건은 세 층으로 나뉘고, 해석되는 시점이 다르다.
 *   1층 자원 유형        → 섹션 목록          (1단계 선택으로 확정)
 *   2층 자원 유형 × 벤더 → 섹션별 컴포넌트    (1단계 선택으로 확정)
 *   3층 필드 값          → 하위 필드 구성      (입력 중 계속 재계산)
 *
 * 1·2층은 조회 테이블로 두고, 3층만 build() 안에서 런타임 계산한다.
 */

export type ResourceType = "컴퓨트" | "네트워크" | "스토리지";
export type Vendor = "벤더1" | "벤더2" | "벤더3";

export type SectionId =
  | "basic"
  | "auth"
  | "collect"
  | "target"
  | "threshold"
  | "volume";

export type RuleName =
  | "host"
  | "port"
  | "ip"
  | "url"
  | "secret"
  | "percentWarn"
  | "percentCrit";

export type FieldOption = string | { value: string; text: string };

export type FieldDef = {
  key: string;
  label: string;
  type: "text" | "select";
  required?: boolean;
  placeholder?: string;
  note?: string;
  options?: FieldOption[];
  rule?: RuleName;
  /** 하위 필드 구성을 결정하는 상위 필드 */
  driver?: boolean;
  /** 상위 필드 값에 의해 구성된 하위 필드 */
  derived?: boolean;
};

export type ComponentDef = {
  label: string;
  /** 상위 필드 key → 초기화 대상 하위 필드 key 목록 */
  drivers?: Record<string, string[]>;
  build: (values: Values) => FieldDef[];
};

export type Values = Record<string, string>;
export type Errors = Record<string, string>;

/** 조합과 현재 값으로부터 파생된 섹션 하나 */
export type ResolvedSection = {
  id: SectionId;
  title: string;
  componentLabel: string;
  drivers: Record<string, string[]>;
  fields: FieldDef[];
};
