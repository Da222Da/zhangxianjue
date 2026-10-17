/**
 * 演示用图片：内联 SVG 的 base64 data URL。
 *
 * 用 base64 而不是百分号编码，是因为 `![alt](url)` 的 URL 里**不能有空格** ——
 * 有空格 markdown-it 就解析不出图片，会当成普通文字。base64 天然没有空格。
 * 用内联图片而不是外链，是为了让 demo 离线可用、也不受图片服务 CORS 限制。
 */
const demoImageSvg = [
  '<svg xmlns="http://www.w3.org/2000/svg" width="160" height="90">',
  '<rect width="160" height="90" rx="10" fill="#eef3fb"/>',
  '<path d="M18 68 L58 30 L88 52 L112 34 L142 68 Z" fill="#4C72B0" opacity="0.75"/>',
  '<circle cx="120" cy="24" r="10" fill="#DD8452"/>',
  "</svg>",
].join("");
const demoImage = `data:image/svg+xml;base64,${btoa(demoImageSvg)}`;

export const sampleMarkdown = `---
colorFreezeLevel: 2
initialExpandLevel: 4
maxWidth: 260
---

# 手绘思维导图

## 技术栈
- **Vue 3** + \`<script setup>\`
- **rough.js** 负责手绘线条
- **d3-hierarchy / d3-flextree** 负责布局
- **d3-zoom** 负责缩放平移

## 交互
- 滚轮 / 双指缩放
- 拖拽画布平移
- 点击节点右侧圆圈折叠
  - 折叠后标识会显示藏了几个子节点
    - 计数只算直接子节点，不递归
  - 按住 Alt 点击圆圈可递归折叠整棵子树
- hover 节点高亮到根的路径

## 布局
- d3-flextree 负责变尺寸布局
  - 节点高度取决于文本行数
    - 所以 d3.tree() 不够用
    - 需要支持变尺寸节点的 flextree
  - 间距直接算进节点占位尺寸里
- d3-zoom 只改外层 transform
  - 缩放平移期间不重绘任何图形

## 链接
- 外链接：[rough.js 官网](https://roughjs.com/) 后面带 ↗
- 内链接：[回到技术栈](#技术栈) 前面带 →
- 链接可以直接点开
  - 外链接新标签页打开
  - 内链接跳到页面锚点

## 图片
- 节点里可以直接放图片
- 大图会等比缩放到 maxWidth 以内
- ![手绘示意图](${demoImage})
  - 导出时会抓成 data URL 内联，PNG / SVG 都是自包含的
- 点一下图片可以放大查看
  - 查看器里能放大、缩小、拖拽平移、下载原图
  - 滚轮缩放、双击切换大小、Esc 关闭

## 导出
- 导出 SVG
- 导出 PNG（2 倍图）

## 代码块也会渲染
\`\`\`ts
const map = createMarkmap('# 标题');
map.fit();
\`\`\`

## 超长文本会自动换行
- 这是一段刻意写得很长的节点文本，用来验证 maxWidth 生效后节点会自动折行，而不会把整张图撑得无限宽
`;
