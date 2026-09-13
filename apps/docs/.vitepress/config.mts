import { defineConfig } from "vitepress";

export default defineConfig({
  title: "zhangxianjue",
  description: "zhangxianjue docs",
  themeConfig: {
    outline: [2, 3],
    sidebar: {
      "/": [
        {
          text: "首页",
          link: "/",
          items: [
            {
              text: "Web 服务器",
              link: "src/server-project.md",
              items: [
                { text: "数据表设计", link: "src/database.md" },
                { text: "接口设计", link: "src/api.md" },
              ],
            },
          ],
        },
      ],
    },
  },
});
