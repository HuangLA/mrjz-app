import { Button, Input, Text, View } from "@tarojs/components";
import { useDidShow } from "@tarojs/taro";
import { useState } from "react";
import { clearStoredAuthSession, getApiBaseUrl, getStoredAuthSession, loadMe, loginWithWeChat, setApiBaseUrl } from "../../api";
import { PageShell, SectionTitle } from "../../components";
import type { AppUser, AuthSession } from "../../types";
import { showToast } from "../../utils";

export default function MinePage() {
  const [session, setSession] = useState<AuthSession | null>(() => getStoredAuthSession());
  const [me, setMe] = useState<AppUser | null>(null);
  const [apiBase, setApiBase] = useState(getApiBaseUrl());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useDidShow(() => {
    const stored = getStoredAuthSession();
    setSession(stored);
    if (stored) {
      void refreshMe();
    }
  });

  async function refreshMe() {
    setLoading(true);
    setError("");

    try {
      setMe(await loadMe());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录状态读取失败");
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
      setMe(nextSession.user);
      showToast("登录成功", "success");
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "登录失败");
      showToast("登录失败", "error");
    } finally {
      setLoading(false);
    }
  }

  function handleLogout() {
    clearStoredAuthSession();
    setSession(null);
    setMe(null);
    showToast("已退出");
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
            <Button className="secondary-button" loading={loading} onClick={() => void refreshMe()}>
              刷新状态
            </Button>
            <Button className="quick-button" onClick={handleLogout}>
              退出
            </Button>
          </>
        ) : (
          <Button className="primary-button" loading={loading} onClick={() => void handleLogin()}>
            微信登录
          </Button>
        )}
      </View>

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
