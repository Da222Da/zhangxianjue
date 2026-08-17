import { defineConfig } from "vitepress";

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "zhangxianjue",
  description: "zhangxianjue docs",
  themeConfig: {
    nav: [
      { text: "Home", link: "/" },
      { text: "Server 服务", link: "/server/data-sheet" },
    ],

    sidebar: [{ text: "数据表设计", link: "/server/data-sheet.md" }],

    socialLinks: [{ icon: "github", link: "https://github.com/vuejs/vitepress" }],
  },
});
