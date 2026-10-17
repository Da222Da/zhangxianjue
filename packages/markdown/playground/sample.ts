export const SAMPLE_MARKDOWN = `[TOC]

# UE5 移动端渲染笔记

这是一段 **加粗**、*斜体*、++下划线++、~~删除线~~、==高亮== 的示例，也支持 ^上标^ 与 ^^下标^^。

{ruby 注音|zhù yīn}：{汉字|hàn zì}

## 字体与颜色

- 字号：!14 小字! / !20 大字! / !24 特大!
- 颜色：!!#e74c3c 红色文字!! / !!!#f1c40f 黄色背景!!!
- 行内代码：\`const answer = 42\`
- 行内公式：$E = mc^2$

## 段落与列表

> 这是一段引用。
> 第二行仍然在引用里。

- 无序列表
- 第二项
  - 嵌套项

1. 有序列表
2. 第二项

- [ ] 待办事项
- [x] 已完成事项

::: tips 小提示
面板支持 **markdown**，也支持任务清单与代码块。
:::

::: warning 注意
B 站视频链接会自动渲染为播放器：
https://www.bilibili.com/video/BV1xx411c7mD
:::

::: center
这段文字居中显示。
:::

### 手风琴

+++ 点击展开更多
这里是收起的内容。

- 可以放列表
- 也可以放代码

+++
+++- 默认展开
这一块默认是展开状态。
+++

## 代码与公式

\`\`\`ts
interface User {
  name: string;
  age: number;
}

const user: User = { name: "张三", age: 18 };
\`\`\`

$$
\\int_{-\\infty}^{\\infty} e^{-x^2} dx = \\sqrt{\\pi}
$$

## 表格

| 场景 | 方案 | 备注 |
| :--- | :--- | :--- |
| 移动端 | Mobile HDR | 需要关闭 |
| PC | Lumen | 默认开启 |

## 图片与链接

![示例图片](https://dummyimage.com/800x360/4c72b0/ffffff&text=markdown)

[站内链接](/notes/1) 与 [外链](https://example.com)

## 脚注

正文里可以放脚注[^1]，也可以引用式链接 [Markdown][md]。

[^1]: 这是脚注内容。

[md]: https://commonmark.org "CommonMark"
`;
