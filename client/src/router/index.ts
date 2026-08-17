import { createRouter, createWebHistory } from "vue-router";
import type { RouteRecordRaw } from "vue-router";

import Layout from "@/components/Layout.vue";

const routes: Array<RouteRecordRaw> = [
  {
    path: "/",
    component: Layout,
    children: [
      {
        path: "/",
        name: "Home",
        component: () => import("@/views/Home.vue"),
      },
    ],
  },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;
