import { StageContent } from "./Content";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";

export default function StagePage() {
  useMiniProgramShare(() => mainTabShareConfig("stage"));

  return <StageContent />;
}
