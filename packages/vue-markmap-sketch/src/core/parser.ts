import type {
  MarkmapOptions,
  NodeTag,
  ParseResult,
  TreeNode,
  TreeNodePayload,
} from "../types";
import { md } from "./markdown";
import { pickOptionsFromFrontmatter } from "./options";
import { splitFrontmatter } from "./frontmatter";
import { hashString } from "./utils";

/** `<!-- markmap: fold -->` 让节点默认折叠 */
const FOLD_COMMENT_RE = /<!--\s*markmap:\s*fold\s*-->/i;
/** 任务列表：`- [ ] todo` / `- [x] done` */
const TASK_RE = /^\s*\[([ xX])\]\s+/;

/**
 * 把 Markdown 解析成思维导图树。
 *
 * 层级规则：
 * - 标题 `#`~`######` → 目标层级 = 标题级数
 * - 列表项（含嵌套）→ 目标层级 = 最近的标题级数 + 列表嵌套深度
 * - 列表外的段落 → 目标层级 = 最近的标题级数 + 1
 *
 * 「目标层级」只决定挂在哪个父节点下（向上回溯到 depth 更小的祖先），
 * 节点最终的 `depth` 一律取真实树深度，因此 `##` 直接跟在 `#` 后面也是 depth 2。
 */
export function parseMarkdown(source: string): ParseResult {
  const { data: frontmatter, body } = splitFrontmatter(String(source ?? ""));
  const tokens = md.parse(body, {});

  const root = createNode("", { tag: "root" }, 0);
  const stack: TreeNode[] = [root];
  /** 列表嵌套栈，值为该层是否有序列表 */
  const listStack: boolean[] = [];
  let headingLevel = 0;
  let pendingHeading = false;
  let pendingItem = false;
  // 放在对象里是为了避开闭包内的类型收窄（push 里赋值、循环里读取）
  const state: { lastNode: TreeNode | null } = { lastNode: null };

  /**
   * 每个栈帧在 Markdown 里的目标层级，和 stack 一一对应。
   *
   * 不能用 `node.depth` 代替：树深度是「父深度 + 1」，而 target 来自标题级数 +
   * 列表嵌套。`##` 标题在树里是 depth 1 但 target 是 2，两者一旦错位，
   * 回溯条件就失效 —— 更深一层的兄弟节点会被错误地挂到上一个节点下面。
   */
  const levels: number[] = [0];

  const push = (target: number, content: string, payload: TreeNodePayload, fold?: boolean) => {
    while (stack.length > 1 && levels[levels.length - 1] >= target) {
      stack.pop();
      levels.pop();
    }
    const parent = stack[stack.length - 1];
    const node = createNode(content, payload, parent.depth + 1);
    if (fold) node.fold = true;
    parent.children.push(node);
    stack.push(node);
    levels.push(target);
    state.lastNode = node;
  };

  for (const token of tokens) {
    switch (token.type) {
      case "heading_open":
        pendingHeading = true;
        headingLevel = Number(token.tag.slice(1)) || 1;
        break;

      case "heading_close":
        pendingHeading = false;
        break;

      case "bullet_list_open":
        listStack.push(false);
        break;

      case "ordered_list_open":
        listStack.push(true);
        break;

      case "bullet_list_close":
      case "ordered_list_close":
        listStack.pop();
        break;

      case "list_item_open":
        pendingItem = true;
        break;

      case "list_item_close":
        pendingItem = false;
        break;

      case "inline": {
        const listLevel = listStack.length;
        if (pendingHeading) {
          const parsed = extractContent(token.content, { tag: "heading", level: headingLevel });
          push(headingLevel, parsed.content, parsed.payload, parsed.fold);
          pendingHeading = false;
        } else if (pendingItem) {
          const parsed = extractContent(token.content, {
            tag: "list",
            ordered: listStack[listStack.length - 1] === true,
          });
          push(headingLevel + listLevel, parsed.content, parsed.payload, parsed.fold);
          pendingItem = false;
        } else {
          const parsed = extractContent(token.content, { tag: "paragraph" });
          push(headingLevel + listLevel + 1, parsed.content, parsed.payload, parsed.fold);
        }
        break;
      }

      case "fence": {
        // 代码块挂到紧邻的节点上（列表内的代码块属于列表项自身内容，跳过）
        const last = state.lastNode;
        if (last && listStack.length === 0 && token.content.trim()) {
          last.payload = last.payload ?? {};
          const lines = token.content.replace(/\n$/, "");
          last.payload.lines = last.payload.lines
            ? `${last.payload.lines}\n${lines}`
            : lines;
        }
        break;
      }

      default:
        break;
    }
  }

  finalizeTree(root);

  return {
    root,
    frontmatter,
    body,
    options: pickOptionsFromFrontmatter(frontmatter) as MarkmapOptions,
  };
}

function createNode(
  content: string,
  payload: TreeNodePayload,
  depth: number,
): TreeNode {
  return {
    id: "",
    content,
    children: [],
    depth,
    payload,
  };
}

/** 从行内 token 里剥离折叠注释、任务列表标记 */
function extractContent(
  raw: string,
  base: TreeNodePayload,
): { content: string; payload: TreeNodePayload; fold?: boolean } {
  let content = raw;
  let fold = false;

  if (FOLD_COMMENT_RE.test(content)) {
    fold = true;
    content = content.replace(FOLD_COMMENT_RE, " ");
  }

  const payload: TreeNodePayload = { ...base };
  const task = TASK_RE.exec(content);
  if (task) {
    payload.checked = task[1].toLowerCase() === "x";
    content = content.slice(task[0].length);
  }

  return { content: content.trim(), payload, fold };
}

/**
 * 收尾处理：剪掉空叶子 → 单根提升 → 重算 depth → 分配稳定 id。
 */
function finalizeTree(root: TreeNode): void {
  pruneEmpty(root);

  // 全文只有一个顶层节点时，把它提升为根，避免出现空白的中心节点
  if (root.children.length === 1 && root.children[0].content) {
    const [only] = root.children;
    root.content = only.content;
    root.payload = only.payload;
    if (only.fold) root.fold = true;
    root.children = only.children;
  }

  refreshDepth(root, 0);
  assignIds(root);
}

/** 递归删除没有内容的叶子节点 */
function pruneEmpty(node: TreeNode): void {
  node.children = node.children.filter((child) => {
    pruneEmpty(child);
    return child.content !== "" || child.children.length > 0;
  });
}

function refreshDepth(node: TreeNode, depth: number): void {
  node.depth = depth;
  for (const child of node.children) {
    refreshDepth(child, depth + 1);
  }
}

/**
 * 生成稳定 id：`祖先内容路径 + 同名序号` 的哈希。
 * 同一段 Markdown 反复解析得到相同 id，便于增量更新与折叠状态保持。
 */
function assignIds(root: TreeNode): void {
  const counters = new Map<string, number>();

  const walk = (node: TreeNode, path: string[]) => {
    for (const child of node.children) {
      const key = [...path, child.content].join("\u0000");
      const seen = counters.get(key) ?? 0;
      counters.set(key, seen + 1);
      child.id = `n${hashString(key)}${seen ? `-${seen}` : ""}`;
      walk(child, [...path, child.content]);
    }
  };

  root.id = "root";
  walk(root, [""]);
}

/** 深度优先展开全部节点 */
export function flattenTree(root: TreeNode): TreeNode[] {
  const result: TreeNode[] = [];
  const walk = (node: TreeNode) => {
    result.push(node);
    for (const child of node.children) walk(child);
  };
  walk(root);
  return result;
}

/** 按 id 查找节点 */
export function findNode(root: TreeNode, id: string): TreeNode | undefined {
  if (root.id === id) return root;
  for (const child of root.children) {
    const found = findNode(child, id);
    if (found) return found;
  }
  return undefined;
}

/** 从根到指定节点的路径（含两端） */
export function findNodePath(root: TreeNode, id: string): TreeNode[] {
  const path: TreeNode[] = [];
  const walk = (node: TreeNode): boolean => {
    path.push(node);
    if (node.id === id) return true;
    for (const child of node.children) {
      if (walk(child)) return true;
    }
    path.pop();
    return false;
  };
  return walk(root) ? path : [];
}

export type { NodeTag };
