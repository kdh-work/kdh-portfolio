/**
 * WebView 브릿지 메시지 계약.
 *
 * 웹과 네이티브가 주고받는 메시지를 한곳에 타입으로 고정해두고,
 * 양쪽이 같은 파일을 참조하도록 한다. 계약을 문서가 아니라 타입으로
 * 두는 이유는, 한쪽만 바뀌었을 때 컴파일 단계에서 드러나게 하기 위함이다.
 *
 * 아직 네이티브 셸은 구현하지 않았다. 브라우저에서는 브릿지가 없는 것으로
 * 판단해 모든 호출이 무시되고, 웹 단독 동작에 영향을 주지 않는다.
 */

/** 웹 → 네이티브 */
export type WebToNative =
  | { type: "ready"; payload: { path: string } }
  /** 웹 히스토리 깊이를 알려, 네이티브가 뒤로 가기를 앱 종료로 처리할지 판단하게 한다 */
  | { type: "history:changed"; payload: { path: string; canGoBack: boolean } }
  | { type: "share"; payload: { url: string; title: string } }
  | { type: "haptic"; payload: { style: "light" | "medium" } }
  | { type: "open-external"; payload: { url: string } };

/** 네이티브 → 웹 */
export type NativeToWeb =
  /** 노치·홈 인디케이터 영역. CSS 변수로 주입한다. */
  | { type: "safe-area"; payload: { top: number; bottom: number } }
  | { type: "theme"; payload: { scheme: "light" | "dark" } }
  /** 안드로이드 하드웨어 뒤로 가기 */
  | { type: "back-pressed" }
  | { type: "network"; payload: { online: boolean } };

export type BridgeMessage = WebToNative | NativeToWeb;

/** 네이티브가 WebView 에 주입하는 핸들러 */
export type NativeBridge = { postMessage: (raw: string) => void };

declare global {
  interface Window {
    /** React Native WebView 가 주입하는 객체 */
    ReactNativeWebView?: NativeBridge;
    /** 네이티브 → 웹 메시지 수신 진입점 */
    __onNativeMessage?: (raw: string) => void;
  }
}
