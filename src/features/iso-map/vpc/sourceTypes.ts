/**
 * AWS VPC 자원 맵 어댑터의 **입력** 타입.
 *
 * `/network/vpcs/resource-map/{vpcId}` 응답 중 관계도에 필요한 부분만 추린 구조적
 * 부분집합이라, VpcDetail 이 `CmpVpcResourceMap` 에 넘기는 값을 그대로 꽂아도 된다.
 * 응답을 손대지 않고 받으므로 배열 누락과 `name: null` 가능성을 타입에 남겨둔다.
 */

export interface IsoSourceSubnet {
  subnetId: string;
  name?: string | null;
  cidrBlock?: string | null;
  routeTableId?: string | null;
}

export interface IsoSourceSubnetGroup {
  availabilityZone: string;
  subnetList?: IsoSourceSubnet[] | null;
}

/** 라우팅 테이블이 참조하는 라우트 대상. 여기에는 `state` 가 있다. */
export interface IsoSourceRouteTarget {
  id: string;
  name?: string | null;
  type: string;
  state?: string | null;
}

export interface IsoSourceRouteTable {
  routeTableId: string;
  name?: string | null;
  connectWith?: IsoSourceRouteTarget[] | null;
}

/**
 * VPC 의 네트워크 자원 목록. 라우트 대상과 달리 `state` 가 없다.
 * 어느 라우팅 테이블도 참조하지 않는 자원도 여기에는 들어 있으므로,
 * 관계도의 네트워크 그룹은 이 목록을 기준으로 삼는다.
 */
export interface IsoSourceNetworkResource {
  id: string;
  name?: string | null;
  type: string;
}

export interface IsoVpcSource {
  vpcResourceMap?: { vpcId?: string; name?: string | null } | null;
  subnetGroupList?: IsoSourceSubnetGroup[] | null;
  routeTableResourceMapList?: IsoSourceRouteTable[] | null;
  networkResourceMapList?: IsoSourceNetworkResource[] | null;
}
