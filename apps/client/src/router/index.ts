import { createRouter, createWebHistory } from "vue-router";
import type { RouteLocationNormalizedLoaded, RouteRecordRaw } from "vue-router";

import Layout from "@/components/Layout.vue";

const routes: Array<RouteRecordRaw> = [
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
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 在路由跳转前，动态设置 query 参数
// router.beforeEach((to, from) => {
//   console.log("to::: ", to);
//   console.log("from::: ", from);
//   return true;
// });

export default router;
