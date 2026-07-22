import { createRouter, createWebHistory } from "vue-router";
const basename = process.env.NODE_ENV === "production" ? "./" : "";

export const dynamicRoutes = [
  {
    path: "/",
    name: "home",
    component: () => import("../views/Home.vue"),
  },
  {
    path: "/preview",
    name: "preview",
    mate: { menuName: "预览模式", menuPath: "/preview" },
    redirect: "/formulas/base",
    children: [
      {
        path: "/preview/base",
        name: "previewBase",
        component: () => import("../views/preview/Base.vue"),
        mate: { menuName: "基础功能", menuPath: "/preview/base" },
      },
      {
        path: "/preview/mermaid",
        name: "previewMermaid",
        component: () => import("../views/preview/Mermaid.vue"),
        mate: { menuName: "mermaid 图表", menuPath: "/preview/mermaid" },
      },
    ],
  },
  {
    path: "/test",
    name: "test",
    component: () => import("../views/Test.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(basename),
  routes: dynamicRoutes,
});

// 白名单放行
const whiteList = ["/login"];

router.beforeEach(async (to, from, next) => {
  const userInfo = localStorage.getItem("USER_INFO");

  // 如果访问的是白名单，直接放行
  if (whiteList.includes(to.path)) {
    next();
    return;
  }

  // 如果没有登录信息，重定向到登录页
  if (!userInfo) {
    next("/login");
    return;
  }

  next();
});

export default router;
