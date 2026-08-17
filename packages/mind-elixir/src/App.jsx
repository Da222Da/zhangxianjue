// https://docs.mind-elixir.com/docs/guides/data-export

import { useEffect } from "react";
import MindElixir from "mind-elixir"; // 思维导图

import "mind-elixir/style.css"; // 思维导图 - 右键菜单样式

const data = {
  nodeData: {
    id: "d451a556d866ba7b",
    topic: "new topic",
    root: true,
    children: [
      {
        topic: "new node",
        id: "d451a6f027c33b1f",
        direction: 0,
        children: [
          {
            topic: "new node",
            id: "d451a724b7c10970",
          },
          {
            topic: "new node",
            id: "d451a77ca7348eae",
          },
          {
            topic: "new node",
            id: "d451a78e1ec7181c",
          },
        ],
      },
    ],
  },
  arrows: [
    {
      id: "d451a9149a1e3a15",
      label: "Custom Link",
      from: "d451a77ca7348eae",
      to: "d451a78e1ec7181c",
      delta1: {
        x: -230,
        y: -9,
      },
      delta2: {
        x: -236,
        y: 14,
      },
    },
  ],
  summaries: [
    {
      id: "d451a84c2e77cc2f",
      parent: "d451a6f027c33b1f",
      start: 0,
      end: 0,
      text: "summary",
    },
  ],
  direction: 2,
  theme: {
    name: "Latte",
    palette: ["#4968a3", "#3b88c4", "#4fa3d4", "#2b5b84", "#367fa2", "#5e93b7", "#4a719c", "#28567d", "#214e6d", "#336699"],
    cssVar: {
      "--main-color": "#444446",
      "--main-bgcolor": "#ffffff",
      "--color": "#777777",
      "--bgcolor": "#f6f6f6",
      "--panel-color": "#444446",
      "--panel-bgcolor": "#ffffff",
      "--panel-border-color": "#eaeaea",
    },
  },
};

const App = () => {
  useEffect(() => {
    const mind = new MindElixir({
      el: "#map",
      direction: MindElixir.RIGHT, // 设置思维导图的布局方向
      draggable: true, // 开启节点拖拽功能
      contextMenu: true, // 启用“画布”右键菜单
      toolBar: true, // 显示内置工具栏
      nodeMenu: true, // 启用“节点”右键菜单
      keypress: true, // 启用键盘快捷键
    });

    mind.init(data);
  });
  return <div id="map" style={{ height: "500px", width: "100%" }} />;
};

export default App;
