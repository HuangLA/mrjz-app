import { ScheduleContent } from "./Content";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";

export default function SchedulePage() {
  useMiniProgramShare(() => mainTabShareConfig("schedule"));

  return <ScheduleContent />;
}
