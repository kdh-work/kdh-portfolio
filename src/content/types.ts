/** 포트폴리오 콘텐츠 타입. 화면 컴포넌트는 이 타입만 알면 된다. */

export type Profile = {
  name: string;
  role: string;
  headline: string;
  lede: string;
  /** 히어로 하단 요약 지표 */
  facts: { label: string; note: string }[];
  email: string;
  /** 이력서·경력기술서 PDF 경로. 비워두면 "준비 중"으로 표시한다. */
  docsHref?: string;
  /** 공개 페이지에는 전화번호를 두지 않는다. 파일로 제출하는 이력서에만 기재. */
  location: string;
  education: string;
  updatedAt: string;
};

export type Company = {
  name: string;
  period: string;
  department: string;
  title: string;
  projects: { name: string; period: string; role: string }[];
};

/** 한 줄 설명은 문자열, 항목별로 줄을 나눌 때는 배열 */
export type CareerFact = { term: string; description: string | string[] };

/** 스크린샷 한 장. width/height 는 레이아웃 밀림 방지를 위해 필수. */
export type Shot = {
  src: string;
  width: number;
  height: number;
  /** 화면 내용을 설명하는 대체 텍스트 */
  alt: string;
  /** 캡션 앞에 붙는 라우트 경로 */
  route?: string;
  caption: string;
};

/** 항목이 많은 프로젝트를 주제별로 묶는다. 요약은 늘 보이고, 근거는 펼쳐서 본다. */
export type PointGroup = {
  title: string;
  summary: string;
  /** 비어 있으면 요약만 보인다 */
  points: string[];
};

export type Project = {
  id: string;
  name: string;
  period: string;
  meta: string;
  role: string;
  /** groups 가 있으면 둘 중 하나만 쓴다 */
  points?: string[];
  /** points 아래 펼쳐서 보는 나머지 항목 */
  morePoints?: string[];
  groups?: PointGroup[];
  stack: string;
  shots?: Shot[];
  shotsNote?: string;
  /** 사례 연구 등 같은 페이지 내 참조 링크 */
  detailHref?: string;
  /** 프로젝트에 관련된 별도 데모·실험 페이지 */
  links?: { href: string; label: string; note?: string }[];
};

export type CaseStudyStage = {
  title: string;
  who: string;
  paragraphs: string[];
  /** 마지막 단계는 강조 표시 */
  final?: boolean;
};

export type TechGroup = {
  title: string;
  entries: { term: string; description: string }[];
};
