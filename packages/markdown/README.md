# @zhangxianjue/markdown

自研 Markdown 编辑渲染器，替代 `@zhangxianjue/markdown-editor-v3`。
源码编辑 + 实时预览，工具栏覆盖常用格式，渲染侧实现了一套 Cherry 风格的扩展语法。

## 特性

- 三种模式：纯编辑（`editOnly`）、纯渲染（`previewOnly`）、编辑 + 预览（`edit&preview`）
- 工具栏：撤销 / 重做、字体样式、字号、颜色、标题、列表、对齐、面板、图片、链接、代码、目录
- 扩展语法：注音、上下标、下划线、高亮、字号、文字色、背景色、手风琴、信息面板
- 目录：`[TOC]` 生成固定在左侧、垂直居中、可折叠、带锚点与滚动高亮的磨砂浮层；正文列居中
- 数学公式：行内 `$...$`、块级 `$$...$$`（KaTeX）
- B 站视频链接自动渲染为播放器
- 脚注、任务清单、表格、emoji、自动链接、引用式链接
- 脚注悬浮提示：鼠标移到脚注引用上显示内容卡片，滚动 / 移出即隐藏
- 原始 HTML 白名单清洗（DOMPurify）
- 自定义撤销 / 重做：连续输入合并、工具栏命令单独入栈
- 零 UI 框架依赖，admin 与 client 均可直接使用

## 使用

```bash
npm run dev:markdown   # playground（端口 8092）
npm run build:markdown                            # 构建到 dist/
npm run test:markdown                             # 单元测试
```

```vue
<!-- 编辑 + 预览 -->
<Markdown v-model="content" mode="edit&preview" :file-upload="uploadFile" height="70vh" />

<!-- 只读渲染 -->
<Markdown :model-value="article.content" mode="previewOnly" />
```

```ts
import { Markdown } from "@zhangxianjue/markdown";
import "@zhangxianjue/markdown/style.css";
// ⚠️ 公式样式需要宿主额外引入（库模式会把 KaTeX 字体内联进 CSS，故不打包）
import "katex/dist/katex.min.css";
```

### Props

| 属性 | 类型 | 默认值 | 说明 |
| :--- | :--- | :--- | :--- |
| `modelValue` | `string` | `""` | Markdown 全文 |
| `mode` | `"editOnly" \| "previewOnly" \| "edit&preview"` | `"previewOnly"` | 模式 |
| `fileUpload` | `(file: File) => Promise<string>` | — | 图片上传；不传回退 base64 |
| `placeholder` | `string` | `"请输入 Markdown 内容…"` | 编辑区占位 |
| `height` | `string` | — | 容器高度；预览模式默认随内容撑开 |
| `readonly` | `boolean` | `false` | 只读 |
| `breaks` | `boolean` | `true` | 单换行渲染为 `<br>` |
| `toolbar` | `ToolbarItem[] \| false` | `DEFAULT_TOOLBAR` | 工具栏配置；`false` 关闭 |
| `tocSticky` | `boolean` | `true` | 目录是否固定悬浮；`false` 时随正文滚动 |
| `tocCollapsible` | `boolean` | `true` | 目录是否可折叠 |
| `tocDefaultCollapsed` | `boolean` | `false` | 目录初始是否折叠 |
| `tocMode` | `"marker" \| "auto" \| "off"` | `"marker"` | 目录生成方式；`auto` 无 `[TOC]` 也自动生成 |

### 事件与实例方法

- `update:modelValue`：内容变化
- `error`：图片读取 / 上传失败
- `getMarkdownContent()`：取当前全文
- `focus()`：聚焦编辑区

## 扩展语法

| 语法 | 示例 | 渲染结果 |
| :--- | :--- | :--- |
| 注音 | `{汉字\|hàn zì}` | `<ruby>汉字<rt>hàn zì</rt></ruby>` |
| 下标 | `^^下标^^` | `<sub>` |
| 上标 | `^上标^` | `<sup>` |
| 下划线 | `++文字++` | `<u>` |
| 高亮 | `==文字==` | `<mark>` |
| 字号 | `!20 文字!` | 20px |
| 文字色 | `!!#e74c3c 文字!!` | 红色 |
| 背景色 | `!!!#f1c40f 文字!!!` | 黄色底 |
| 手风琴 | `+++ 标题` / 内容 / `+++` | `<details>` |
| 默认展开 | `+++- 标题` | `<details open>` |
| 信息面板 | `::: warning 注意` / 内容 / `:::` | 警告面板 |
| 对齐 | `::: center` / 内容 / `:::` | 居中块 |
| 目录 | 单独一行 `[TOC]` | 固定在左侧、垂直居中的浮层目录 |
| 任务清单 | `- [ ] 待办` / `- [x] 完成` | 禁用 checkbox |
| 行内公式 | `$E=mc^2$` | KaTeX |
| 块级公式 | `$$` 换行公式 换行 `$$` | KaTeX |

信息面板类型：`tips` / `info` / `warning` / `danger` / `success`；对齐类型：`left` / `center` / `right`。

### 目录布局

- 正文列固定最大宽度 `--md-content-width`（默认 `820px`），水平居中；
- 目录固定悬浮在左侧、垂直居中：
  `position: fixed; top: 50%; left: 0; transform: translateY(-50%)`；
  `left: 0` 相对**预览区左边缘**，不是浏览器视口；
- `previewOnly` 下相对视口垂直居中，页面滚动时目录保持不动；
  水平方向仍对准预览区左边缘；
  编辑 + 预览分栏时，预览面板通过 `transform` 成为 fixed 的包含块，目录相对面板定位；
- 目录是半透明磨砂浮层，正文从下方透出；
  `md-toc-anchor` 高度为 0，不挤占正文；
- 点 `«` 收起后只留一个同样位置的 `☰` 按钮；
- `tocSticky={false}` 时改为 `position: absolute`，随正文一起滚动。

### B 站播放器

任何指向 `bilibili.com/video/BV...` 或 `av...` 的链接都会渲染为播放器：

```md
https://www.bilibili.com/video/BV1xx411c7mD
```

- 段落里只有这一条链接时渲染为块级播放器；
- 与其它文字混排时渲染为行内播放器；
- `b23.tv` 短链需要联网解析，保持普通链接。

## 工具栏配置

```ts
import { DEFAULT_TOOLBAR, type ToolbarItem } from "@zhangxianjue/markdown";

const toolbar: ToolbarItem[] = ["bold", "italic", "|", "toc"];
// <Markdown :toolbar="toolbar" />
```

`"|"` 表示分隔线；`size`、`color`、`header`、`list`、`justify`、`panel` 自带二级菜单。

## 纯渲染 API

不需要 Vue 组件时可以直接调用渲染器：

```ts
import { renderMarkdown, createMarkdownRenderer } from "@zhangxianjue/markdown";

const html = renderMarkdown("# 标题", { breaks: true, tocTitle: "目录" });
const md = createMarkdownRenderer();
```

`renderMarkdown` 会按选项缓存 markdown-it 实例，适合在预览区高频调用。

## 安全

- 原始 HTML 走 DOMPurify 白名单，`<script>`、事件属性、`javascript:` 协议都会被清除。
- 扩展语法生成的颜色 / 字号值在解析阶段做了格式校验，不会拼进任意 CSS。
- B 站播放器只接受正则校验过的 BV / av 号，`iframe` 的 `src` 由插件自己拼接。
- 外链统一补 `target="_blank"` 与 `rel="noopener noreferrer"`。

## 依赖说明

| 依赖 | 用途 |
| :--- | :--- |
| `markdown-it` | Markdown 解析与 HTML 渲染 |
| `markdown-it-emoji` | `:smile:` 短代码 |
| `markdown-it-footnote` | 脚注 |
| `katex` | 数学公式 |
| `dompurify` | 原始 HTML 白名单清洗 |

KaTeX CSS 不打包进 `style.css`：Vite 库模式会强制把 `@font-face` 内联成 base64，
会让样式文件膨胀到 1.4 MB。宿主显式引入 `katex/dist/katex.min.css` 即可，字体由宿主的构建处理。

## 目录结构

```bash
src
├── components      # Markdown（编辑器外壳）、MarkdownToolbar、MarkdownPreview
├── composables     # useEditorHistory（撤销 / 重做）
├── core            # renderer、commands、sanitize、slug、toolbar
│   └── plugins     # 注音/上下标、公式、手风琴、面板、目录、任务清单、B 站
├── styles          # 编辑器与预览样式
└── types.ts        # 公开类型
```

## 构建

```bash
npm run build -w @zhangxianjue/markdown
```

产物：`dist/markdown.es.js`、`dist/markdown.cjs`、`dist/style.css`、`types/`。

> ⚠️ 消费方读的是 `dist/`，改动源码后必须重新构建，否则 admin / client 跑的还是旧版本。
