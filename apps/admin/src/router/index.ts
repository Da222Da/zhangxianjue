import { createRouter, createWebHistory } from "vue-router";
import type { LocationQueryValue, RouteRecordRaw } from "vue-router";

import Layout from "@/components/Layouts/index.vue";
import authService from "@/api/authService";
import { Permissions } from "@/constants/permissions";
import { useAuthStore } from "@/store/auth";

/** 已登录用户访问登录页时的落地路由，与 useAuth 的默认跳转保持一致 */
const HOME_ROUTE = { name: "Articles" } as const;

const routes: Array<RouteRecordRaw> = [
  {
    path: "/login",
    name: "Login",
    component: () => import("@/views/login/index.vue"),
    meta: { public: true, title: "登录" },
  },
  {
    path: "/403",
    name: "Forbidden",
    component: () => import("@/views/errorPage/403.vue"),
    meta: { title: "无权访问", permission: Permissions.ADMIN_ACCESS },
  },
  {
    path: "/",
    component: Layout,
    children: [
      {
        path: "/",
        name: "Dashboard",
        component: () => import("@/views/dashboard/index.vue"),
        meta: { title: "仪表盘", permission: Permissions.ADMIN_ACCESS },
      },
      {
        path: "/timeline",
        name: "Timeline",
        component: () => import("@/views/timeline/index.vue"),
        meta: { title: "时间轴管理", permission: Permissions.TIMELINE_MANAGE },
      },
      {
        path: "/articles",
        name: "Articles",
        component: () => import("@/views/articles/index.vue"),
        meta: { title: "文章管理", permission: Permissions.ARTICLE_MANAGE },
      },
      {
        path: "/notes",
        name: "Notes",
        component: () => import("@/views/notes/index.vue"),
        meta: { title: "笔记管理", permission: Permissions.NOTE_MANAGE },
      },
      // 兼容旧书签：分类管理已并入文章 / 笔记页，不再单独占导航
      {
        path: "/categories",
        redirect: "/articles",
      },
      {
        path: "/books",
        name: "Books",
        component: () => import("@/views/books/index.vue"),
        meta: { title: "书库管理", permission: Permissions.BOOK_MANAGE },
      },
      {
        path: "/users",
        name: "Users",
        component: () => import("@/views/users/index.vue"),
        meta: { title: "用户管理", permission: Permissions.USER_MANAGE },
      },
      {
        path: "/membership",
        name: "Membership",
        component: () => import("@/views/membership/index.vue"),
        meta: { title: "会员申请", permission: Permissions.USER_MANAGE },
      },
      {
        path: "/roles",
        name: "Roles",
        component: () => import("@/views/roles/index.vue"),
        meta: { title: "角色管理", permission: Permissions.ROLE_MANAGE },
      },
      {
        path: "/permissions",
        name: "Permissions",
        component: () => import("@/views/permissions/index.vue"),
        meta: { title: "权限管理", permission: Permissions.PERMISSION_MANAGE },
      },
    ],
  },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/errorPage/404.vue"),
    meta: { title: "页面不存在" },
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

/** 从 query 中取出合法的重定向地址 */
const resolveRedirectQuery = (value: LocationQueryValue | LocationQueryValue[]): string | null =>
  typeof value === "string" && value ? value : null;

/**
 * 补齐当前登录用户信息
 *
 * 令牌持久化在 localStorage，刷新后 user（含 permissions）为空，
 * 权限判断必须先拿到它。失败时统一按「登录态失效」处理。
 */
const ensureUserLoaded = async (): Promise<boolean> => {
  const authStore = useAuthStore();
  if (!authStore.isAuthenticated) {
    return false;
  }
  if (authStore.user) {
    // 持久化的旧会话可能来自 RBAC 上线之前（user 里没有 permissions），
    // 必须重新校验，否则会在 /403 上反复重定向
    if (!authStore.user.permissions?.includes(Permissions.ADMIN_ACCESS)) {
      authStore.clearSession();
      return false;
    }
    return true;
  }

  try {
    const { data: user } = await authService.getUserInfo();
    if (!user.permissions.includes(Permissions.ADMIN_ACCESS)) {
      authStore.clearSession();
      return false;
    }
    authStore.setUser(user);
    return true;
  } catch {
    // 401 时响应拦截器已清理会话；其它错误同样视为不可用
    authStore.clearSession();
    return false;
  }
};

// 导航守卫
// ⚠️ 默认受保护：只有显式标记 meta.public 的路由才允许未登录访问，
//    新增页面忘记加标记时会被拦下，而不是直接对外暴露。
router.beforeEach(async (to) => {
  const authStore = useAuthStore();
  const isPublic = to.meta.public === true;

  // 已登录时不再停留在登录页
  if (to.name === "Login" && authStore.isAuthenticated) {
    return resolveRedirectQuery(to.query.redirect) ?? HOME_ROUTE;
  }

  if (isPublic) {
    return true;
  }

  const userAvailable = await ensureUserLoaded();
  if (!userAvailable) {
    return { name: "Login", query: { redirect: to.fullPath } };
  }

  // 权限不足：落到 403 页面，而不是静默跳回首页
  if (to.meta.permission && !authStore.hasPermission(to.meta.permission)) {
    return { name: "Forbidden" };
  }

  return true;
});

export default router;
