import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

import Layout from "@/components/Layouts/index.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    component: Layout,
    // meta: { requiresAuth: true },
    children: [
      {
        path: "/",
        name: "Dashboard",
        component: () => import("@/views/dashboard/index.vue"),
      },
      {
        path: "/articles",
        name: "Articles",
        component: () => import("@/views/articles/index.vue"),
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
  // {
  //   path: "/login",
  //   name: "Login",
  //   component: () => import("@/views/login/index.vue"),
  // },
  // {
  //   path: "/register",
  //   name: "Register",
  //   component: () => import("@/views/register/index.vue"),
  // },
  {
    path: "/:pathMatch(.*)*",
    name: "NotFound",
    component: () => import("@/views/errorPage/404.vue"),
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

// 导航守卫
// router.beforeEach((to, from, next) => {
// //   const isAuthenticated = localStorage.getItem("accessToken");

// //   if (to.meta.requiresAuth && !isAuthenticated) {
// //     next({ name: "Login" });
// //   } else {
// //     next();
// //   }
// });

export default router;
