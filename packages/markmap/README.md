# markmap

手绘风格的 Markdown 思维导图 Vue 3 组件。输入 Markdown，输出一棵**用 rough.js 画出来的手绘线条思维导图** —— 节点框、连线、折叠标识全部是抖动的铅笔线条，而不是规规矩矩的几何图形。

功能与交互对标 [markmap-view](https://github.com/markmap/markmap)：自动布局、缩放平移、节点折叠展开带动画、hover 高亮路径、导出 SVG / PNG。

```markdown
# 手绘思维导图
- 节点框与连线都是手绘线条
- 支持 **加粗**、*斜体*、`代码`、[链接](https://example.com)
- 点击节点右侧圆圈折叠
```

---

## 特性

- ✏️ **真·手绘**：全部图形由 rough.js 生成，`roughness` / `bowing` / `fillStyle` 可调，固定 seed 保证重绘不抖动
- 📱 **触摸可用**：单指拖拽平移、双指捏合缩放、轻触折叠，手势期间不会带动页面滚动
- 🌳 **d3 生态布局**：d3-flextree 计算变尺寸节点布局，d3-zoom 处理缩放平移，不自造轮子
- 🎞️ **补间动画**：折叠展开时节点平滑移动、淡入淡出，而不是瞬间跳变
- 🔢 **折叠可见数量**：折叠后标识变成手绘胶囊，直接显示藏了几个子节点
- 🔤 **富文本节点**：foreignObject + HTML 渲染，自动换行、行内样式、代码块一应俱全
- 🔗 **可点击链接**：内链接图标在前（`→`）、外链接图标在后（`↗`），默认跳转可被 `link-click` 拦截
- 🖼️ **节点内图片**：等比缩放到 `maxWidth` 以内，导出时抓成 data URL 内联，PNG / SVG 都自包含
- 🔍 **图片查看器**：点击节点内图片打开灯箱，可放大、缩小、拖拽平移、下载原图；`imageViewer: false` 关掉内置灯箱，`image-click` 事件照旧抛出
- 📤 **导出 SVG / PNG**：导出的 SVG 用原生 `<text>` 重建文本，可被设计工具打开，也能稳定导出 PNG
- 🧩 **零 Vue 依赖的核心**：解析、布局、渲染、导出都能脱离 Vue 单独使用

## 安装

```bash
npm i @zhangxianjue/markmap
```

`vue` 是 peerDependency，需要宿主应用提供（Vue 3.3+）。

```ts
import { createApp } from "vue";
import VueMarkmapSketch from "@zhangxianjue/markmap";
import "@zhangxianjue/markmap/style.css";

createApp(App).use(VueMarkmapSketch).mount("#app");
```

也可以按需引入：

```vue
<script setup lang="ts">
import { MarkmapEditor } from "@zhangxianjue/markmap";
import "@zhangxianjue/markmap/style.css";
</script>
```

## 快速开始

### 只看不编：`<MarkmapSketch>`

```vue
<script setup lang="ts">
import { ref } from "vue";
import { MarkmapSketch } from "@zhangxianjue/markmap";
import "@zhangxianjue/markmap/style.css";

const markdown = ref("# 标题\n- 子节点");
const sketch = ref();

function fit() {
  sketch.value.fit();
}
</script>

<template>
  <div style="height: 600px">
    <MarkmapSketch
      ref="sketch"
      v-model:value="markdown"
      :options="{ roughness: 2, bowing: 1.5, seed: 42, fillStyle: 'hachure' }"
      @node-click="(node) => console.log(node)"
    />
  </div>
</template>
```

### 左写右看：`<MarkmapEditor>`

```vue
<template>
  <MarkmapEditor
    v-model:value="markdown"
    :options="{ maxWidth: 300, colorFreezeLevel: 2 }"
    height="100%"
  />
</template>
```

编辑器自带工具栏（适应视图 / 放大缩小 / 重置 / 全部展开 / 折叠到 2 层 / 导出 SVG / 导出 PNG）、可拖拽分栏和节点计数。

---

## MarkmapSketch API

### Props

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `value` | `string` | `''` | Markdown 文本，配合 `v-model:value` |
| `options` | `MarkmapOptions` | `{}` | 全局配置，同名键会覆盖 front-matter 里的配置 |
| `readonly` | `boolean` | `false` | 只读模式：隐藏折叠标识、禁用折叠交互；缩放平移与 `node-click` 仍可用 |
| `autoFit` | `boolean` | `true` | 首次渲染后自动缩放到全部内容可见 |
| `exportScale` | `number` | `2` | `exportPng()` 的像素倍率 |
| `exportPadding` | `number` | `24` | 导出时四周留白 |

### Events

| 名称 | 载荷 | 说明 |
| --- | --- | --- |
| `update:value` | `string` | `setData()` 修改文本时触发 |
| `node-click` | `(node: TreeNode, event: MouseEvent)` | 点击节点（不含折叠标识与链接） |
| `node-toggle` | `(node: TreeNode, folded: boolean)` | 折叠状态变化 |
| `zoom` | `{ k: number; x: number; y: number }` | 视图变换变化 |
| `link-click` | `(node, href: string, event: MouseEvent)` | 点击节点内链接；`event.preventDefault()` 可阻止默认跳转 |
| `image-click` | `(node, image: NodeImage, event: MouseEvent)` | 点击节点内图片；`event.preventDefault()` 可阻止打开内置查看器 |

### Expose

| 方法 | 签名 | 说明 |
| --- | --- | --- |
| `fit` | `(padding?: number) => void` | 缩放到全部内容可见 |
| `centerNode` | `(id: string) => void` | 把节点移到视口中心，会自动展开它被折叠的祖先 |
| `zoomIn` / `zoomOut` | `() => void` | 按 1.25 / 0.8 倍率缩放 |
| `resetZoom` | `() => void` | 回到 1 倍并居中 |
| `expandAll` | `() => void` | 展开全部 |
| `collapseAll` | `(level?: number) => void` | 折叠到指定层级，`depth >= level` 的节点收起 |
| `toggleNode` | `(id: string, folded?: boolean) => boolean` | 切换折叠状态，返回切换后的结果 |
| `setData` | `(markdown: string, animate?: boolean) => void` | 命令式设置 Markdown，并同步 `v-model` |
| `exportSvg` | `() => string` | 同步导出 SVG；图片保留原始 URL，导出物需要联网 |
| `exportSvgAsync` | `() => Promise<string>` | 导出**自包含**的 SVG，图片抓成 data URL 内联 |
| `exportPng` | `(scale?: number) => Promise<Blob>` | 导出 PNG（背景默认白色，图片自动内联） |
| `getRenderer` | `() => SketchRenderer \| null` | 拿到底层渲染器 |
| `getSvgElement` | `() => SVGSVGElement \| null` | 拿到 SVG 根节点 |
| `getTree` | `() => TreeNode \| null` | 拿到当前解析出的树 |

---

## 配置项 `MarkmapOptions`

### 手绘参数（rough.js）

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `roughness` | `number` | `1.6` | 线条粗糙度，0 为完全平滑 |
| `bowing` | `number` | `1.4` | 线条弯曲程度 |
| `seed` | `number` | `42` | 随机种子基准；每个节点会基于 `seed + 节点id` 派生独立种子 |
| `fillStyle` | `SketchFillStyle` | `'hachure'` | `hachure` \| `solid` \| `zigzag` \| `cross-hatch` \| `dots` \| `dashed` \| `zigzag-line` |
| `fillWeight` | `number` | `1` | 填充线宽 |
| `hachureAngle` | `number` | `-41` | 斜线填充角度 |
| `hachureGap` | `number` | `8` | 斜线填充间距 |
| `strokeWidth` | `number` | `1.5` | 描边宽度 |
| `lineRoughness` | `number` | `roughness × 0.8` | 连线的粗糙度 |
| `lineBowing` | `number` | `= bowing` | 连线的弯曲度 |
| `toggleRadius` | `number` | `5` | 折叠标识半径 |
| `showCollapsedCount` | `boolean` | `true` | 折叠时在标识上显示**直接子节点数量**（`+4`），超过 99 显示 `99+`；关掉后退回纯 `+` |
| `linkIcons` | `Partial<LinkIcons>` | `{ internal: '→', external: '↗' }` | 链接跳转图标，传空字符串可单独关掉某一侧 |

> `seed` 固定是硬性要求：每个图形的种子由「节点 id + 全局 seed」哈希得到，同一节点无论重绘多少次，形状都完全一致，不会闪。

### 颜色

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `color` | `string[] \| (node) => string` | 内置 10 色板 | 传函数可完全自定义配色 |
| `colorFreezeLevel` | `number` | `0` | 从第几层开始颜色冻结，该层及后代共用同一颜色；`0` 表示不冻结 |
| `nodeFill` | `string \| 'auto' \| 'none'` | `'auto'` | `'auto'` 按层级取同色的浅色调；`'none'` 不填充 |
| `nodeFillOpacity` | `number` | `0.12` | `nodeFill: 'auto'` 时填充色的透明度，`0` 即等于不填充 |
| `lineColor` | `string \| 'auto'` | `'auto'` | `'auto'` 跟随子节点颜色 |
| `backgroundColor` | `string` | `'transparent'` | 画布背景色，同时影响导出 |

默认按**层级**取色（与 markmap 一致）：所有 depth 1 的节点同一个色，depth 2 又是另一个色。`colorFreezeLevel` 用来把深层节点收敛到某一层的颜色。要按分支取色就传函数：

```ts
color: (node) => palette[node.depth % palette.length]
```

### 文本与布局

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `fontFamily` | `string` | 系统中文优先的字体栈 | 节点字体 |
| `fontSize` | `number` | `14` | 字号（px） |
| `lineHeight` | `number` | `1.4` | 行高倍数 |
| `maxWidth` | `number` | `300` | 文本最大宽度，超出自动换行 |
| `nodePadding` | `number` | `8` | 节点内边距 |
| `spacingVertical` | `number` | `12` | 兄弟节点垂直间距 |
| `spacingHorizontal` | `number` | `80` | 父子节点水平间距 |
| `initialExpandLevel` | `number` | `3` | 默认展开到第几层：`depth >= 该值` 的节点初始折叠，`-1` 为全部展开。**运行时改动会立即重新折叠**，相当于「只看前 N 层」 |

### 交互

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `duration` | `number` | `500` | 折叠展开与视图动画时长（ms），`0` 关闭动画 |
| `zoom` | `boolean` | `true` | 是否允许滚轮 / 双指缩放 |
| `pan` | `boolean` | `true` | 是否允许拖拽平移 |
| `scaleExtent` | `[number, number]` | `[0.1, 8]` | 缩放范围 |
| `disableContextMenu` | `boolean` | `true` | 屏蔽画布上的浏览器右键菜单。只作用于组件容器，不影响页面其它区域；需要保留原生菜单（如右键复制链接地址）时传 `false` |

> ⚠️ **含链接的节点不触发 hover 高亮**。指针停在链接上通常是要点击，
> 若此时把其余节点压暗到 `opacity: 0.22`，整张图会像盖了一层蒙版。普通节点的路径高亮行为不变。

### 图片查看器

| 名称 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `imageViewer` | `boolean` | `true` | 点击节点内图片时打开内置查看器；关掉之后 `image-click` 事件仍然抛出，可以接自己的灯箱 |
| `imageViewerDownload` | `boolean` | `true` | 查看器里是否显示下载按钮 |
| `imageViewerScaleExtent` | `[number, number]` | `[0.25, 8]` | 查看器的缩放范围，`1` 为原始大小 |

内置查看器的操作：

| 操作 | 方式 |
| --- | --- |
| 放大 / 缩小 | `＋` `－` 按钮、滚轮、`+` / `-` 键（以光标为不动点） |
| 恢复原始大小 | `1:1` 按钮、`0` 键 |
| 快速放大 / 还原 | 双击图片 |
| 平移 | 在图片上按住拖动 |
| 下载原图 | `下载` 按钮 |
| 关闭 | `关闭` 按钮、`Esc`、点击图片外的空白处 |

---

## Markdown 支持

| 语法 | 结果 |
| --- | --- |
| `#` ~ `######` | 标题层级，`#` 为 depth 1 |
| `-` / `*` / `+` 无序列表 | 列表项，支持任意层嵌套 |
| `1.` 有序列表 | 列表项，`payload.ordered === true` |
| `- [ ]` / `- [x]` | 任务项，`payload.checked` 记录勾选状态 |
| 列表外的段落 | 作为最近标题的子节点 |
| `**加粗**` `*斜体*` `` `代码` `` | 节点内行内渲染 |
| `[文字](url)` | 节点内链接，**可点击跳转**。以 `http` / `https` 开头的算外链接：图标 `↗` 跟在文本后、新标签页打开；其余（`#锚点`、相对路径、`mailto:` 等）算内链接：图标 `→` 放在文本前、原地跳转 |
| `![alt](url)` | 节点内图片，等比缩放到 `maxWidth` 以内，排在文本下方（块级），**点击可放大查看**（见[图片查看器](#图片查看器)） |
| ` ``` ` 代码围栏 | 挂到紧邻节点的 `payload.lines`，在节点内以 `<pre>` 展示 |
| `<!-- markmap: fold -->` | 该节点默认折叠 |

层级规则：列表项的目标层级 = 最近的标题级数 + 列表嵌套深度；节点最终的 `depth` 取**真实树深度**，所以 `##` 直接跟在 `#` 后面是 depth 2，不会因为缺少中间层级而留空。

全文只有一个顶层节点时（典型情况：只有一个 `#`），该节点会被提升为根节点，避免出现一个空白的中心方块。多个顶层节点则保留中心点，此时空内容的根节点会画成手绘圆点。

### front-matter

任意可配置项都能写进 front-matter，顶平铺或 `markmap:` 嵌套两种写法都支持：

```markdown
---
colorFreezeLevel: 2
maxWidth: 300
markmap:
  roughness: 2.5
  fillStyle: zigzag
---
# 标题
- 子节点
```

优先级：**组件 `options` prop > front-matter > 内置默认值**。

只实现了 YAML 子集：标量、行内数组 `[a, b]`、一层嵌套 map、`#` 注释。

---

## 导出

```ts
const svg: string = sketch.value.exportSvg();
const png: Blob = await sketch.value.exportPng(2); // 2 倍图
```

`exportPng()` 的背景色**默认为白色**：PNG 没有「继承页面背景」的概念，透明底贴进文档或图片预览器里通常就是一张看起来坏掉的图。确实需要透明背景时，调底层 `exportPng(svg, box, { backgroundColor: 'transparent' })`。`exportSvg()` 则沿用 `options.backgroundColor`（SVG 通常是嵌进页面里用的）。

导出的 SVG 会：

1. 重置缩放平移，导出**完整内容**而不是当前可视区域
2. 内联组件自身的 CSS
3. **把 `foreignObject` 换成原生 `<text>` / `<tspan>`**，保留加粗、斜体、行内代码、链接等行内样式

第 3 点是必须的：Chrome 在把含 `foreignObject` 的 SVG 画进 canvas 时会**污染画布**，`canvas.toBlob()` 直接抛 `SecurityError`。换成原生 `<text>` 之后 PNG 导出才能工作，顺带也让导出的 SVG 能被 Illustrator / Figma / Inkscape 正常打开。

> `serializeSvg()` 不传 `texts` 时会保留 `foreignObject`（视觉与屏幕 100% 一致，但不能再导出 PNG）。`exportPng()` 必须先拿到文本排版信息，直接调底层 API 时要传 `renderer.getTextLayouts()`。

---

## 主题定制

组件用 CSS 变量暴露了几个可调项：

```css
.mvs-container {
  --mvs-text-color: #2f3542;              /* 节点文字颜色 */
  --mvs-canvas-bg: #fff;                  /* 画布背景 */
  --mvs-code-bg: rgba(47, 53, 66, 0.06);  /* 行内代码 / 代码块底色 */
}
```

也可以用 `.mvs-*` 类名做更细的覆盖：`.mvs-node`、`.mvs-node-fo`、`.mvs-node-body`、`.mvs-node-text`、`.mvs-node-code`、`.mvs-node-image`、`.mvs-link`、`.mvs-node-toggle`。

图片查看器同样是 `.mvs-*`：`.mvs-lightbox`、`.mvs-lightbox-stage`、`.mvs-lightbox-image`、`.mvs-lightbox-bar`、`.mvs-lightbox-btn`、`.mvs-lightbox-scale`、`.mvs-lightbox-hint`。

---

## 不依赖 Vue 使用核心能力

解析、布局、渲染器、导出都是独立的模块：

```ts
import {
  parseMarkdown,
  computeLayout,
  createNodeMeasurer,
  resolveOptions,
  SketchRenderer,
} from "@zhangxianjue/markmap";

const { root, options } = parseMarkdown("# 标题\n- 子节点");
const resolved = resolveOptions(options);
const layout = computeLayout(root, {
  options: resolved,
  measure: createNodeMeasurer(resolved),
  isFolded: (node) => node.id === someId, // 可选
});

// layout.nodes / layout.links / layout.bbox 就是现成的几何数据

// 或者直接挂到一个 <svg> 上
const renderer = new SketchRenderer(document.querySelector("svg")!, {
  roughness: 2,
});
renderer.setData(root);
renderer.fit();
```

### 坐标系约定

沿用 d3-hierarchy / markmap-view 的约定，初次接触容易踩：

- `x` 是**广度轴**，对应画布上的**垂直**方向（节点中心）
- `y` 是**深度轴**，对应画布上的**水平**方向（节点左边缘，根在最左）

渲染时的变换即 `translate(y, x)`。

---

## 已知限制

- **导出 PNG 依赖 foreignObject 的替换**，如果你的渲染环境不支持原生 `<text>` 的 `xml:space`，长行首尾空格可能被吞掉
- **front-matter 只支持 YAML 子集**，复杂嵌套、锚点、多行字符串不解析
- **节点文本走 `innerHTML`**，markdown-it 以 `html: false` 运行，原始 HTML 会被转义（防 XSS），因此节点里不能直接写 HTML 标签
- 单图节点数量很大（> 1000）时，rough.js 生成的路径总量会明显拖慢首屏，建议调大 `duration` 或关闭动画
- **跨域图片无法内联**：导出 PNG / `exportSvgAsync()` 需要把图片抓成 data URL，服务端没开 CORS 的图片会被**跳过**（宁可少一张图，也不能让 canvas 被污染导致整张 PNG 导不出来）。要保证导出完整，图片请走同域、开了 CORS 的 CDN，或直接用 data URL
- **图片尺寸要等加载完才知道**：加载完成前先用占位尺寸排一次版，加载后会重新布局，节点会跳一下。图片挂了会一直保持占位尺寸
- **节点内图片是块级的**：排在文本下方，不会和文字混排在同一行
- **查看器的大小跟随组件容器**：灯箱是绝对定位在 `.mvs-container` 里的一层，不是全屏遮罩 —— 这样它不会跳出色块、也不依赖 `teleport` 的目标。想要全屏效果，把组件容器铺满视口即可
- **查看器内没有双指捏合**：移动端请用 `＋` `－` 按钮缩放（拖拽平移是支持的）
- **跨域图片在查看器里下不了**：和导出同理，服务端没开 CORS 时抓不到图片内容，此时会提示「在新标签页打开」——手动另存仍然可以
- **触摸热区偏小**：折叠标识默认只有十几像素，窄屏 `fit()` 之后会更小，低于 44px 的触控建议值。移动端使用建议调大 `toggleRadius`
- **`MarkmapEditor` 是固定左右分栏**，窄屏（< 600px）下两侧都会很挤，移动端建议直接用 `<MarkmapSketch>`

## 开发

```bash
npm run dev            # 启动 playground（http://localhost:8090）
npm run test           # vitest 单元测试：解析、布局
npm run typecheck      # vue-tsc 全量类型检查
npm run build          # 打包出 dist + types

npm run test:e2e       # 浏览器冒烟测试（需先 npm run dev，且本机有 Chrome）
npm run test:e2e:shot  # 同上，并保存截图
```

`tests/e2e/run.mjs` 通过 CDP 驱动无头 Chrome，覆盖 vitest 覆盖不到的部分：rough.js 真实生成的路径、foreignObject 文本排版是否溢出节点框、折叠补间动画是否存在中间帧、折叠数量徽标、d3-zoom 交互、链接跳转、图片查看器（放大 / 缩小 / 双击 / 下载文件名 / Esc 与点背景关闭）、SVG / PNG 导出的实际产物，以及**在手机设备模拟（390×844 + 触摸）下的单指平移 / 双指缩放 / 轻触折叠**。Chrome 路径可用 `CHROME_PATH` 环境变量指定。

> 触摸用例需要 Chrome 真的能把 CDP 注入的触摸事件送达 DOM。本机的无头 Chrome 做不到这一点，此时这 6 条会打 `SKIP`（带上原因），而不是伪装成通过或失败。

## 技术选型说明

| 关注点 | 选择 | 原因 |
| --- | --- | --- |
| 布局 | `d3-flextree` | 节点高度取决于文本行数，属于变尺寸节点布局；`d3.tree()` 只支持等尺寸节点，flextree 是 d3-hierarchy 生态里为此设计的布局，markmap-view 同样使用 |
| 曲线 | 三次贝塞尔 | 控制点按水平方向 45% / 55% 分配，形成 markmap 标志性的斜向曲线 |
| 图形 | `rough.generator()` + 自写 `d` 序列化 | 比 `rough.svg()` 少一层 DOM 创建，且能复用 `<path>` 元素，动画时只改 `d` 属性 |
| 文本 | `foreignObject` + HTML | 富文本与自动换行交给浏览器，导出时再换成原生 `<text>` |

## License

ISC
