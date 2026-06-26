export type OpenDotaDraftAction = {
  order?: number;
  ord?: number;
  is_pick?: boolean;
  team?: number;
  hero_id?: number;
  player_slot?: number;
};

export type OpenDotaAbilityUpgrade = {
  ability?: number;
  ability_id?: number;
  level?: number;
  time?: number;
};

export type OpenDotaPermanentBuff = {
  permanent_buff?: number | string;
  permanent_buff_id?: number | string;
  name?: string;
  key?: string;
  stack_count?: number;
  grant_time?: number;
};

export type OpenDotaWardLogEntry = {
  time?: number;
  player_slot?: number;
  x?: number;
  y?: number;
  z?: number;
  entityleft?: number;
  key?: string;
};

export type OpenDotaPurchaseLogEntry = {
  time?: number;
  key?: string;
  charges?: number;
};

export type OpenDotaChatMessage = {
  time?: number;
  type?: string;
  unit?: string;
  key?: string | number;
  player_slot?: number;
  slot?: number;
};

export type OpenDotaObjective = {
  time?: number;
  type?: string;
  team?: number;
  player_slot?: number;
  slot?: number;
  key?: string | number;
};

export type OpenDotaMatchPlayer = {
  account_id?: number;
  player_slot: number;
  personaname?: string;
  name?: string;
  player_name?: string;
  hero_id?: number;
  level?: number;
  kills?: number;
  deaths?: number;
  assists?: number;
  gold_per_min?: number;
  xp_per_min?: number;
  net_worth?: number;
  gold?: number;
  total_gold?: number;
  last_hits?: number;
  denies?: number;
  hero_damage?: number;
  tower_damage?: number;
  hero_healing?: number;
  damage_taken?: number | Record<string, number>;
  actions_per_min?: number;
  pings?: number;
  stuns?: number;
  neutral_kills?: number;
  lane?: number;
  lane_role?: number;
  purchase?: Record<string, number>;
  purchase_log?: OpenDotaPurchaseLogEntry[];
  multi_kills?: Record<string, number>;
  item_0?: number;
  item_1?: number;
  item_2?: number;
  item_3?: number;
  item_4?: number;
  item_5?: number;
  backpack_0?: number;
  backpack_1?: number;
  backpack_2?: number;
  item_neutral?: number;
  aghanim_scepter?: number;
  aghanim_shard?: number;
  aghanims_scepter?: number;
  aghanims_shard?: number;
  ability_upgrades_arr?: number[];
  ability_upgrades?: OpenDotaAbilityUpgrade[];
  permanent_buffs?: OpenDotaPermanentBuff[];
  obs_log?: OpenDotaWardLogEntry[];
  sen_log?: OpenDotaWardLogEntry[];
  gold_t?: number[];
  xp_t?: number[];
};

export type OpenDotaMatchDetail = {
  match_id: number;
  leagueid?: number;
  league_id?: number;
  league?: {
    leagueid?: number;
    name?: string;
  };
  radiant_win?: boolean;
  radiant_score?: number;
  dire_score?: number;
  radiant_name?: string;
  dire_name?: string;
  radiant_team_id?: number;
  dire_team_id?: number;
  duration?: number;
  game_mode?: number;
  start_time?: number;
  version?: number;
  players?: OpenDotaMatchPlayer[];
  picks_bans?: OpenDotaDraftAction[];
  chat?: OpenDotaChatMessage[];
  objectives?: OpenDotaObjective[];
};

export type OpenDotaLeagueMatch = {
  match_id?: number;
  leagueid?: number;
  league_id?: number;
  start_time?: number;
  radiant_win?: boolean;
  radiant_score?: number;
  dire_score?: number;
  duration?: number;
  version?: number;
};

export type OpenDotaPlayerMatchSummary = {
  match_id?: number;
  start_time?: number;
  duration?: number;
  game_mode?: number;
  lobby_type?: number;
  version?: number | null;
};

export type OpenDotaPlayerProfile = {
  profile?: {
    account_id?: number;
    steamid?: string;
    personaname?: string;
    name?: string;
    avatar?: string;
    avatarmedium?: string;
    avatarfull?: string;
    profileurl?: string;
  };
};

export type SteamLeagueMatch = {
  match_id?: number;
  match_seq_num?: number;
  start_time?: number;
  lobby_type?: number;
  radiant_team_id?: number;
  dire_team_id?: number;
};
