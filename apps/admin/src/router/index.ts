import { createRouter, createWebHistory } from "vue-router";
import type { LocationQueryValue, RouteRecordRaw } from "vue-router";

import Layout from "@/components/Layouts/index.vue";
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
    path: "/",
    component: Layout,
    children: [
      {
        path: "/",
        name: "Dashboard",
        component: () => import("@/views/dashboard/index.vue"),
        meta: { title: "仪表盘" },
      },
      {
        path: "/timeline",
        name: "Timeline",
        component: () => import("@/views/timeline/index.vue"),
        meta: { title: "时间轴管理" },
      },
      {
        path: "/articles",
        name: "Articles",
        component: () => import("@/views/articles/index.vue"),
        meta: { title: "文章管理" },
      },
      {
        path: "/notes",
        name: "Notes",
        component: () => import("@/views/notes/index.vue"),
        meta: { title: "笔记管理" },
      },
      {
        path: "/categories",
        name: "Categories",
        component: () => import("@/views/categories/index.vue"),
        meta: { title: "分类管理" },
      },

      // {
      //   path: "/users",
      //   name: "Users",
      //   component: () => import("@/views/users/index.vue"),
      // },
      // {
      //   path: "/roles",
      //   name: "Roles",
      //   component: () => import("@/views/roles/index.vue"),
      // },
      // {
      //   path: "/permissions",
      //   name: "Permissions",
      //   component: () => import("@/views/permissions/index.vue"),
      // },
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

// 导航守卫
// ⚠️ 默认受保护：只有显式标记 meta.public 的路由才允许未登录访问，
//    新增页面忘记加标记时会被拦下，而不是直接对外暴露。
router.beforeEach((to) => {
  const authStore = useAuthStore();
  const isPublic = to.meta.public === true;

  if (!isPublic && !authStore.isAuthenticated) {
    return { name: "Login", query: { redirect: to.fullPath } };
  }

  // 已登录时不再停留在登录页
  if (to.name === "Login" && authStore.isAuthenticated) {
    return resolveRedirectQuery(to.query.redirect) ?? HOME_ROUTE;
  }

  return true;
});

export default router;
