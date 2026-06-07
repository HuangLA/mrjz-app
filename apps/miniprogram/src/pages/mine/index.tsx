import { Button, Input, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import {
  bindDotaAccount,
  getApiBaseUrl,
  getStoredAuthSession,
  loadMe,
  loadMyStats,
  loginWithWeChat,
  logout,
  setApiBaseUrl,
} from "../../api";
import { PageShell, SectionTitle } from "../../components";
import type { AppUserMe, AppUserStats, AuthSession } from "../../types";
import { formatDecimal, formatPercent, showToast } from "../../utils";

export default function MinePage() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [me, setMe] = useState<AppUserMe | null>(null);
  const [myStats, setMyStats] = useState<AppUserStats | null>(null);
  const [bindingInput, setBindingInput] = useState("");
  const [apiBase, setApiBase] = useState(getApiBaseUrl());
  const [loading, setLoading] = useState(false);
  const [bindingSaving, setBindingSaving] = useState(false);
  const [error, setError] = useState("");

  useDidShow(() => {
    const stored = getStoredAuthSession();
    setSession(stored);
    if (stored) {
      void refreshMine();
    } else {
      setMe(null);
      setMyStats(null);
    }
  });

  async function refreshMine() {
    setLoading(true);
    setError("");

    try {
      const [nextMe, nextStats] = await Promise.all([loadMe(), loadMyStats()]);
      setMe(nextMe);
      setMyStats(nextStats);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录状态读取失败");
      setSession(getStoredAuthSession());
    } finally {
      setLoading(false);
    }
  }

  async function handleLogin() {
    setLoading(true);
    setError("");

    try {
      const nextSession = await loginWithWeChat();
      setSession(nextSession);
      await refreshMine();
      showToast("登录成功", "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
      showToast("登录失败", "error");
    } finally {
      setLoading(false);
    }
  }

  async function handleLogout() {
    try {
      await logout();
    } catch {
      // Local session is cleared by the API helper even when the server session is already expired.
    }
    setSession(null);
    setMe(null);
    setMyStats(null);
    showToast("已退出");
  }

  async function handleBindAccount() {
    const value = bindingInput.trim();

    if (value.length === 0) {
      showToast("请输入账号", "error");
      return;
    }

    setBindingSaving(true);
    setError("");

    try {
      const isDotaAccountId = /^\d+$/.test(value) && value.length < 16;

      if (isDotaAccountId) {
        const accountId = Number(value);

        if (!Number.isSafeInteger(accountId) || accountId <= 0) {
          throw new Error("请输入有效的 Dota account_id");
        }

        await bindDotaAccount({ accountId });
      } else {
        await bindDotaAccount({ steamId: value });
      }
      setBindingInput("");
      await refreshMine();
      showToast("绑定成功", "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "绑定失败");
      showToast("绑定失败", "error");
    } finally {
      setBindingSaving(false);
    }
  }

  function handleSaveApiBase() {
    setApiBaseUrl(apiBase);
    showToast("API 地址已保存", "success");
  }

  return (
    <PageShell loading={false} error="">
      <View className="hero-panel">
        <Text className="kicker">微信登录</Text>
        <Text className="brand-title">{session ? me?.nickname ?? session.user.nickname : "未登录"}</Text>
        <Text className="brand-subtitle">登录后可在选手主页提交标签，并给已审核标签点赞 +1。</Text>
      </View>

      {error ? <View className="content-panel"><Text className="muted">{error}</Text></View> : null}

      <View className="action-row">
        {session ? (
          <>
            <Button className="secondary-button" loading={loading} onClick={() => void refreshMine()}>
              刷新状态
            </Button>
            <Button className="quick-button" onClick={() => void handleLogout()}>
              退出
            </Button>
          </>
        ) : (
          <Button className="primary-button" loading={loading} onClick={() => void handleLogin()}>
            微信登录
          </Button>
        )}
      </View>

      {session ? (
        <>
          <SectionTitle kicker="绑定" title="Dota / Steam 账号" />
          <View className="tag-editor">
            <Text className="state-text">可输入 Dota account_id 或 SteamID64。没有参赛记录也可以先绑定。</Text>
            {myStats?.binding ? (
              <View className="binding-card">
                <Text className="state-title">{myStats.binding.displayName}</Text>
                <Text className="state-text">account_id：{myStats.binding.accountId}</Text>
                <Text className="state-text">SteamID64：{myStats.binding.steamId64}</Text>
                <Text className="badge">{myStats.binding.verificationStatus === "verified" ? "已认证" : "未认证"}</Text>
              </View>
            ) : null}
            <View className="tag-input-row">
              <Input className="api-input" value={bindingInput} placeholder="Dota account_id / SteamID64" onInput={(event) => setBindingInput(String(event.detail.value))} />
              <Button className="primary-button" loading={bindingSaving} onClick={() => void handleBindAccount()}>
                绑定
              </Button>
            </View>
          </View>

          <SectionTitle kicker="我的" title="MRJZ 比赛数据" />
          {myStats?.emptyReason === "not_bound" ? (
            <View className="content-panel">
              <Text className="state-title">先绑定账号</Text>
              <Text className="state-text">绑定 Dota / Steam 数字账号后，这里会展示你在 MRJZ 联赛内的数据。</Text>
            </View>
          ) : myStats?.emptyReason === "no_matches" ? (
            <View className="content-panel">
              <Text className="state-title">暂无 MRJZ 联赛比赛记录</Text>
              <Text className="state-text">未来该账号出现在 MRJZ 比赛数据中后，这里会自动展示比赛结果。</Text>
            </View>
          ) : myStats ? (
            <>
              <View className="stat-grid mine-stat-grid">
                <View className="stat-cell"><Text className="stat-value">{myStats.stats.totalMatches}</Text><Text className="stat-hint">比赛</Text></View>
                <View className="stat-cell"><Text className="stat-value">{formatPercent(myStats.stats.winRate)}</Text><Text className="stat-hint">胜率</Text></View>
                <View className="stat-cell"><Text className="stat-value">{formatDecimal(myStats.stats.kda)}</Text><Text className="stat-hint">KDA</Text></View>
              </View>
              {myStats.tournamentHistory.slice(0, 3).map((entry) => (
                <View className="content-panel history-item" key={entry.tournamentId}>
                  <View>
                    <Text className="state-title">{entry.tournamentName}</Text>
                    <Text className="state-text">{entry.matches.length} 场 · {formatPercent(entry.stats.winRate)} 胜率</Text>
                  </View>
                  <Text className="badge">{entry.isCurrent ? "当前" : entry.status}</Text>
                </View>
              ))}
            </>
          ) : (
            <View className="content-panel"><Text className="muted">我的数据读取中。</Text></View>
          )}
        </>
      ) : null}

      <SectionTitle kicker="权限" title="互动能力" />
      <View className="content-panel">
        <Text className="state-title">选手标签</Text>
        <Text className="state-text">提交标签默认进入待审核；管理员通过后公开展示。</Text>
      </View>
      <View className="content-panel">
        <Text className="state-title">点赞 +1</Text>
        <Text className="state-text">只对已审核标签生效；同一用户对同一标签只能点赞一次。</Text>
      </View>

      <SectionTitle kicker="开发" title="API 地址" />
      <View className="tag-editor">
        <Input className="api-input" value={apiBase} placeholder="http://127.0.0.1:3001/api" onInput={(event) => setApiBase(String(event.detail.value))} />
        <View className="action-row">
          <Button className="secondary-button" onClick={handleSaveApiBase}>
            保存地址
          </Button>
        </View>
      </View>
    </PageShell>
  );
}
