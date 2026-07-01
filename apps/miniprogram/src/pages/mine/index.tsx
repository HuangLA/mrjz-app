import { MineContent } from "./Content";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";

export default function MinePage() {
  useMiniProgramShare(() => mainTabShareConfig("mine"));

  return <MineContent />;
}
