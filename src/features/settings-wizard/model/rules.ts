import type { RuleName, Values } from "./types";

const RE_HOST = /^(?:\d{1,3}(?:\.\d{1,3}){3}|[a-zA-Z][a-zA-Z0-9.-]*)$/;
const RE_IPV4 = /^\d{1,3}(?:\.\d{1,3}){3}$/;

function isIpv4(value: string): boolean {
  if (!RE_IPV4.test(value)) return false;
  return value.split(".").every((part) => {
    const n = Number(part);
    return n >= 0 && n <= 255;
  });
}

function isIntInRange(value: string, lo: number, hi: number): boolean {
  if (!/^\d+$/.test(value)) return false;
  const n = Number(value);
  return n >= lo && n <= hi;
}

/** 값이 비어 있지 않을 때만 호출된다. 통과하면 null. */
export const rules: Record<RuleName, (value: string, all: Values) => string | null> = {
  host(value) {
    if (!RE_HOST.test(value)) return "IP 주소 또는 호스트명 형식으로 입력하세요";
    if (RE_IPV4.test(value) && !isIpv4(value)) return "각 자리는 0에서 255 사이여야 합니다";
    return null;
  },
  port(value) {
    return isIntInRange(value, 1, 65535) ? null : "1에서 65535 사이의 숫자로 입력하세요";
  },
  ip(value) {
    return isIpv4(value) ? null : "0에서 255 사이 네 자리 IP 주소로 입력하세요";
  },
  url(value) {
    return /^https?:\/\/[^\s]+$/.test(value)
      ? null
      : "http:// 또는 https:// 로 시작하는 주소를 입력하세요";
  },
  secret(value) {
    return value.length >= 8 ? null : "8자 이상 입력하세요";
  },
  // 경고와 심각은 서로를 참조하는 교차 검증이다.
  percentWarn(value, all) {
    if (!isIntInRange(value, 0, 100)) return "0에서 100 사이의 숫자로 입력하세요";
    const crit = all.crit;
    if (crit && isIntInRange(crit, 0, 100) && Number(value) >= Number(crit)) {
      return "심각 임계값보다 작아야 합니다";
    }
    return null;
  },
  percentCrit(value, all) {
    if (!isIntInRange(value, 0, 100)) return "0에서 100 사이의 숫자로 입력하세요";
    const warn = all.warn;
    if (warn && isIntInRange(warn, 0, 100) && Number(value) <= Number(warn)) {
      return "경고 임계값보다 커야 합니다";
    }
    return null;
  },
};
