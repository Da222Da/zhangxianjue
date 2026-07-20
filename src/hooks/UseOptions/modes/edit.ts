export default {
  toolbars: {
    // 定义顶部工具栏
    toolbar: [
      "undo",
      "redo",
      "|",
      // 把字体样式类按钮都放在加粗按钮下面
      { bold: ["bold", "italic", "underline", "strikethrough", "sub", "sup", "ruby"] },
      "color",
      "size",
      "|",
      "header",
      "list",
      "panel",
      "|",
      // 把插入类按钮都放在插入按钮下面
      { insert: ["image", "audio", "video", "link", "hr", "br", "code", "formula", "toc", "table"] },
      "graph",
    ],
    // 定义侧边栏，默认为空
    sidebar: [],
    // 定义顶部右侧工具栏，默认为空
    toolbarRight: ["fullScreen", "export"],
    // 定义选中文字时弹出的“悬浮工具栏”，默认为 ['bold', 'italic', 'underline', 'strikethrough', 'sub', 'sup', 'quote', '|', 'size', 'color']
    bubble: ["bold", "italic", "underline", "strikethrough", "sub", "sup", "ruby", "|", "color", "size"],
    // 定义光标出现在行首位置时出现的“提示工具栏”，默认为 ['h1', 'h2', 'h3', '|', 'checklist', 'quote', 'table', 'code']
    float: ["table", "code", "graph"],
  },
};
