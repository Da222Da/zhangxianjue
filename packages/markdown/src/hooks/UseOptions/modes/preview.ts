import Viewer from "viewerjs";
export default () => {
  return {
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
        updateLocationHash: true, // 要不要更新 URL 的hash
        defaultModel: "full", // pure: 精简模式/缩略模式，只有一排小点； full: 完整模式，会展示所有标题
        position: "fixed", // 悬浮目录的悬浮方式。当滚动条在cherry内部时，用absolute；当滚动条在cherry外部时，用fixed
        cssText: "right: 20px;", // 悬浮目录的样式
      },
    },
    editor: {
      defaultModel: "previewOnly", // 只预览模式
    },
    callback: {
      // 点击图片时，弹出图片预览
      onClickPreview: function (e: any) {
        const { target } = e;
        if (target.tagName === "IMG") {
          const tmp = new Viewer(target, {
            button: false,
            navbar: false,
            title: [1, (image: any, imageData: any) => `${image.alt.replace(/#.+$/, "")} (${imageData.naturalWidth} × ${imageData.naturalHeight})`],
            hidden() {
              tmp.destroy();
            },
          });
          tmp.show();
        }
      },
      // 异步渲染完成
      // afterAsyncRender: () => {
      //   // 在这里，Mermaid 图表已经渲染完成，可以安全地绑定事件了
      //   bindClickEventsToMermaidMindmapNodes(props);
      // },
    },
  };
};

// 绑定点击事件到 Mermaid Mindmap 图表节点
// function bindClickEventsToMermaidMindmapNodes(props: any) {
//   // 找到所有的 Mermaid 图表节点
//   const nodes = document.querySelectorAll(".cherry-mermaid-source-toolbar-panel .node.mindmap-node .nodeLabel p");
//   console.log("nodes::: ", nodes);

//   nodes.forEach((node: any) => {
//     // 防止重复绑定
//     if (node.dataset.listenerAdded) return;
//     node.dataset.listenerAdded = "true";

//     // 设置鼠标样式为手型
//     node.style.cursor = "pointer";

//     // 绑定点击事件
//     if (props.Config.clickToMermaidMindmapNodes) {
//       if (!node) return; // 如果没有找到目标元素，直接返回
//       // 从 DOM 元素中提取节点信息，例如 ID
//       const nodeId = node.id;
//       const nodeText = node.textContent.trim();

//       node.addEventListener("click", props.config.clickToMermaidMindmapNodes.bind({ nodeId, nodeText }));
//     }
//   });
// }
