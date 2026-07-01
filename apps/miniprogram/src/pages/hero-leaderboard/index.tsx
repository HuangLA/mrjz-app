import { HeroLeaderboardContent } from "./Content";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";

export default function HeroLeaderboardPage() {
  useMiniProgramShare(() => mainTabShareConfig("leaderboard"));

  return <HeroLeaderboardContent />;
}
