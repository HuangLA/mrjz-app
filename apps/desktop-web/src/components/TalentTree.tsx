import type { PlayerStats } from "../data";
import { clampNumber, defaultTalentTreeNodes, talentArcDots, talentBranchPath } from "../utils";

export function TalentTreeLegend({ player }: { player: PlayerStats }) {
  const pickedCount = player.talentTree.filter((node) => node.picked).length;
  const title = pickedCount > 0 ? `天赋树 已选择 ${pickedCount}/8` : "天赋树 暂无可识别选择";

  return (
    <span className="talent-tree-mini" title={title}>
      <TalentTreeSvg player={player} />
    </span>
  );
}

function TalentTreeSvg({ player }: { player: PlayerStats }) {
  const prefix = `talent-${String(player.id).replace(/[^a-zA-Z0-9_-]/g, "") || "x"}`;
  const nodes = player.talentTree.length > 0 ? player.talentTree : defaultTalentTreeNodes();
  const pickedCount = nodes.filter((node) => node.picked).length;

  return (
    <svg className="talent-tree-svg" viewBox="0 0 32 32" aria-hidden="true">
      <defs>
        <linearGradient
          id={`${prefix}-copper-left`}
          gradientUnits="userSpaceOnUse"
          x1="4.68"
          y1="3.66"
          x2="35.93"
          y2="57.79"
        >
          <stop offset="0.0938" stopColor="rgb(231, 189, 118)" />
          <stop offset="0.2261" stopColor="rgb(201, 108, 53)" />
          <stop offset="0.4401" stopColor="rgb(207, 126, 65)" />
          <stop offset="0.5891" stopColor="rgb(215, 148, 84)" />
          <stop offset="0.7585" stopColor="rgb(229, 185, 114)" />
          <stop offset="1" stopColor="rgb(242, 214, 139)" />
        </linearGradient>
        <linearGradient
          id={`${prefix}-copper-right`}
          gradientUnits="userSpaceOnUse"
          x1="-7.88"
          y1="3.66"
          x2="23.37"
          y2="57.79"
          gradientTransform="matrix(-1 0 0 1 38.4375 0)"
        >
          <stop offset="0.0938" stopColor="rgb(231, 189, 118)" />
          <stop offset="0.2261" stopColor="rgb(201, 108, 53)" />
          <stop offset="0.4401" stopColor="rgb(207, 126, 65)" />
          <stop offset="0.5891" stopColor="rgb(215, 148, 84)" />
          <stop offset="0.7585" stopColor="rgb(229, 185, 114)" />
          <stop offset="1" stopColor="rgb(242, 214, 139)" />
        </linearGradient>
        <linearGradient
          id={`${prefix}-copper-dot`}
          gradientUnits="userSpaceOnUse"
          x1="3"
          y1="22"
          x2="27"
          y2="31"
        >
          <stop offset="0.1257" stopColor="rgb(231, 189, 118)" />
          <stop offset="0.3335" stopColor="rgb(204, 117, 59)" />
          <stop offset="0.8908" stopColor="rgb(201, 109, 52)" />
          <stop offset="0.9891" stopColor="rgb(229, 185, 114)" />
        </linearGradient>
      </defs>
      <svg
        viewBox="0 0 51 63"
        height="23"
        y="4.45"
        className="talent-branch-copy"
        preserveAspectRatio="xMidYMin meet"
      >
        {nodes
          .filter((node) => !node.picked)
          .map((node) => (
            <TalentBranchPath key={`${node.tier}:${node.side}:off`} node={node} prefix={prefix} />
          ))}
        {nodes
          .filter((node) => node.picked)
          .map((node) => (
            <TalentBranchPath key={`${node.tier}:${node.side}:on`} node={node} prefix={prefix} />
          ))}
      </svg>
      <TalentTreeArc prefix={prefix} pickedCount={pickedCount} />
    </svg>
  );
}

function TalentBranchPath({
  node,
  prefix,
}: {
  node: PlayerStats["talentTree"][number];
  prefix: string;
}) {
  const title = `${node.tier === 1 ? "10" : node.tier === 2 ? "15" : node.tier === 3 ? "20" : "25"}级天赋${
    node.picked ? " 已选择" : ""
  }`;
  const fill = node.picked ? `url(#${prefix}-copper-${node.side})` : "hsl(0,0%,28%)";

  return (
    <path
      className={`talent-branch ${node.picked ? "picked" : "off"}`}
      fill={fill}
      d={talentBranchPath(node.tier, node.side)}
    >
      <title>{title}</title>
    </path>
  );
}

function TalentTreeArc({ prefix, pickedCount }: { prefix: string; pickedCount: number }) {
  const activeDots = clampNumber(pickedCount, 0, 7);

  return (
    <>
      {talentArcDots.map((path, index) => (
        <path
          key={path}
          className={`talent-arc-dot ${index < activeDots ? "picked" : ""}`}
          fill={index < activeDots ? `url(#${prefix}-copper-dot)` : "hsla(0,0%,100%,0.12)"}
          d={path}
        />
      ))}
      <path
        className="talent-arc"
        d="M1.974 21.886a15.733 15.733 0 01-1.307-6.302C.667 6.983 7.537 0 16 0c8.463 0 15.333 6.983 15.333 15.584 0 2.226-.46 4.343-1.288 6.259a3.35 3.35 0 00-.942-.549 14.626 14.626 0 001.152-5.71c0-7.996-6.387-14.488-14.255-14.488-7.867 0-14.255 6.492-14.255 14.488 0 2.042.417 3.986 1.169 5.75a3.36 3.36 0 00-.94.552z"
      />
    </>
  );
}

export function AbilityFallbackGlyph({
  kind,
}: {
  kind: "ability" | "talent" | "attribute" | "empty" | undefined;
}) {
  if (kind === "attribute") {
    return (
      <svg className="ability-fallback-svg attribute-glyph" viewBox="0 0 32 32" aria-hidden="true">
        <circle cx="16" cy="16" r="12" />
        <circle cx="16" cy="5" r="2" />
        <circle cx="24" cy="9" r="2" />
        <circle cx="27" cy="18" r="2" />
        <circle cx="20" cy="26" r="2" />
        <circle cx="10" cy="26" r="2" />
        <circle cx="5" cy="17" r="2" />
        <circle cx="8" cy="9" r="2" />
      </svg>
    );
  }

  return (
    <svg className="ability-fallback-svg talent-glyph" viewBox="0 0 32 32" aria-hidden="true">
      <path d="M16 29V7" />
      <path d="M16 21C11 21 8 18 6 14" />
      <path d="M16 18c5 0 8-3 10-8" />
      <path d="M16 12c-3 0-5-2-6-6" />
      <path d="M16 10c3 0 5-2 6-6" />
      <circle cx="16" cy="7" r="2.2" />
      <circle cx="6" cy="14" r="2" />
      <circle cx="26" cy="10" r="2" />
      <circle cx="16" cy="29" r="2" />
    </svg>
  );
}
