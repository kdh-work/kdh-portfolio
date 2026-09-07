import type {
  ComponentDef,
  FieldDef,
  ResolvedSection,
  ResourceType,
  SectionId,
  Values,
  Vendor,
} from "./types";

export const RESOURCE_TYPES: ResourceType[] = ["컴퓨트", "네트워크", "스토리지"];
export const VENDORS: Vendor[] = ["벤더1", "벤더2", "벤더3"];

export const SECTION_TITLE: Record<SectionId, string> = {
  basic: "기본 정보",
  auth: "인증 정보",
  collect: "수집 설정",
  target: "수집 대상",
  threshold: "임계값",
  volume: "볼륨 범위",
};

/* ── 1층 · 자원 유형이 결정하는 섹션 목록 ───────────────────── */
const SECTIONS_BY_TYPE: Record<ResourceType, SectionId[]> = {
  컴퓨트: ["basic", "auth", "collect"],
  네트워크: ["basic", "auth", "target", "threshold"],
  스토리지: ["basic", "auth", "volume"],
};

/* ── 3층 · 컴포넌트별 필드 구성 ───────────────────────────────
   build(values) 가 현재 값을 받아 필드 목록을 반환한다.
   여기가 반응형 층이며, 나머지 층은 모두 조회 테이블이다.           */

const TARGETS_BY_MODE: Record<string, string[]> = {
  port: ["Port 1/0/1", "Port 1/0/2", "Port 2/0/1"],
  vlan: ["VLAN 10", "VLAN 20", "VLAN 30"],
  trunk: ["Trunk A", "Trunk B"],
};

const COMPONENTS = {
  hostPort: {
    label: "호스트 · 포트 입력",
    build: (): FieldDef[] => [
      { key: "host", label: "호스트", type: "text", required: true, placeholder: "10.0.0.10", rule: "host" },
      { key: "port", label: "포트", type: "text", required: true, placeholder: "8080", rule: "port" },
    ],
  },
  endpoint: {
    label: "엔드포인트 URL 입력",
    build: (): FieldDef[] => [
      {
        key: "url",
        label: "엔드포인트 URL",
        type: "text",
        required: true,
        placeholder: "https://api.example.internal",
        rule: "url",
      },
    ],
  },
  deviceMgmt: {
    label: "관리 IP · 장비 모델",
    build: (): FieldDef[] => [
      { key: "mgmtIp", label: "관리 IP", type: "text", required: true, placeholder: "10.0.1.1", rule: "ip" },
      { key: "model", label: "장비 모델", type: "select", required: true, options: ["모델 A", "모델 B"] },
    ],
  },
  idPassword: {
    label: "계정 · 비밀번호",
    build: (): FieldDef[] => [
      { key: "account", label: "계정", type: "text", required: true },
      { key: "password", label: "비밀번호", type: "text", required: true, rule: "secret", note: "8자 이상" },
    ],
  },
  accessKey: {
    label: "액세스 키 · 시크릿",
    build: (): FieldDef[] => [
      { key: "accessKey", label: "액세스 키", type: "text", required: true, rule: "secret", note: "8자 이상" },
      { key: "secret", label: "시크릿", type: "text", required: true, rule: "secret", note: "8자 이상" },
    ],
  },
  tokenAuth: {
    label: "토큰 발급 정보",
    build: (): FieldDef[] => [
      { key: "tokenUrl", label: "토큰 발급 주소", type: "text", required: true, rule: "url" },
      { key: "clientId", label: "클라이언트 ID", type: "text", required: true },
    ],
  },

  /** 상위 필드가 하위 필드 구성 자체를 바꾸는 사례 */
  snmpAuth: {
    label: "프로토콜 버전별 인증",
    drivers: { ver: ["community", "userName", "authProto", "authKey", "privProto", "privKey"] },
    build: (values: Values): FieldDef[] => {
      const fields: FieldDef[] = [
        {
          key: "ver",
          label: "프로토콜 버전",
          type: "select",
          required: true,
          driver: true,
          options: ["v2c", "v3"],
          note: "버전에 따라 아래 인증 항목이 달라집니다",
        },
      ];
      if (values.ver === "v2c") {
        fields.push({
          key: "community",
          label: "커뮤니티 스트링",
          type: "text",
          required: true,
          derived: true,
          note: "v2c 선택으로 구성된 항목",
        });
      } else if (values.ver === "v3") {
        fields.push(
          { key: "userName", label: "사용자명", type: "text", required: true, derived: true, note: "v3 선택으로 구성된 항목" },
          { key: "authProto", label: "인증 프로토콜", type: "select", required: true, derived: true, options: ["SHA", "MD5"] },
          { key: "authKey", label: "인증 키", type: "text", required: true, derived: true, rule: "secret", note: "8자 이상" },
          { key: "privProto", label: "암호화 프로토콜", type: "select", derived: true, options: ["AES", "DES", "사용 안 함"] },
          { key: "privKey", label: "암호화 키", type: "text", derived: true },
        );
      }
      return fields;
    },
  },

  /** 상위 필드가 하위 select 의 옵션 목록과 선택 범위를 채우는 사례 */
  targetScope: {
    label: "대상 유형별 수집 범위",
    drivers: { mode: ["targets", "sampleSec"] },
    build: (values: Values): FieldDef[] => {
      const fields: FieldDef[] = [
        {
          key: "mode",
          label: "대상 유형",
          type: "select",
          required: true,
          driver: true,
          options: [
            { value: "port", text: "물리 포트" },
            { value: "vlan", text: "VLAN" },
            { value: "trunk", text: "트렁크" },
          ],
          note: "유형을 고르면 아래 목록이 그 유형의 대상으로 채워집니다",
        },
      ];
      const mode = values.mode;
      if (mode) {
        const isTrunk = mode === "trunk";
        fields.push(
          {
            key: "targets",
            label: "수집 대상",
            type: "select",
            required: true,
            derived: true,
            options: TARGETS_BY_MODE[mode] ?? [],
            note: "상위 유형에 따라 옵션 목록이 세팅된 항목",
          },
          {
            key: "sampleSec",
            label: "수집 주기(초)",
            type: "select",
            required: true,
            derived: true,
            options: isTrunk ? ["60", "300"] : ["10", "30", "60", "300"],
            note: isTrunk
              ? "트렁크는 최소 60초부터 선택 가능"
              : "유형에 따라 선택 가능 범위가 다릅니다",
          },
        );
      }
      return fields;
    },
  },

  ifaceSimple: {
    label: "인터페이스 선택",
    build: (): FieldDef[] => [
      { key: "iface", label: "인터페이스", type: "select", required: true, options: ["eth0", "eth1", "eth2"] },
    ],
  },
  apiItems: {
    label: "수집 항목 선택",
    build: (): FieldDef[] => [
      { key: "items", label: "수집 항목", type: "select", required: true, options: ["트래픽", "패킷 손실", "지연"] },
    ],
  },
  thresholdSet: {
    label: "항목별 임계값 입력",
    build: (): FieldDef[] => [
      {
        key: "warn",
        label: "경고 임계값(%)",
        type: "text",
        required: true,
        placeholder: "70",
        rule: "percentWarn",
        note: "심각 임계값보다 작아야 합니다",
      },
      {
        key: "crit",
        label: "심각 임계값(%)",
        type: "text",
        required: true,
        placeholder: "90",
        rule: "percentCrit",
        note: "경고 임계값보다 커야 합니다",
      },
    ],
  },
  fixedInterval: {
    label: "고정 주기 선택",
    build: (): FieldDef[] => [
      { key: "interval", label: "수집 주기", type: "select", required: true, options: ["30초", "1분", "5분"] },
    ],
  },
  volumePick: {
    label: "볼륨 선택",
    build: (): FieldDef[] => [
      { key: "volume", label: "볼륨", type: "select", required: true, options: ["vol-001", "vol-002"] },
    ],
  },
  bucketPrefix: {
    label: "버킷 · 접두어 지정",
    build: (): FieldDef[] => [
      { key: "bucket", label: "버킷", type: "text", required: true },
      { key: "prefix", label: "접두어", type: "text" },
    ],
  },
} satisfies Record<string, ComponentDef>;

type ComponentId = keyof typeof COMPONENTS;

/* ── 2층 · 조합이 결정하는 섹션별 컴포넌트 ────────────────────
   키가 없는 조합은 미지원이며, 화면에서 선택할 수 없다.            */
const MATRIX: Record<
  ResourceType,
  Partial<Record<Vendor, Partial<Record<SectionId, ComponentId>>>>
> = {
  컴퓨트: {
    벤더1: { basic: "hostPort", auth: "idPassword", collect: "fixedInterval" },
    벤더2: { basic: "endpoint", auth: "accessKey", collect: "fixedInterval" },
  },
  네트워크: {
    벤더1: { basic: "hostPort", auth: "idPassword", target: "ifaceSimple", threshold: "thresholdSet" },
    벤더2: { basic: "deviceMgmt", auth: "snmpAuth", target: "targetScope", threshold: "thresholdSet" },
    벤더3: { basic: "endpoint", auth: "tokenAuth", target: "apiItems", threshold: "thresholdSet" },
  },
  스토리지: {
    벤더1: { basic: "hostPort", auth: "idPassword", volume: "volumePick" },
    벤더3: { basic: "endpoint", auth: "accessKey", volume: "bucketPrefix" },
  },
};

export function isSupported(type: ResourceType, vendor: Vendor): boolean {
  return Boolean(MATRIX[type][vendor]);
}

/** 조합과 현재 값으로 섹션 구성을 해석한다. 세 층이 여기서 합쳐진다. */
export function resolveSections(
  type: ResourceType,
  vendor: Vendor,
  values: Values,
): ResolvedSection[] {
  const mapping = MATRIX[type][vendor];
  if (!mapping) return [];

  return SECTIONS_BY_TYPE[type].flatMap<ResolvedSection>((sectionId) => {
    const componentId = mapping[sectionId];
    if (!componentId) return [];
    const component: ComponentDef = COMPONENTS[componentId];
    return [
      {
        id: sectionId,
        title: SECTION_TITLE[sectionId],
        componentLabel: component.label,
        drivers: component.drivers ?? {},
        fields: component.build(values),
      },
    ];
  });
}
