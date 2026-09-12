import { pinStudy } from "@/content/isoMap";
import { HistoryReport } from "./HistoryReport";

/** 자원 이름을 박스에서 떼어 콜아웃 핀으로 옮기며 겪은 것. */
export function PinStudy() {
  return <HistoryReport data={pinStudy} threadHeadingId="pin-thread-h" />;
}
