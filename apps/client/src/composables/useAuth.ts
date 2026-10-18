// src/composables/useAuth.ts
import { ref } from "vue";
import { useRoute, useRouter } from "vue-router";
import authService from "@/api/authService";
import { useAuthStore } from "@/store/auth";
import type {
  ChangePasswordParams,
  DevLoginParams,
  ForgotPasswordParams,
  LoginParams,
  RegisterParams,
} from "@/types/api";

/**
 * 登录成功后的默认落地页
 *
 * 登录 / 注册页是独立页面，没有「上一页」时回到站点首页（时间轴）。
 */
const HOME_PATH = "/timeline";

/**
 * 登录态编排
 *
 * 串联「接口层」与「状态层」；视图只调用本组合式函数，
 * 不直接接触 axios，也不自行编排多步请求。
 */
export const useAuth = () => {
  const authStore = useAuthStore();
  const router = useRouter();
  const route = useRoute();
  /** 请求进行中，供视图禁用按钮、显示 loading */
  const submitting = ref(false);

  /**
   * 读取 `?redirect=` 参数（登录页链接会带上来源路径）
   *
   * ⚠️ 只接受站内绝对路径：以单个 `/` 开头，拒绝 `//evil.com` 这类协议相对地址。
   */
  const resolveRedirect = (): string => {
    const { redirect } = route.query;
    if (typeof redirect === "string" && redirect.startsWith("/") && !redirect.startsWith("//")) {
      return redirect;
    }
    return HOME_PATH;
  };

  /**
   * 手机号登录：换取令牌与用户信息 → 写入状态层 → 跳转目标页
   * @throws {ApiError} 手机号 / 密码错误、验证码错误、账号被禁用等，由视图捕获后提示
   */
  const login = async (params: LoginParams): Promise<void> => {
    submitting.value = true;
    try {
      const { data } = await authService.login(params);
      authStore.setSession(data);
      await router.replace(resolveRedirect());
    } finally {
      submitting.value = false;
    }
  };

  /**
   * 本地开发自动登录（跳过图形验证码）
   *
   * 只在 `import.meta.env.DEV` 下由登录页调用；入参可由前端 .env 提供，
   * 也可省略交给 server/.env 的 `DEV_LOGIN_*`。生产构建不会触发。
   * @throws {ApiError} 服务端未开启开发登录、账号或密码错误等
   */
  const devLogin = async (params?: DevLoginParams): Promise<void> => {
    submitting.value = true;
    try {
      const { data } = await authService.devLogin(params);
      authStore.setSession(data);
      await router.replace(resolveRedirect());
    } finally {
      submitting.value = false;
    }
  };

  /**
   * 注册：服务端注册成功的同时签发双令牌，直接建立会话
   * @throws {ApiError} 用户名 / 手机号重复、验证码错误等，由视图捕获后提示
   */
  const register = async (params: RegisterParams): Promise<void> => {
    submitting.value = true;
    try {
      const { data } = await authService.register(params);
      authStore.setSession(data);
      await router.replace(resolveRedirect());
    } finally {
      submitting.value = false;
    }
  };

  /**
   * 忘记密码：手机号 + 图形验证码 + 新密码
   * @throws {ApiError} 验证码错误、手机号未注册等，由视图捕获后提示
   */
  const forgotPassword = async (params: ForgotPasswordParams): Promise<void> => {
    submitting.value = true;
    try {
      await authService.forgotPassword(params);
    } finally {
      submitting.value = false;
    }
  };

  /**
   * 修改密码（已登录，校验旧密码）
   * @throws {ApiError} 旧密码错误、新密码不合法等，由视图捕获后提示
   */
  const changePassword = async (params: ChangePasswordParams): Promise<void> => {
    submitting.value = true;
    try {
      await authService.changePassword(params);
    } finally {
      submitting.value = false;
    }
  };

  /**
   * 退出登录：清空会话
   *
   * client 的页面都是公开的，退出后停留在当前页即可；
   * 只有站在登录 / 注册 / 找回密码页时才需要离开。
   */
  const logout = async (): Promise<void> => {
    authStore.clearSession();
    // 若本机配置了 .env 自动登录，置标记避免退出后被立刻登录回去
    sessionStorage.setItem("__dev_skip_auto_login", "1");
    if (route.name === "Login" || route.name === "Register" || route.name === "ForgotPassword") {
      await router.replace(HOME_PATH);
    }
  };

  /**
   * 刷新用户信息
   *
   * 令牌持久化在 localStorage，角色 / 权限可能在后台被调整过（例如会员申请通过），
   * 进入页面时补拉一次，保证 Header 与权限判断是最新的。
   */
  const loadUser = async (): Promise<void> => {
    if (!authStore.isAuthenticated) {
      return;
    }
    try {
      const { data } = await authService.getUserInfo();
      authStore.setUser(data);
    } catch {
      // 401 时 axiosInstance 已清理会话，此处只保证不向上抛出
    }
  };

  return {
    authStore,
    submitting,
    login,
    devLogin,
    register,
    forgotPassword,
    changePassword,
    logout,
    loadUser,
  };
};
