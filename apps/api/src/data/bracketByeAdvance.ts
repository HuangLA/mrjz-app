export interface BracketByeCandidate {
  nodeId: string;
  bracketGroup: string;
  radiantTeamId: string | null;
  direTeamId: string | null;
  incomingSlotKeys: ReadonlySet<string>;
}

/**
 * A single-team node is a real bye only when nothing upstream can still feed
 * its empty slot. Nodes waiting on an incoming winner (for example the grand
 * final waiting on the loser bracket final) must never auto-advance.
 */
export function shouldAutoAdvanceBracketNode(candidate: BracketByeCandidate): boolean {
  if (candidate.bracketGroup === "grand_final") {
    return false;
  }

  const hasRadiant = candidate.radiantTeamId !== null;
  const hasDire = candidate.direTeamId !== null;

  if (hasRadiant === hasDire) {
    return false;
  }

  const emptySlot = hasRadiant ? "dire" : "radiant";
  return !candidate.incomingSlotKeys.has(`${candidate.nodeId}:${emptySlot}`);
}
