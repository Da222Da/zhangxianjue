export default {
  // 主题
  theme: "light",
  // 语法高亮
  syntaxHighlight: {
    enable: true,
    type: "prismjs",
    theme: "tomorrow",
  },
  engine: {
    syntax: {
      codeBlock: {
        changeLang: false,
        mermaid: {
          showSourceToolbar: true,
          src: "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js",
        },
        echarts: {
          showSourceToolbar: true,
          src: "https://cdn.jsdelivr.net/npm/echarts@5.4.0/dist/echarts.min.js",
        },
      },
    },
  },
  toolbars: {
    toolbar: [], // 关闭顶部工具栏
    // 悬浮目录
    toc: {
      updateLocationHash: true, // 要不要更新 URL 的 hash
      defaultModel: "full", // pure: 精简模式/缩略模式，只有一排小点； full: 完整模式，会展示所有标题
      position: "fixed", // 悬浮目录的悬浮方式。当滚动条在cherry内部时，用absolute；当滚动条在cherry外部时，用fixed
      cssText: "right: 20px;", // 悬浮目录的样式
    },
  },
  editor: {
    defaultModel: "previewOnly", // 只预览模式
  },
};
