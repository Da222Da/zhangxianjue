import type { MarkdownIt } from "markdown-it";

const TASK_RE = /^\[([ xX])\]\s+/;

/**
 * GFM 任务清单
 *
 * `- [ ] 待办` / `- [x] 已完成` 会被 markdown-it 当成普通列表项，
 * 这里在 inline 解析完成后把前缀换成禁用的 checkbox，并给 li / ul 加类名。
 */
export function addTaskList(md: MarkdownIt): void {
  md.core.ruler.push("md_task_list", (state) => {
    const tokens = state.tokens;

    for (let i = 0; i < tokens.length; i += 1) {
      const inline = tokens[i];
      if (inline.type !== "inline" || !inline.children || inline.children.length === 0) {
        continue;
      }
      // 只处理「列表项的第一个段落」：list_item_open → paragraph_open → inline
      if (
        i < 2 ||
        tokens[i - 1].type !== "paragraph_open" ||
        tokens[i - 2].type !== "list_item_open"
      ) {
        continue;
      }

      const first = inline.children[0];
      if (first.type !== "text") {
        continue;
      }
      const match = TASK_RE.exec(first.content);
      if (!match) {
        continue;
      }

      first.content = first.content.slice(match[0].length);

      const checked = match[1].toLowerCase() === "x";
      const checkbox = new state.Token("md_html", "", 0);
      checkbox.content = `<input class="md-task-checkbox" type="checkbox" disabled${checked ? " checked" : ""}> `;
      inline.children.unshift(checkbox);

      tokens[i - 2].attrJoin("class", "md-task-item");

      // 给所属列表加类名，去掉默认圆点 / 序号。
      // 同一列表的每个任务项都会走到这里，先判断类名避免重复追加。
      for (let j = i - 3; j >= 0; j -= 1) {
        if (tokens[j].type === "bullet_list_open" || tokens[j].type === "ordered_list_open") {
          const classes = String(tokens[j].attrGet("class") ?? "").split(/\s+/);
          if (!classes.includes("md-task-list")) {
            tokens[j].attrJoin("class", "md-task-list");
          }
          break;
        }
      }
    }
  });
}
