import { TeamsContent } from "./Content";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";

export default function TeamsPage() {
  useMiniProgramShare(() => mainTabShareConfig("teams"));

  return <TeamsContent />;
}
