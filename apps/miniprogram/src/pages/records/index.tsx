import { RecordsContent } from "./Content";
import { mainTabShareConfig, useMiniProgramShare } from "../../share";

export default function RecordsPage() {
  useMiniProgramShare(() => mainTabShareConfig("records"));

  return <RecordsContent />;
}
