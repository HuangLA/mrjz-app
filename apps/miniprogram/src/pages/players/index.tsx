import { PlayersContent } from "./Content";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";

export default function PlayersPage() {
  useMiniProgramShare(() => mainTabShareConfig("players"));

  return <PlayersContent />;
}
