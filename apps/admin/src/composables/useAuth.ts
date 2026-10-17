// src/composables/useAuth.ts
import { ref } from "vue";
import { useRouter } from "vue-router";
import type { RouteLocationRaw } from "vue-router";
import authService from "@/api/authService";
import { useAuthStore } from "@/store/auth";
import type { LoginParams, User } from "@/types/api";

/**
 * 登录成功后的默认落地路由
 *
 * ✅ 决策：指向文章管理而非仪表盘。Dashboard 当前所有内容均被注释、渲染为空 div，
 * 登录后落到那里会让人误以为登录失败。与 router 守卫的 HOME_ROUTE 保持一致。
 */
const HOME_ROUTE = { name: "Articles" } as const;

/**
 * 登录态编排
 *
 * 串联「接口层」与「状态层」，视图只调用本组合式函数，
 * 不直接接触 axios，也不自行编排多步请求。
 */
export const useAuth = () => {
  const authStore = useAuthStore();
  const router = useRouter();
  /** 登录请求进行中，供视图禁用按钮、显示 loading */
  const submitting = ref(false);

  /** 读取 `?redirect=` 参数（路由守卫在跳转登录页时写入），缺省回到默认落地路由 */
  const resolveRedirect = (): RouteLocationRaw => {
    const { redirect } = router.currentRoute.value.query;
    return typeof redirect === "string" && redirect ? redirect : HOME_ROUTE;
  };

  /**
   * 登录：换取令牌 → 写入状态层 → 拉取用户信息 → 跳转目标页
   * @throws {ApiError} 用户名或密码错误等，由视图捕获后提示
   */
  const login = async (params: LoginParams): Promise<void> => {
    submitting.value = true;
    try {
      const tokens = await authService.login(params);
      authStore.setSession(tokens);

      const { data: user } = await authService.getUserInfo();
      authStore.setUser(user);

      await router.replace(resolveRedirect());
    } finally {
      submitting.value = false;
    }
  };

  /** 退出登录：清空会话后回到登录页 */
  const logout = async (): Promise<void> => {
    authStore.clearSession();
    await router.replace({ name: "Login" });
  };

  /**
   * 补齐用户信息
   * 令牌持久化在 localStorage，刷新页面后 user 可能为空，由布局层调用本方法补拉。
   * @returns 用户信息；未登录或请求失败时返回 null
   */
  const loadUser = async (): Promise<User | null> => {
    if (!authStore.isAuthenticated) {
      return null;
    }
    try {
      const { data: user } = await authService.getUserInfo();
      authStore.setUser(user);
      return user;
    } catch {
      // 令牌失效时响应拦截器已负责清理会话与跳转，此处仅保证不向上抛出
      return null;
    }
  };

  return { authStore, submitting, login, logout, loadUser };
};
