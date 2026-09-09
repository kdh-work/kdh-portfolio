import type { IsoVpcSource } from "@/features/iso-map/vpc/sourceTypes";

/**
 * 자원 관계도 데모의 입력 데이터.
 *
 * 어댑터가 받는 모양은 실무의 자원 맵 응답 구조를 따르지만, 값은 전부 가상이다.
 * 실제 계정의 자원 식별자·이름·주소는 포함되어 있지 않다.
 *
 * 응답에서 겪은 함정을 데이터로 남겨 두었다.
 *  - `rtb-edge` 의 `name` 이 null 이다 → 렌더러가 id 로 대체하는지 확인된다.
 *  - `rtb-reserved` 는 연결이 0개다 → 연결 없는 노드가 사라지지 않는지 확인된다.
 *  - `vpce-object` 는 어느 라우팅 테이블도 참조하지 않는다 → 노드 목록을
 *    `connectWith` 에서 역산하면 안 되는 이유가 그대로 보인다.
 *  - `connectWith` 의 `state` 가 `blackhole` 인 경로가 하나 있다 → 노드는 그리되
 *    엣지만 걸러내는 규칙이 확인된다.
 */
export const vpcResourceMap: IsoVpcSource = {
  vpcResourceMap: { vpcId: "vpc-service", name: "service-vpc" },
  subnetGroupList: [
    {
      availabilityZone: "ap-northeast-2a",
      subnetList: [
        {
          subnetId: "subnet-public-2a",
          name: "public-subnet-2a",
          cidrBlock: "10.0.0.0/24",
          routeTableId: "rtb-edge",
        },
        {
          subnetId: "subnet-app-2a",
          name: "app-subnet-2a",
          cidrBlock: "10.0.128.0/20",
          routeTableId: "rtb-core",
        },
      ],
    },
    {
      availabilityZone: "ap-northeast-2c",
      subnetList: [
        {
          subnetId: "subnet-app-2c",
          name: "app-subnet-2c",
          cidrBlock: "10.0.144.0/20",
          routeTableId: "rtb-core",
        },
        {
          subnetId: "subnet-data-2c",
          name: null,
          cidrBlock: "10.0.160.0/20",
          routeTableId: "rtb-core",
        },
      ],
    },
  ],
  routeTableResourceMapList: [
    {
      routeTableId: "rtb-edge",
      name: null,
      connectWith: [
        { id: "igw-service", name: "service-igw", type: "gateway", state: "active" },
      ],
    },
    {
      routeTableId: "rtb-core",
      name: "core-route-table",
      connectWith: [
        { id: "igw-service", name: "service-igw", type: "gateway", state: "active" },
        { id: "nat-2a", name: "nat-2a", type: "natGateway", state: "active" },
        // 회수된 경로. 노드는 남고 연결선만 사라진다.
        { id: "nat-2c", name: "nat-2c", type: "natGateway", state: "blackhole" },
      ],
    },
    {
      routeTableId: "rtb-reserved",
      name: "reserved-route-table",
      connectWith: [],
    },
  ],
  networkResourceMapList: [
    { id: "igw-service", name: "service-igw", type: "gateway" },
    { id: "nat-2a", name: "nat-2a", type: "natGateway" },
    { id: "nat-2c", name: "nat-2c", type: "natGateway" },
    // 라우팅 테이블이 참조하지 않는 자원. 목록 기준으로 그려야 살아남는다.
    { id: "vpce-object", name: "object-store-endpoint", type: "vpcEndpoint" },
  ],
};

/** 자원 관계도 데모 페이지 안내 문구 */
export const isoMapIntro = {
  title: "계층을 그대로 읽히게 만든 자원 관계도",
  paragraphs: [
    "클라우드 관리 플랫폼에서 VPC 자원의 관계를 보여주는 화면입니다. 표로 나열하면 어느 서브넷이 어느 라우팅 테이블을 거쳐 어느 게이트웨이로 나가는지 눈으로 따라갈 수 없어서, 계층이 한 방향으로만 흐르는 도식으로 바꿨습니다.",
    "3D 는 WebGL 이 아니라 아이소메트릭 투영입니다. 좌표 계산만으로 만들어지므로 글자는 그대로 글자이고, 박스는 키보드로 이동할 수 있는 요소로 남습니다. 도식을 끌면 시점이 돌아가는데, 이것도 WebGL 없이 투영 각도 하나를 바꾸는 것입니다 — 회전 후에도 여전히 아핀 변환이기 때문입니다.",
  ],
  disclosure:
    "실무 코드를 그대로 옮기지 않고, 화면에 표시되는 자원 이름·주소·식별자를 전부 가상 값으로 대체했습니다. AWS 자원 유형(VPC · 서브넷 · 라우팅 테이블 · 게이트웨이)은 공개된 개념이라 그대로 두었습니다.",
};

/** 관계도가 해석하는 계층 설명 — 데모 페이지 상단에 나열한다 */
export const isoMapLayers = [
  {
    kind: "포함",
    title: "가용영역 → 서브넷",
    description:
      "서브넷은 가용영역 안에 있습니다. 가용영역으로 묶은 뒤 한 열에 세로로 쌓아, 연결선이 다른 서브넷 박스를 관통하지 않게 했습니다",
  },
  {
    kind: "직속",
    title: "VPC → 라우팅 테이블",
    description:
      "라우팅 테이블은 서브넷이 아니라 VPC 스코프입니다. 서브넷 열 오른쪽에 별도 레인으로 두고, 어떤 서브넷이 그 테이블을 쓰는지는 연결선으로 나타냅니다",
  },
  {
    kind: "참조",
    title: "라우팅 테이블 → 네트워크 자원",
    description:
      "게이트웨이는 계층이 아니라 라우팅 대상 목록입니다. VPC 경계 밖에 두고 파선으로 이어, 포함 관계가 아니라는 것을 선의 모양으로 구분합니다",
  },
];

/**
 * 구획 이름을 어디에 둘 것인가 — 검토한 배치안.
 *
 * `id` 는 `LabelStudy` 가 도식을 그릴 때 쓰는 배치 키다. 문구만 여기서 고친다.
 */
export const labelStudy = {
  lede: "구획 레일은 모서리를 둥글립니다 — 바닥에 그려진 것과 위에 떠 있는 것을 모양으로 구분하기 위해서입니다. 그런데 이름을 모서리 꼭짓점에 맞추자 어색해졌습니다. 레일이 꼭짓점에 닿지 않기 때문입니다. 네 가지를 거쳐 다섯 번째로 갔습니다.",
  variants: [
    {
      id: "corner",
      title: "꼭짓점에 맞추기",
      note: "레일은 꼭짓점에 닿기 전부터 휩니다. 탭의 왼쪽이 곡선 위에 얹히고 그 끝은 레일이 없는 자리로 나갑니다. 처음 상태입니다.",
      verdict: "rejected",
    },
    {
      id: "square",
      title: "모서리를 각지게",
      note: "라운딩을 없애면 꼭짓점이 실제로 생겨 어긋남이 사라집니다. 대신 바닥과 볼륨을 모양으로 구분하던 신호를 잃습니다.",
      verdict: "rejected",
    },
    {
      id: "plate",
      title: "변 가운데에 명판",
      note: "곡선을 피해 가운데로 옮기고 레일보다 높은 판으로 덮었습니다. 그런데 판 폭이 글자 수에 비례해 늘어납니다 — 이름이 길면 변을 거의 다 채우는 덩어리가 되고, 그러면 가운데 정렬도 포기해야 합니다.",
      verdict: "rejected",
    },
    {
      id: "halo",
      title: "글자 외곽선으로 가리기",
      note: "판을 없애니 훨씬 가볍습니다. 다만 외곽선이 글자 모양을 따라가므로 획 사이 틈으로 레일이 비치고, 덮는 색이 뒤에 무엇이 있는지에 의존합니다.",
      verdict: "rejected",
    },
    {
      id: "chosen",
      title: "레일을 실제로 끊기",
      note: "가리는 대신 윤곽선 path 자체를 이름 자리만큼 비웠습니다. 가릴 것이 없으니 비침도 배경 의존도 생기지 않고, 판이 없으니 이름이 길어져도 빈 구간만 늘어납니다.",
      verdict: "chosen",
    },
  ],
  closing:
    "덮어서 해결하려는 동안은 계속 새 문제가 생겼습니다. 판은 글자 수에 끌려다니고, 외곽선은 글자 모양에 끌려다니고, 둘 다 뒤에 깔린 색을 알아야 했습니다. 가리는 것을 그만두고 선을 끊자 세 가지가 함께 사라졌습니다. 대신 구획 여백을 0.55에서 0.8로 넓혔습니다 — 이름이 들어갈 빈 구간이 모서리 곡선을 침범하지 않으려면 변이 이름보다 충분히 길어야 하기 때문입니다. 배치 규칙이 레이아웃 상수를 되돌아 바꾼 셈입니다.",
};

/**
 * SVG · WebGL 두 렌더러 비교 기록.
 *
 * 원본 문서가 Three.js 를 기각한 근거는 표였다. 같은 장면을 두 렌더러로 만들어
 * 그 표를 실측으로 바꾼 것이 이 절이다.
 */
export const rendererComparison = {
  lede: "같은 어댑터가 만든 하나의 배치를 두 렌더러로 그렸습니다. 화면 위 토글이 그 둘을 바꿉니다. 카메라를 SVG 투영과 같아지도록 유도해서, 두 렌더러는 콘텐츠를 같은 픽셀에 올립니다 — 노드 11개의 가로 위치 차이가 0.00px 입니다.",
  rows: [
    {
      aspect: "번들",
      svg: "0KB. 좌표 계산뿐이라 라이브러리가 없습니다.",
      webgl:
        "gzip 121KB. 토글을 누를 때만 내려오도록 지연 로드했습니다. 이 페이지의 초기 스크립트는 187KB 이므로, 즉시 로드하면 65% 가 늘어납니다.",
    },
    {
      aspect: "글자",
      svg: "전부 <text> 입니다. 선택·검색·스크린리더가 그대로 닿습니다.",
      webgl:
        "박스 이름은 HTML 오버레이로 남겨 글자로 지켰습니다. 하지만 바닥에 눕는 구획 이름은 오버레이로 안 됩니다 — 오버레이는 항상 카메라를 정면으로 보기 때문입니다. 캔버스에 그려 텍스처로 올렸고, 그 순간 글자가 아니게 됩니다.",
    },
    {
      aspect: "선 굵기",
      svg: "구획 레일은 stroke-width 한 줄입니다.",
      webgl:
        "WebGL 에는 선 굵기가 없습니다. linewidth 는 대부분의 플랫폼에서 무시되고 1px 로 그려집니다. 5px 레일을 내려면 폴리라인을 따라 띠 메시를 직접 만들어야 합니다.",
    },
    {
      aspect: "같은 평면 겹침",
      svg: "깊이 버퍼가 없습니다. 구획 레일과 바닥 이름이 바닥판과 같은 평면에 있어도 그린 순서대로 얹힙니다.",
      webgl:
        "깊이 버퍼가 판정합니다. 같은 평면이면 z-fighting 이 나서 시야각에 따라 레일과 글자가 얼룩덜룩 깨지거나 사라집니다. 실제로 겪었고, 데칼을 살짝 띄우고 polygonOffset 을 줘서 고쳤습니다.",
    },
    {
      aspect: "클릭·호버",
      svg: "DOM 이벤트입니다. 키보드 포커스도 공짜입니다.",
      webgl: "광선을 쏴서 맞은 물체를 찾아야 합니다(레이캐스터). 키보드 접근은 따로 만들어야 합니다.",
    },
    {
      aspect: "시점 회전",
      svg: "투영식의 각도 하나입니다.",
      webgl: "카메라 방위각 하나입니다. 여기서는 두 방식의 비용이 같습니다.",
    },
    {
      aspect: "화면 개수",
      svg: "제한이 없습니다.",
      webgl: "브라우저의 WebGL 컨텍스트 상한(대개 16개)에 걸립니다. 목록에 관계도를 여러 개 놓는 화면이라면 이것이 곧 한계가 됩니다.",
    },
  ],
  closing:
    "만들어 보고 나서도 결론은 원본 문서와 같습니다 — 이 규모의 위젯에는 SVG 가 맞습니다. WebGL 이 값을 하는 지점은 원근, 조명, 수천 개의 인스턴스처럼 아핀 변환으로는 안 되는 것들인데, 자원 관계도에는 그 중 아무것도 필요하지 않습니다. 달라진 것은 근거입니다. 처음에는 표로 적은 예상이었고, 지금은 같은 도식을 두 번 만들어 본 실측입니다. 그리고 얻은 것도 있습니다: 한글을 WebGL 에 올리는 방법이 글리프 아틀라스만은 아니라는 것, 그리고 아이소메트릭 투영이 직교 카메라의 특수한 경우라는 것을 수식으로 확인했습니다(고각 35.264°, 오차 1e-13 px).",
};

/** 메인 페이지 미리보기 안내 문구 */
export const isoMapPreviewCopy = {
  title: "자원 관계를 계층 도식으로",
  lede: "표로는 추적할 수 없는 자원 간 경로를, 계층이 한 방향으로 흐르는 아이소메트릭 도식으로 옮긴 것입니다. 박스에 커서를 올리면 그 자원이 실제로 연결된 경로만 남습니다.",
  demoLink: "회전·확대를 포함한 전체 데모 열기",
  demoLinkNote: "3D 와 평면도를 같은 데이터로 전환하고, 시점을 직접 돌려볼 수 있습니다.",
  note: "렌더러는 VPC 나 서브넷이라는 개념을 모릅니다. 어댑터가 배치와 색까지 계산해 장면 객체로 넘기고, 렌더러는 그것을 그리기만 합니다. 다른 자원 관계도가 필요해지면 어댑터만 새로 씁니다.",
};
