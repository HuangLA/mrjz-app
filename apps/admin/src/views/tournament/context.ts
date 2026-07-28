import type { AdminData } from "../../app/store";
import type { SeriesSummary, StageSummary, TeamBrief, Tone } from "../../api";

export interface TournamentCtx {
  data: AdminData;
  stage: StageSummary | null;
  officialStages: StageSummary[];
  availableTeams: TeamBrief[];
  published: boolean;
  load: (preferredTournamentId?: string, preferredStageId?: string) => Promise<void>;
  runAction: (
    label: string,
    method: "POST" | "PATCH" | "DELETE",
    path: string,
    payload?: Record<string, unknown>,
    options?: { nextStageId?: string; silent?: boolean },
  ) => Promise<{ ok: boolean; status: number; message: string; data?: unknown }>;
  notify: (tone: Tone, text: string) => void;
}

export type { SeriesSummary };
