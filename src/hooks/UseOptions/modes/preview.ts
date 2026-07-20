import Viewer from "viewerjs";
export default (props: any) => {
  return {
    engine: {
      syntax: {
        codeBlock: {
          mermaid: {
            showSourceToolbar: true,
            src: "https://cdn.jsdelivr.net/npm/mermaid@11.16.0/dist/mermaid.min.js",
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
      afterAsyncRender: () => {
        // 在这里，Mermaid 图表已经渲染完成，可以安全地绑定事件了
        bindClickEventsToMermaidNodes(props);
      },
    },
  };
};

function bindClickEventsToMermaidNodes(props: any) {
  // 找到所有的 Mermaid 图表节点
  const nodes = document.querySelectorAll(".cherry-mermaid-source-toolbar-panel svg g .nodeLabel");

  nodes.forEach((node: any) => {
    // 防止重复绑定
    if (node.dataset.listenerAdded) return;
    node.dataset.listenerAdded = "true";

    // 设置鼠标样式为手型
    node.style.cursor = "pointer";

    // 绑定点击事件
    if (props.PreviewConfig.handleClickToMermaidNodes) node.addEventListener("click", props.PreviewConfig.handleClickToMermaidNodes.bind(node));
  });
}
