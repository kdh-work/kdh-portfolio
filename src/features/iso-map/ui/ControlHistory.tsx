import { controlHistory } from "@/content/isoMap";
import { HistoryReport } from "./HistoryReport";

/** 회전·확대·이동을 붙이며 겪은 것. */
export function ControlHistory() {
  return (
    <HistoryReport data={controlHistory} threadHeadingId="control-thread-h" />
  );
}
