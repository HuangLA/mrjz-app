import Taro, {
  useDidShow,
  useShareAppMessage,
  useShareTimeline,
} from "@tarojs/taro";
import type {
  ShareAppMessageReturnObject,
  ShareTimelineReturnObject,
} from "@tarojs/taro";

export type ShareRouteKey =
  | "home"
  | "stage"
  | "schedule"
  | "records"
  | "leaderboard"
  | "players"
  | "teams"
  | "mine";

export type MiniProgramShareConfig = {
  title?: string;
  path?: string;
  imageUrl?: string;
};

const DEFAULT_SHARE_TITLE = "每日节奏杯 MRJZ";
const DEFAULT_SHARE_PATH = "/pages/index/index";

const routeShareMeta: Record<ShareRouteKey, { title: string; path: string }> = {
  home: {
    title: DEFAULT_SHARE_TITLE,
    path: DEFAULT_SHARE_PATH,
  },
  stage: {
    title: "每日节奏杯赛事阶段",
    path: "/pages/index/index?tab=stage",
  },
  schedule: {
    title: "每日节奏杯赛程",
    path: "/pages/index/index?tab=schedule",
  },
  records: {
    title: "每日节奏杯战报记录",
    path: "/pages/index/index?tab=records",
  },
  leaderboard: {
    title: "每日节奏杯英雄榜",
    path: "/pages/index/index?tab=leaderboard",
  },
  players: {
    title: "每日节奏杯选手榜",
    path: "/pages/index/index?tab=players",
  },
  teams: {
    title: "每日节奏杯队伍",
    path: "/pages/index/index?tab=teams",
  },
  mine: {
    title: DEFAULT_SHARE_TITLE,
    path: DEFAULT_SHARE_PATH,
  },
};

export function useMiniProgramShare(
  resolveConfig: () => MiniProgramShareConfig = () => ({}),
): void {
  useDidShow(() => {
    showMiniProgramShareMenu();
  });

  useShareAppMessage((): ShareAppMessageReturnObject => {
    const config = normalizeShareConfig(resolveConfig());
    const result: ShareAppMessageReturnObject = {
      title: config.title,
      path: config.path,
    };

    if (config.imageUrl) {
      result.imageUrl = config.imageUrl;
    }

    return result;
  });

  useShareTimeline((): ShareTimelineReturnObject => {
    const config = normalizeShareConfig(resolveConfig());
    const result: ShareTimelineReturnObject = {
      title: config.title,
      query: shareQueryFromPath(config.path),
    };

    if (config.imageUrl) {
      result.imageUrl = config.imageUrl;
    }

    return result;
  });
}

export function mainTabShareConfig(routeKey: ShareRouteKey): MiniProgramShareConfig {
  return routeShareMeta[routeKey] ?? routeShareMeta.home;
}

export function miniProgramSharePath(
  route: string,
  params?: Record<string, string | number | null | undefined>,
): string {
  const normalizedRoute = route.startsWith("/") ? route : `/${route}`;
  const query = Object.entries(params ?? {})
    .filter(([, value]) => value !== null && value !== undefined && String(value).length > 0)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
    .join("&");

  return query ? `${normalizedRoute}?${query}` : normalizedRoute;
}

function normalizeShareConfig(config: MiniProgramShareConfig): Required<MiniProgramShareConfig> {
  return {
    title: config.title?.trim() || DEFAULT_SHARE_TITLE,
    path: normalizeSharePath(config.path),
    imageUrl: config.imageUrl?.trim() || "",
  };
}

function normalizeSharePath(path?: string): string {
  if (!path?.trim()) {
    return DEFAULT_SHARE_PATH;
  }

  return path.startsWith("/") ? path : `/${path}`;
}

function shareQueryFromPath(path: string): string {
  const queryStart = path.indexOf("?");

  return queryStart >= 0 ? path.slice(queryStart + 1) : "";
}

function showMiniProgramShareMenu(): void {
  if (Taro.getEnv() !== Taro.ENV_TYPE.WEAPP || typeof Taro.showShareMenu !== "function") {
    return;
  }

  const option = {
    withShareTicket: true,
    menus: ["shareAppMessage", "shareTimeline"],
  } as unknown as Parameters<typeof Taro.showShareMenu>[0];

  void Taro.showShareMenu(option).catch(() => undefined);
}
