import { createRouter, createWebHistory } from "vue-router";
import type { LocationQueryValue, RouteLocationNormalizedLoaded, RouteRecordRaw } from "vue-router";

import Layout from "@/components/Layout.vue";
import authService from "@/api/authService";
import { useAuthStore } from "@/store/auth";

const routes: Array<RouteRecordRaw> = [
  // 登录 / 注册是独立页面（不套 Layout），视觉上是整页的手绘卡片
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/Auth/Login.vue"),
    meta: { title: "登录" },
  },
  {
    path: "/register",
    name: "Register",
    component: () => import("@/views/Auth/Register.vue"),
    meta: { title: "注册" },
  },
  {
    path: "/forgot-password",
    name: "ForgotPassword",
    component: () => import("@/views/Auth/ForgotPassword.vue"),
    meta: { title: "找回密码" },
  },
  {
    path: "/",
    component: Layout,
    redirect: "/timeline",
    children: [
      {
        path: "/timeline",
        name: "Timeline",
        component: () => import("@/views/Timeline/index.vue"),
        meta: {
          title: "时间轴",
          // 面包屑分区：当前路径就是分区落地页，因此只显示这一段，不重复页面标题
          section: { en: "TIMELINE", zh: "时间轴", to: "/timeline", navOrder: 1 },
        },
      },
      // 兼容旧书签：原首页 /home 已替换为时间轴
      {
        path: "/home",
        redirect: "/timeline",
      },
      {
        path: "/notes",
        name: "Notes",
        component: () => import("@/views/Notes/index.vue"),
        meta: {
          title: "Unreal Engine 攻略笔记",
          section: { en: "NOTES", zh: "攻略笔记", to: "/notes", navOrder: 2 },
        },
      },
      {
        path: "/notes/:id",
        name: "NotesDetail",
        component: () => import("@/views/NotesDetail/index.vue"),
        props: true,
        meta: {
          // meta 的值类型是 unknown，这里显式收窄而不使用 any
          title: (route: RouteLocationNormalizedLoaded) => (typeof route.query.title === "string" && route.query.title) || "笔记详情",
          // 详情页复用所属分区的面包屑，不再依赖 ?parent= 查询参数传入来源
          section: { en: "NOTES", zh: "攻略笔记", to: "/notes" },
        },
      },
      {
        path: "/articles",
        name: "ArticlesLibrary",
        component: () => import("@/views/ArticlesLibrary/index.vue"),
        meta: {
          title: "文章库",
          // navOrder 让这一项自动出现在顶部导航；to 与 path 相同，
          // 因此面包屑只显示分区，不再重复页面标题
          section: { en: "ARTICLES", zh: "文章库", to: "/articles", navOrder: 3 },
        },
      },
      {
        path: "/articles/:id",
        name: "ArticlesDetail",
        component: () => import("@/views/Articles/index.vue"),
        props: true,
        meta: {
          title: (route: RouteLocationNormalizedLoaded) => (typeof route.query.title === "string" && route.query.title) || "文章详情",
          // 详情页复用文章库分区，面包屑的分区名可点击回列表
          section: { en: "ARTICLES", zh: "文章库", to: "/articles" },
        },
      },
      {
        path: "/library",
        name: "Library",
        component: () => import("@/views/Library/index.vue"),
        meta: {
          title: "书库",
          section: { en: "LIBRARY", zh: "书库", to: "/library", navOrder: 4 },
          // 书库列表已对游客开放；VIP 内容的访问控制在服务端按 is_free / library:view 判定
        },
      },
      {
        path: "/library/:id",
        name: "LibraryDetail",
        component: () => import("@/views/LibraryDetail/index.vue"),
        props: true,
        meta: {
          title: (route: RouteLocationNormalizedLoaded) => (typeof route.query.title === "string" && route.query.title) || "阅读",
          section: { en: "LIBRARY", zh: "书库", to: "/library" },
        },
      },
      {
        path: "/account",
        name: "Account",
        component: () => import("@/views/Account/index.vue"),
        meta: { title: "个人中心", requiresAuth: true },
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/**
 * 从 query 中取出合法的站内重定向地址
 *
 * ⚠️ 只接受以单个 `/` 开头的路径，拒绝 `//evil.com` 这类协议相对地址。
 */
const resolveRedirectQuery = (value: LocationQueryValue | LocationQueryValue[]): string => {
  if (typeof value === "string" && value.startsWith("/") && !value.startsWith("//")) {
    return value;
  }
  return "/timeline";
};

/**
 * 补齐当前登录用户信息
 *
 * 令牌持久化在 localStorage，刷新后 user（含 permissions）可能为空；
 * 权限判断必须先拿到它。失败时统一按「登录态失效」处理。
 */
const ensureUserLoaded = async (force = false): Promise<boolean> => {
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    return false;
  }
  if (authStore.user && !force) {
    return true;
  }

  try {
    const { data } = await authService.getUserInfo();
    authStore.setUser(data);
    return true;
  } catch {
    // 401 时 axiosInstance 已清理会话
    authStore.clearSession();
    return false;
  }
};

const AUTH_PAGES = new Set(["Login", "Register", "ForgotPassword"]);

/**
 * 导航守卫
 *
 * - 已登录用户不再停留在登录 / 注册 / 找回密码页；
 * - 需要登录的页面（个人中心）未登录时送到登录页并带上 redirect；
 * - 需要权限的页面沿用 meta.permission：登录但权限不足时送到个人中心的升级入口。
 *   书库与笔记不对路由设限，VIP 内容由服务端按 is_free / library:view 判定。
 */
router.beforeEach(async (to) => {
  const authStore = useAuthStore();

  if (typeof to.name === "string" && AUTH_PAGES.has(to.name) && authStore.isAuthenticated) {
    return resolveRedirectQuery(to.query.redirect);
  }

  if (to.meta.requiresAuth) {
    if (!(await ensureUserLoaded())) {
      return { name: "Login", query: { redirect: to.fullPath } };
    }

    if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
      // 幂等：会员申请可能已经在后台通过，只是本地缓存的角色还没更新。
      // 先用最新用户信息再判一次，避免把已升级的用户挡在书库外。
      const refreshed = await ensureUserLoaded(true);
      if (refreshed && authStore.hasPermission(to.meta.permission)) {
        return true;
      }
      return { name: "Account", query: { upgrade: "1", redirect: to.fullPath } };
    }
  }

  return true;
});

export default router;
