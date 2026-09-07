import type { NativeToWeb, WebToNative } from "./types";

/** 네이티브 셸 안에서 실행 중인지 여부. 브라우저에서는 항상 false. */
export function hasNativeBridge(): boolean {
  return typeof window !== "undefined" && Boolean(window.ReactNativeWebView);
}

/** 웹 → 네이티브. 브릿지가 없으면 조용히 무시한다. */
export function postToNative(message: WebToNative): void {
  if (!hasNativeBridge()) return;
  try {
    window.ReactNativeWebView?.postMessage(JSON.stringify(message));
  } catch {
    // 브릿지 전송 실패가 웹 동작을 막지 않도록 삼킨다.
  }
}

type Handler = (message: NativeToWeb) => void;

/**
 * 네이티브 → 웹 수신 등록. 반환값을 호출하면 해제된다.
 * 네이티브가 문자열을 넘기므로 파싱 실패를 여기서 흡수한다.
 */
export function subscribeToNative(handler: Handler): () => void {
  if (typeof window === "undefined") return () => {};

  const receive = (raw: string) => {
    try {
      handler(JSON.parse(raw) as NativeToWeb);
    } catch {
      // 형식이 맞지 않는 메시지는 버린다.
    }
  };

  window.__onNativeMessage = receive;
  return () => {
    if (window.__onNativeMessage === receive) delete window.__onNativeMessage;
  };
}
