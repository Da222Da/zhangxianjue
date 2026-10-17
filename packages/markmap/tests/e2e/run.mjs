/**
 * 浏览器端冒烟测试。
 *
 * 覆盖 vitest 覆盖不到的部分：rough.js 实际生成的路径、foreignObject 文本排版、
 * 折叠补间动画、d3-zoom 交互、SVG / PNG 导出。
 *
 * 运行前需要先起 playground：
 *   npm run dev
 * 然后：
 *   npm run test:e2e
 *
 * Chrome 路径可用环境变量 CHROME_PATH 覆盖。
 */
import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const PORT = Number(process.env.E2E_PORT ?? 9333);
const PAGE_URL = process.env.E2E_URL ?? "http://127.0.0.1:8090/";
const OUT_DIR = resolve(process.env.E2E_OUT ?? join(tmpdir(), "markmap-e2e"));
const SHOT = process.argv.includes("--screenshot");

const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
  "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
  "/usr/bin/google-chrome",
  "/usr/bin/chromium",
  "/usr/bin/chromium-browser",
].filter(Boolean);

const CHROME = CHROME_CANDIDATES.find((path) => existsSync(path));
if (!CHROME) {
  console.error("找不到 Chrome，可用 CHROME_PATH 环境变量指定可执行文件路径");
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const chrome = spawn(
  CHROME,
  [
    "--headless=new",
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${join(tmpdir(), `mvs-e2e-${Date.now()}`)}`,
    "--disable-gpu",
    "--no-first-run",
    "--no-default-browser-check",
    "--hide-scrollbars",
    // 触摸事件注入需要浏览器本身开启触摸事件支持，
    // 只靠 Emulation.setTouchEmulationEnabled 只能改 navigator.maxTouchPoints，
    // Input.dispatchTouchEvent 派发出去的事件不会真正到达 DOM
    "--touch-events=enabled",
    "--remote-allow-origins=*",
    "--window-size=1440,900",
    "--force-device-scale-factor=1",
    PAGE_URL,
  ],
  { stdio: "ignore" },
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

class CDP {
  constructor(ws) {
    this.ws = ws;
    this.seq = 0;
    this.pending = new Map();
    this.events = [];
  }

  static async connect(url) {
    const ws = new WebSocket(url);
    await new Promise((resolve_, reject) => {
      ws.addEventListener("open", resolve_, { once: true });
      ws.addEventListener("error", reject, { once: true });
    });
    const client = new CDP(ws);
    ws.addEventListener("message", (event) => client.onMessage(JSON.parse(event.data)));
    return client;
  }

  onMessage(message) {
    if (message.id && this.pending.has(message.id)) {
      const { resolve: resolve_, reject } = this.pending.get(message.id);
      this.pending.delete(message.id);
      if (message.error) reject(new Error(JSON.stringify(message.error)));
      else resolve_(message.result);
      return;
    }
    if (message.method) this.events.push(message);
  }

  send(method, params = {}, timeoutMs = 30000) {
    const id = ++this.seq;
    return new Promise((resolve_, reject) => {
      // 页面重载 / 上下文销毁时 CDP 命令可能永远不返回，
      // 加超时报出方法名，比整个进程静默挂死好排查
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP 命令超时：${method}`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (value) => {
          clearTimeout(timer);
          resolve_(value);
        },
        reject: (error) => {
          clearTimeout(timer);
          reject(error);
        },
      });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async evaluate(expression) {
    const result = await this.send("Runtime.evaluate", {
      expression,
      awaitPromise: true,
      returnByValue: true,
      userGesture: true,
    });
    if (result.exceptionDetails) {
      throw new Error(
        result.exceptionDetails.exception?.description ??
          JSON.stringify(result.exceptionDetails),
      );
    }
    return result.result.value;
  }

  /** 截图只是辅助产物，失败了不该让整个用例判失败 */
  async screenshot(name) {
    try {
      const { data } = await this.send("Page.captureScreenshot", { format: "png" }, 8000);
      const file = join(OUT_DIR, name);
      writeFileSync(file, Buffer.from(data, "base64"));
      return file;
    } catch (error) {
      console.log(`      (截图 ${name} 未生成：${error.message})`);
      return null;
    }
  }
}

const results = [];
const skips = [];
const startedAt = Date.now();
function check(name, ok, detail) {
  results.push({ name, ok });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1).padStart(5);
  console.log(`${ok ? "PASS" : "FAIL"}  ${elapsed}s  ${name}${detail ? `  [${detail}]` : ""}`);
}

/**
 * 环境不支持时明确跳过，而不是报成失败。
 * 只在「被测能力本身无法在本环境验证」时使用，不能拿来掩盖真实缺陷。
 */
function skip(name, reason) {
  skips.push({ name, reason });
  const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1).padStart(5);
  console.log(`SKIP  ${elapsed}s  ${name}  [${reason}]`);
}

let touchDelivered = true;
function touchCheck(name, ok, detail) {
  if (!touchDelivered) {
    skip(name, "本机无头 Chrome 无法把 CDP 注入的触摸事件送达 DOM");
    return;
  }
  check(name, ok, detail);
}

async function waitForTarget() {
  for (let i = 0; i < 80; i += 1) {
    try {
      const list = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json();
      const page = list.find((t) => t.type === "page" && t.webSocketDebuggerUrl);
      if (page) return page;
    } catch {
      // 调试端口还没就绪
    }
    await sleep(250);
  }
  throw new Error("Chrome 调试端口未就绪");
}

async function main() {
  const target = await waitForTarget();
  const cdp = await CDP.connect(target.webSocketDebuggerUrl);
  await cdp.send("Page.enable");
  await cdp.send("Runtime.enable");

  // Vite 的 HMR 可能在连接后重载页面，这里容忍一次上下文重建
  const boot = `(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    for (let i = 0; i < 150; i++) {
      if (document.querySelectorAll('.mvs-node').length > 0) break;
      await wait(100);
    }
    await wait(1500);
    return document.querySelectorAll('.mvs-node').length;
  })()`;
  let booted = 0;
  for (let attempt = 0; attempt < 3 && !booted; attempt += 1) {
    try {
      booted = await cdp.evaluate(boot);
    } catch {
      await sleep(1500);
    }
  }
  check("playground 首屏渲染出节点", booted > 0, `nodes=${booted}`);

  // ---- 渲染结构 ----
  const structure = await cdp.evaluate(`(() => {
    const nodes = [...document.querySelectorAll('.mvs-node')];
    const shapes = nodes.map(n => n.querySelectorAll('.mvs-node-shape path').length);
    const linkPaths = [...document.querySelectorAll('.mvs-link path')];
    return {
      nodes: nodes.length,
      links: document.querySelectorAll('.mvs-link').length,
      linkPaths: linkPaths.length,
      minShapePaths: Math.min(...shapes),
      roughCurvedShapes: nodes.filter(n =>
        /[CQ]/.test(n.querySelector('.mvs-node-shape path')?.getAttribute('d') || '')).length,
      bezierLinks: linkPaths.filter(p => (p.getAttribute('d') || '').includes('C')).length,
      toggles: nodes.filter(n => n.querySelector('.mvs-node-toggle')?.style.display !== 'none').length,
      foreignObjectTexts: nodes.filter(n => n.querySelector('.mvs-node-text')?.textContent?.trim()).length,
      bold: nodes.filter(n => n.querySelector('strong')).length,
      codeBlocks: document.querySelectorAll('.mvs-node-code').length,
      sample: [...nodes].slice(0, 4).map(n => n.querySelector('.mvs-node-text')?.textContent?.trim()),
    };
  })()`);

  check("渲染出节点与连线", structure.nodes > 0 && structure.links > 0,
    `nodes=${structure.nodes}, links=${structure.links}`);
  check("节点框由 rough.js 生成（含曲线抖动）",
    structure.roughCurvedShapes === structure.nodes && structure.minShapePaths >= 2,
    `curved=${structure.roughCurvedShapes}/${structure.nodes}, paths>=${structure.minShapePaths}`);
  check("连线是三次贝塞尔曲线，不是直线",
    structure.bezierLinks === structure.linkPaths && structure.linkPaths > 0,
    `bezier=${structure.bezierLinks}/${structure.linkPaths}`);
  check("文本经 foreignObject 渲染",
    structure.foreignObjectTexts >= structure.nodes - 1,
    `texts=${structure.foreignObjectTexts}, sample=${JSON.stringify(structure.sample)}`);
  check("行内加粗与代码块生效", structure.bold > 0 && structure.codeBlocks > 0,
    `strong=${structure.bold}, pre=${structure.codeBlocks}`);
  check("有子节点的节点显示折叠标识", structure.toggles > 0, `toggles=${structure.toggles}`);

  // ---- 默认展开层数 ----
  const defaultLevel = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const renderer = root.__vueParentComponent.exposed.getRenderer();
    const original = renderer.getOptions();
    const tree = renderer.getTree();

    let deepest = 0;
    const walkDepth = (node) => {
      if (node !== tree) deepest = Math.max(deepest, node.depth);
      node.children.forEach(walkDepth);
    };
    walkDepth(tree);

    // 显式设一个比树浅的层级，结果才不受 front-matter 影响
    const level = Math.max(1, Math.min(2, deepest - 1));
    renderer.setOptions({ ...original, initialExpandLevel: level });
    await wait(900);

    const foldedDepths = [];
    const walk = (node) => {
      if (node !== tree && renderer.isFolded(node.id)) foldedDepths.push(node.depth);
      node.children.forEach(walk);
    };
    walk(tree);

    renderer.setOptions(original);
    await wait(900);

    return {
      level,
      deepest,
      foldedCount: foldedDepths.length,
      minFoldedDepth: foldedDepths.length ? Math.min(...foldedDepths) : null,
    };
  })()`);
  // 「默认值是 3」由单测守；这里验证的是折叠规则本身。
  // 显式设一个比树浅的层级，避免结果受 playground front-matter 影响
  check(
    "initialExpandLevel 折叠规则正确（depth >= level 且有子节点）",
    defaultLevel.foldedCount > 0 &&
      defaultLevel.minFoldedDepth === defaultLevel.level,
    `level=${defaultLevel.level}，树最深 ${defaultLevel.deepest} 层，` +
      `折叠 ${defaultLevel.foldedCount} 个，最浅折叠在 depth ${defaultLevel.minFoldedDepth}`,
  );

  const levelSwitch = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const renderer = root.__vueParentComponent.exposed.getRenderer();
    const original = renderer.getOptions();

    const foldedCount = () => {
      const tree = renderer.getTree();
      let count = 0;
      const walk = (node) => {
        if (node !== tree && renderer.isFolded(node.id)) count += 1;
        node.children.forEach(walk);
      };
      walk(tree);
      return count;
    };
    const foldedDepths = () => {
      const tree = renderer.getTree();
      const depths = [];
      const walk = (node) => {
        if (node !== tree && renderer.isFolded(node.id)) depths.push(node.depth);
        node.children.forEach(walk);
      };
      walk(tree);
      return depths.sort((a, b) => a - b).join(",");
    };
    const visible = () => document.querySelectorAll('.mvs-node').length;

    // 基准统一用 level=2 的折叠结果，避免受 front-matter 里更深层级的影响
    renderer.setOptions({ ...original, initialExpandLevel: 2 });
    await wait(900);
    const initialFolded = foldedCount();
    const initialVisible = visible();
    const initialDepths = foldedDepths();

    renderer.setOptions({ ...original, initialExpandLevel: 1 });
    await wait(900);
    const atOne = { folded: foldedCount(), visible: visible() };
    const oneDepths = foldedDepths();

    renderer.setOptions({ ...original, initialExpandLevel: -1 });
    await wait(900);
    const atAll = { folded: foldedCount(), visible: visible() };
    const allDepths = foldedDepths();

    renderer.setOptions({ ...original, initialExpandLevel: 2 });
    await wait(900);
    const restored = { folded: foldedCount(), visible: visible() };
    const restoredDepths = foldedDepths();

    renderer.setOptions(original);
    await wait(900);

    return {
      initialFolded,
      initialVisible,
      atOne,
      atAll,
      restored,
      depths: {
        initial: initialDepths,
        atOne: oneDepths,
        atAll: allDepths,
        restored: restoredDepths,
      },
      levelAfterRestore: renderer.getOptions().initialExpandLevel,
    };
  })()`);
  check(
    "运行时改 initialExpandLevel 立即生效",
    levelSwitch.atOne.folded > levelSwitch.initialFolded &&
      levelSwitch.atOne.visible < levelSwitch.initialVisible &&
      levelSwitch.atAll.folded === 0 &&
      levelSwitch.atAll.visible > levelSwitch.initialVisible &&
      levelSwitch.restored.folded === levelSwitch.initialFolded &&
      levelSwitch.restored.visible === levelSwitch.initialVisible,
    `默认 folded=[${levelSwitch.depths.initial}] 可见 ${levelSwitch.initialVisible} → ` +
      `level=1 folded=[${levelSwitch.depths.atOne}] 可见 ${levelSwitch.atOne.visible} → ` +
      `level=-1 folded=[${levelSwitch.depths.atAll}] 可见 ${levelSwitch.atAll.visible} → ` +
      `还原 level=${levelSwitch.levelAfterRestore} folded=[${levelSwitch.depths.restored}] 可见 ${levelSwitch.restored.visible}`,
  );

  // ---- 文本必须落在框内（测量与浏览器排版一致）----
  const fit = await cdp.evaluate(`(() => {
    const bad = [];
    for (const nodeEl of document.querySelectorAll('.mvs-node')) {
      const body = nodeEl.querySelector('.mvs-node-body');
      const textEl = nodeEl.querySelector('.mvs-node-text');
      if (!textEl) continue;
      const style = getComputedStyle(body);
      const contentWidth =
        body.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight);
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const rendered = range.getBoundingClientRect().width;
      if (rendered > contentWidth + 1) {
        bad.push({ text: textEl.textContent.slice(0, 18), rendered: +rendered.toFixed(1), contentWidth });
      }
    }
    return bad;
  })()`);
  check("每行文本都落在节点框内（测量与浏览器排版一致）", fit.length === 0,
    fit.length ? JSON.stringify(fit.slice(0, 4)) : "全部节点无溢出");

  if (SHOT) await cdp.screenshot("01-editor.png");

  // ---- 折叠动画 ----
  const animation = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const nodes = () => [...document.querySelectorAll('.mvs-node')];
    const opacitySum = () => nodes().reduce((s, n) => s + Number(n.getAttribute('opacity') ?? 1), 0);

    const countBefore = nodes().length;
    const sumBefore = opacitySum();
    document.querySelector('.mvs-node[data-id="root"] .mvs-node-toggle')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));

    await wait(150);
    const sumMid = opacitySum();
    await wait(1700);
    const countAfter = nodes().length;
    const sumAfter = opacitySum();

    document.querySelector('.mvs-node[data-id="root"] .mvs-node-toggle')
      .dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(1700);

    return { countBefore, countAfter, restored: nodes().length, sumBefore, sumMid, sumAfter };
  })()`);

  check("点击折叠标识收纳整棵子树",
    animation.countAfter === 1 && animation.countBefore > 1,
    `${animation.countBefore} → ${animation.countAfter}`);
  check("折叠是补间动画（存在中间帧，不是瞬变）",
    animation.sumMid < animation.sumBefore - 0.5 && animation.sumMid > animation.sumAfter + 0.5,
    `透明度和 ${animation.sumBefore?.toFixed(2)} → ${animation.sumMid?.toFixed(2)} → ${animation.sumAfter?.toFixed(2)}`);
  check("再次点击可完全展开还原", animation.restored === animation.countBefore,
    `还原到 ${animation.restored}（原始 ${animation.countBefore}）`);

  // ---- 折叠时显示直接子节点数量 ----
  const badge = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const renderer = root.__vueParentComponent.exposed.getRenderer();
    const tree = renderer.getTree();

    // 取一个「不是根、直接子节点 >= 3」的节点，数量才够有代表性
    let target = null;
    const walk = (node) => {
      if (!target && node !== tree && node.children.length >= 3) target = node;
      node.children.forEach(walk);
    };
    walk(tree);
    if (!target) return { error: '示例数据里没有直接子节点 >= 3 的节点' };

    const toggleOf = (id) =>
      document.querySelector('.mvs-node[data-id="' + id + '"] .mvs-node-toggle');
    const labelOf = (id) => {
      const el = document.querySelector('.mvs-node[data-id="' + id + '"] .mvs-node-toggle-label');
      return el && el.style.display !== 'none' ? el.textContent : null;
    };

    const expandedLabel = labelOf(target.id);
    toggleOf(target.id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(900);
    const foldedLabel = labelOf(target.id);

    toggleOf(target.id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(900);
    const restoredLabel = labelOf(target.id);

    return {
      childCount: target.children.length,
      expected: '+' + target.children.length,
      expandedLabel,
      foldedLabel,
      restoredLabel,
    };
  })()`);

  check("折叠时显示直接子节点数量",
    badge.foldedLabel === badge.expected,
    badge.error ?? `标识="${badge.foldedLabel}"，期望 "${badge.expected}"（${badge.childCount} 个直接子节点）`);
  check("展开后数量文字收起",
    badge.expandedLabel === null && badge.restoredLabel === null,
    `展开态="${badge.expandedLabel}"，还原后="${badge.restoredLabel}"`);

  const countSwitch = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const renderer = root.__vueParentComponent.exposed.getRenderer();
    const original = renderer.getOptions();
    const labelOf = (id) => {
      const el = document.querySelector('.mvs-node[data-id="' + id + '"] .mvs-node-toggle-label');
      return el && el.style.display !== 'none' ? el.textContent : null;
    };
    const toggleOf = (id) =>
      document.querySelector('.mvs-node[data-id="' + id + '"] .mvs-node-toggle');

    // 折叠一个有多子节点的节点，记录带数量的样子
    const tree = renderer.getTree();
    let target = null;
    const walk = (node) => {
      if (!target && node !== tree && node.children.length >= 3) target = node;
      node.children.forEach(walk);
    };
    walk(tree);
    toggleOf(target.id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(900);
    const withCount = labelOf(target.id);

    // 关掉 showCollapsedCount
    renderer.setOptions({ ...original, showCollapsedCount: false });
    await wait(900);
    const withoutCount = labelOf(target.id);

    // 还原
    renderer.setOptions(original);
    await wait(900);
    toggleOf(target.id).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await wait(900);

    return { withCount, withoutCount };
  })()`);

  check("showCollapsedCount: false 时退回纯 +",
    countSwitch.withoutCount === "+" && countSwitch.withCount !== "+",
    `开="${countSwitch.withCount}"，关="${countSwitch.withoutCount}"`);

  // ---- 徽标不能被 fit() 裁掉 ----
  const badgeFit = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const inst = root.__vueParentComponent.exposed;

    inst.expandAll();
    await wait(900);
    inst.collapseAll(1);
    await wait(900);
    inst.fit();
    await wait(1200);

    const svgRect = document.querySelector('.mvs-svg').getBoundingClientRect();
    const labels = [...document.querySelectorAll('.mvs-node-toggle-label')]
      .filter((el) => el.style.display !== 'none');
    const outside = labels.filter((el) => {
      const r = el.getBoundingClientRect();
      return r.left < svgRect.left - 1 || r.right > svgRect.right + 1 ||
             r.top < svgRect.top - 1 || r.bottom > svgRect.bottom + 1;
    });
    return {
      count: labels.length,
      outside: outside.length,
      sample: outside.slice(0, 3).map((el) => el.textContent),
    };
  })()`);
  check("fit() 后折叠徽标完整落在视口内",
    badgeFit.count > 0 && badgeFit.outside === 0,
    `${badgeFit.count} 个徽标，${badgeFit.outside} 个越界 ${JSON.stringify(badgeFit.sample)}`);

  // 还原成全部展开，避免影响后续用例
  await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    root.__vueParentComponent.exposed.expandAll();
    await wait(900);
  })()`);

  // ---- 缩放与工具栏 ----
  const zoom = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const layer = document.querySelector('.mvs-zoom');
    const svg = document.querySelector('.mvs-svg');
    const k = () => Number(/scale\\(([\\d.]+)\\)/.exec(layer.getAttribute('transform') || '')?.[1] ?? 0);
    const rect = svg.getBoundingClientRect();

    const before = k();
    svg.dispatchEvent(new WheelEvent('wheel', {
      deltaY: -400, clientX: rect.left + rect.width / 2, clientY: rect.top + rect.height / 2,
      bubbles: true, cancelable: true,
    }));
    await wait(250);
    const afterWheel = k();

    const buttons = [...document.querySelectorAll('.mve-btn')];
    buttons.find(b => b.textContent.trim() === '适应视图')?.click();
    await wait(900);
    const afterFit = k();
    return { before, afterWheel, afterFit };
  })()`);
  check("滚轮缩放生效", zoom.afterWheel > zoom.before, `k ${zoom.before} → ${zoom.afterWheel}`);
  check("工具栏「适应视图」生效", zoom.afterFit !== zoom.afterWheel && zoom.afterFit > 0,
    `k ${zoom.afterWheel} → ${zoom.afterFit}`);

  const toolbar = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const buttons = [...document.querySelectorAll('.mve-btn')];
    const click = (label) => buttons.find(b => b.textContent.trim() === label)?.click();
    const count = () => document.querySelectorAll('.mvs-node').length;

    click('折叠到 2 层');
    await wait(900);
    const collapsed = count();
    click('全部展开');
    await wait(900);
    const expanded = count();
    return { collapsed, expanded };
  })()`);
  check("collapseAll(2) / expandAll() 生效",
    toolbar.collapsed > 0 && toolbar.expanded > toolbar.collapsed,
    `折叠后 ${toolbar.collapsed} → 展开后 ${toolbar.expanded}`);

  // ---- 链接：图标位置 + 可点 + 可拦截 ----
  const links = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const anchors = [...document.querySelectorAll('.mvs-node-text a[href]')];
    const external = anchors.find((a) => a.classList.contains('mvs-link--external'));
    const internal = anchors.find((a) => a.classList.contains('mvs-link--internal'));
    return {
      total: anchors.length,
      externalText: external?.textContent ?? null,
      externalTarget: external?.getAttribute('target') ?? null,
      externalRel: external?.getAttribute('rel') ?? null,
      externalPointerEvents: external ? getComputedStyle(external).pointerEvents : null,
      internalText: internal?.textContent ?? null,
      internalTarget: internal?.getAttribute('target') ?? null,
    };
  })()`);

  check("节点内链接被渲染出来", links.total >= 2, `${links.total} 个链接`);
  check("外链接图标在文本后、新窗口打开",
    links.externalText?.endsWith("↗") === true &&
      links.externalTarget === "_blank" &&
      links.externalRel === "noopener noreferrer",
    `文本="${links.externalText}"，target=${links.externalTarget}，rel=${links.externalRel}`);
  check("内链接图标在文本前、原地跳转",
    links.internalText?.startsWith("→") === true && links.internalTarget === null,
    `文本="${links.internalText}"，target=${links.internalTarget}`);
  check("链接放开了指针事件（其余文本仍不拦截）",
    links.externalPointerEvents === "auto",
    `a.pointerEvents=${links.externalPointerEvents}`);

  const linkClick = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const anchor = [...document.querySelectorAll('.mvs-node-text a[href]')]
      .find((a) => a.classList.contains('mvs-link--external'));
    if (!anchor) return { error: '没有外链接' };

    const events = [];
    window.__mvsLinkEvents = events;
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const inst = root.__vueParentComponent.exposed;
    // 通过组件事件监听，验证 link-click 会带出 node / href / event
    return { ready: true };
  })()`);

  // 用真实点击验证：先挂一个捕获阶段的监听记录事件，并拦截跳转
  const clickResult = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const anchor = [...document.querySelectorAll('.mvs-node-text a[href]')]
      .find((a) => a.classList.contains('mvs-link--external'));
    if (!anchor) return { error: '没有外链接' };

    let captured = null;
    const handler = (e) => { captured = { href: anchor.getAttribute('href'), defaultPrevented: e.defaultPrevented }; };
    anchor.addEventListener('click', handler, { once: true });

    const rect = anchor.getBoundingClientRect();
    const x = Math.round(rect.x + rect.width / 2);
    const y = Math.round(rect.y + rect.height / 2);

    // 先 pointerdown 记录起点，再点，模拟真实点击
    anchor.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
    anchor.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, clientX: x, clientY: y }));
    await wait(100);
    anchor.removeEventListener('click', handler);
    return { captured, nodeStillThere: !!document.querySelector('.mvs-node') };
  })()`);
  check("点击链接会命中链接而不是节点点击",
    clickResult.captured?.href?.startsWith("http") === true,
    `href=${clickResult.captured?.href}`);

  // ---- 图片 ----
  // 只看示例里那张自包含的 SVG data URL 图片；
  // 等比缩放到 maxWidth 的换算由 tests/images 的单测覆盖，这里验证的是真实排版
  const images = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    await wait(400);

    const imgs = [...document.querySelectorAll('.mvs-node-image')];
    if (!imgs.length) return { count: 0 };

    const node = imgs[0].closest('.mvs-node');
    const body = node.querySelector('.mvs-node-body');
    const bodyStyle = getComputedStyle(body);
    const contentWidth =
      body.clientWidth - parseFloat(bodyStyle.paddingLeft) - parseFloat(bodyStyle.paddingRight);
    // 必须用 offsetWidth / clientWidth 这类布局尺寸，
    // getBoundingClientRect 拿到的是乘过缩放变换的屏幕尺寸，和 maxWidth 不是一个量纲
    return {
      count: imgs.length,
      srcKind: (imgs[0].getAttribute('src') || '').slice(0, 30),
      natural: { w: imgs[0].naturalWidth, h: imgs[0].naturalHeight },
      rendered: { w: imgs[0].offsetWidth, h: imgs[0].offsetHeight },
      contentWidth: Math.round(contentWidth),
      contentHeight: Math.round(
        body.clientHeight - parseFloat(bodyStyle.paddingTop) - parseFloat(bodyStyle.paddingBottom),
      ),
      // 两个都含 padding 才能相减，否则差值里会混进 padding
      bodyOverflow: body.scrollHeight - body.clientHeight,
    };
  })()`);
  check(
    "节点内图片被渲染",
    images.count > 0,
    `${images.count} 张，src=${images.srcKind}…`,
  );
  check(
    "图片保持原始宽高比",
    images.count > 0 &&
      Math.abs(images.rendered.w / images.rendered.h - images.natural.w / images.natural.h) <
        0.05,
    images.count
      ? `原图 ${images.natural.w}×${images.natural.h} → 布局 ${images.rendered.w}×${images.rendered.h}`
      : "没有图片可校验",
  );
  check(
    "图片不撑破节点框",
    images.count > 0 &&
      images.rendered.w <= images.contentWidth + 1 &&
      images.bodyOverflow <= 1,
    images.count
      ? `图片宽 ${images.rendered.w} ≤ 内容宽 ${images.contentWidth}，` +
          `内容高溢岀 ${images.bodyOverflow}px`
      : "没有图片可校验",
  );

  // ---- 图片查看器：放大 / 缩小 / 下载 ----
  // 切到「只读视图」tab：它是裸的 MarkmapSketch，而且参数面板上的日志行
  // 能区分这次点击到底走了 image-click 还是 node-click
  await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    [...document.querySelectorAll('.pg-tab')]
      .find((b) => b.textContent.trim().startsWith('只读视图'))?.click();
    for (let i = 0; i < 80; i += 1) {
      if (document.querySelectorAll('.mvs-node').length > 0) break;
      await wait(100);
    }
    await wait(900);
  })()`);

  /**
   * 查看器用例里的点击都要带一次 pointerdown：
   * renderer 用「按下位置 vs 点击位置」区分点击和拖拽平移，
   * 少了 pointerdown 就会被上一次遗留的按下位置判成拖拽，点击被吃掉。
   */
  const viewer = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const logText = () => [...document.querySelectorAll('.pg-log')].pop()?.textContent ?? '';
    const btn = (label) => [...document.querySelectorAll('.mvs-lightbox-btn')]
      .find((b) => b.textContent.trim() === label);
    const scaleOf = () => document.querySelector('.mvs-lightbox-scale')?.textContent ?? '';
    const box = () => document.querySelector('.mvs-lightbox');

    const clickAt = (el) => {
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, clientX: x, clientY: y,
      }));
    };

    // 拦截 anchor.click 记录下载，避免真往磁盘里写文件
    const downloads = [];
    const nativeClick = HTMLAnchorElement.prototype.click;
    HTMLAnchorElement.prototype.click = function () {
      if (this.download) { downloads.push({ name: this.download, href: this.href.slice(0, 5) }); return; }
      return nativeClick.call(this);
    };

    const image = document.querySelector('.mvs-node-image');
    if (!image) return { error: '没有图片' };

    const cursor = getComputedStyle(image).cursor;
    const logBefore = logText();
    clickAt(image);
    await wait(200);

    const opened = !!box();
    const logAfterImage = logText();
    const scaleAfterOpen = scaleOf();

    // 放大 / 缩小
    btn('＋')?.click();
    await wait(80);
    const scaleAfterIn = scaleOf();
    const transformAfterIn = document.querySelector('.mvs-lightbox-image')?.style.transform ?? '';
    btn('－')?.click();
    await wait(80);
    const scaleAfterOut = scaleOf();

    // 双击放大到 2 倍
    document.querySelector('.mvs-lightbox-image')?.dispatchEvent(
      new MouseEvent('dblclick', { bubbles: true, cancelable: true, clientX: 10, clientY: 10 }),
    );
    await wait(80);
    const scaleAfterDouble = scaleOf();
    btn('1:1')?.click();
    await wait(80);
    const scaleAfterReset = scaleOf();

    // 下载
    btn('下载')?.click();
    await wait(800);
    const downloadLabel = btn('下载')?.textContent.trim() ?? btn('下载中…')?.textContent.trim() ?? '';

    // 先按 Esc 关，再点背景关
    box()?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await wait(200);
    const closedByEsc = !box();

    clickAt(image);
    await wait(200);
    const reopened = !!box();
    document.querySelector('.mvs-lightbox-stage')?.dispatchEvent(
      new MouseEvent('click', { bubbles: true, cancelable: true }),
    );
    await wait(200);
    const closedByBackdrop = !box();

    // 关掉开关：内置查看器不再打开，但事件照旧抛出来
    const toggle = document.querySelector('.pg-check input');
    toggle?.click();
    await wait(400);
    const cursorWhenDisabled = getComputedStyle(
      document.querySelector('.mvs-node-image'),
    ).cursor;
    clickAt(document.querySelector('.mvs-node-image'));
    await wait(200);
    const openedWhenDisabled = !!box();
    const logWhenDisabled = logText();

    toggle?.click();
    await wait(400);

    // 在图片上按住拖动＝平移画布，抬起时浏览器补的那个 click 不能开查看器
    const drag = (() => {
      const r = document.querySelector('.mvs-node-image').getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);
      const el = document.querySelector('.mvs-node-image');
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: x, clientY: y }));
      el.dispatchEvent(new MouseEvent('click', {
        bubbles: true, cancelable: true, clientX: x + 24, clientY: y + 24,
      }));
      return !!box();
    })();

    // 查看器里拖动平移，抬手时不能把灯箱关掉
    let backdropAfterDrag = null;
    if (!box()) {
      clickAt(document.querySelector('.mvs-node-image'));
      await wait(200);
      const stage = box() && document.querySelector('.mvs-lightbox-stage');
      if (stage) {
        stage.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, clientX: 100, clientY: 100 }));
        stage.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: 140, clientY: 130 }));
        stage.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, clientX: 140, clientY: 130 }));
        // style 绑定要到下一个 tick 才落到 DOM 上，这里必须等一帧再读
        await wait(80);
        const transform = document.querySelector('.mvs-lightbox-image').style.transform;
        stage.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
        await wait(200);
        backdropAfterDrag = { panned: transform.includes('translate(40px, 30px)'), stillOpen: !!box() };
      }
      document.querySelector('.mvs-lightbox-btn[title^="关闭"]')?.click();
      await wait(200);
    }

    HTMLAnchorElement.prototype.click = nativeClick;

    return {
      cursor, logBefore, opened, logAfterImage, scaleAfterOpen,
      scaleAfterIn, transformAfterIn, scaleAfterOut, scaleAfterDouble, scaleAfterReset,
      downloads, downloadLabel, closedByEsc, reopened, closedByBackdrop,
      cursorWhenDisabled, openedWhenDisabled, logWhenDisabled,
      openedAfterDrag: drag, backdropAfterDrag,
    };
  })()`);

  const asNumber = (text) => Number(String(text).replace("%", ""));
  check("点击图片打开查看器", viewer.opened === true && viewer.error === undefined,
    viewer.error ?? `打开前日志=「${viewer.logBefore}」`);
  check("点击图片走 image-click，不再触发 node-click",
    String(viewer.logAfterImage).startsWith("点击图片："),
    `日志=「${viewer.logAfterImage}」`);
  check("图片上是放大光标",
    viewer.cursor === "zoom-in",
    `cursor=${viewer.cursor}`);
  check("查看器「＋」放大、「－」缩小",
    asNumber(viewer.scaleAfterIn) > asNumber(viewer.scaleAfterOpen) &&
      asNumber(viewer.scaleAfterOut) === asNumber(viewer.scaleAfterOpen),
    `${viewer.scaleAfterOpen} → ${viewer.scaleAfterIn} → ${viewer.scaleAfterOut}`);
  check("缩放真的施加在图片上",
    String(viewer.transformAfterIn).includes("scale(1.25)"),
    `transform=${viewer.transformAfterIn}`);
  check("双击放大到 2 倍、1:1 复原",
    asNumber(viewer.scaleAfterDouble) === 200 && asNumber(viewer.scaleAfterReset) === 100,
    `${viewer.scaleAfterDouble} → ${viewer.scaleAfterReset}`);
  check("查看器「下载」取到原图并给出文件名",
    Array.isArray(viewer.downloads) && viewer.downloads.length === 1 &&
      viewer.downloads[0].name === "image.svg" && viewer.downloads[0].href === "blob:",
    viewer.downloads?.length
      ? `文件名=${viewer.downloads[0].name}，href=${viewer.downloads[0].href}…`
      : `没有触发下载（按钮文案=${viewer.downloadLabel}）`);
  check("Esc 与点击背景都能关闭查看器",
    viewer.closedByEsc === true && viewer.reopened === true && viewer.closedByBackdrop === true,
    `Esc 关闭=${viewer.closedByEsc}，可再次打开=${viewer.reopened}，点背景关闭=${viewer.closedByBackdrop}`);
  check("imageViewer: false 时不打开查看器，但事件照旧抛出",
    viewer.openedWhenDisabled === false &&
      viewer.cursorWhenDisabled !== "zoom-in" &&
      String(viewer.logWhenDisabled).startsWith("点击图片："),
    `打开=${viewer.openedWhenDisabled}，cursor=${viewer.cursorWhenDisabled}，日志=「${viewer.logWhenDisabled}」`);
  check("在图片上拖拽平移画布不会误开查看器",
    viewer.openedAfterDrag === false,
    `拖拽后打开=${viewer.openedAfterDrag}`);
  check("查看器内拖拽平移生效，且抬手不会误关灯箱",
    viewer.backdropAfterDrag?.panned === true && viewer.backdropAfterDrag?.stillOpen === true,
    viewer.backdropAfterDrag
      ? `位移生效=${viewer.backdropAfterDrag.panned}，仍打开=${viewer.backdropAfterDrag.stillOpen}`
      : "没有拿到拖拽结果");
  if (SHOT) await cdp.screenshot("04-image-viewer.png");

  // 切回编辑器 tab，后续用例继续在原来的实例上跑
  await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    [...document.querySelectorAll('.pg-tab')]
      .find((b) => b.textContent.trim() === '编辑器模式')?.click();
    for (let i = 0; i < 80; i += 1) {
      if (document.querySelectorAll('.mvs-node').length > 0) break;
      await wait(100);
    }
    await wait(900);
  })()`);

  // ---- 导出 ----
  const exported = await cdp.evaluate(`(async () => {
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const inst = root.__vueParentComponent?.exposed;
    if (!inst) return { error: '未拿到组件实例' };
    const svg = inst.exportSvg();
    const svgAsync = await inst.exportSvgAsync();
    const png = await inst.exportPng();
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const docAsync = new DOMParser().parseFromString(svgAsync, 'image/svg+xml');
    return {
      svgLength: svg.length,
      hasSvgTag: svg.includes('<svg'),
      hasForeignObject: svg.includes('foreignObject'),
      hasPath: svg.includes('<path'),
      hasStyle: svg.includes('<style'),
      hasViewBox: /viewBox="/.test(svg),
      parseError: doc.querySelector('parsererror') ? 'yes' : 'no',
      textElements: doc.querySelectorAll('text').length,
      tspanElements: doc.querySelectorAll('tspan').length,
      boldSpans: doc.querySelectorAll('tspan[font-weight="700"]').length,
      codeTexts: doc.querySelectorAll('text[font-family="monospace"]').length,
      imageElements: doc.querySelectorAll('image').length,
      asyncImageElements: docAsync.querySelectorAll('image').length,
      asyncImagesInlined: [...docAsync.querySelectorAll('image')]
        .every((el) => (el.getAttribute('href') || '').startsWith('data:')),
      linkIconsInExport: (svg.match(/↗|→/g) || []).length,
      pngType: png.type,
      pngSize: (await png.arrayBuffer()).byteLength,
    };
  })()`);

  check("exportSvg 返回完整 SVG", exported.svgLength > 2000 && exported.hasSvgTag === true,
    `len=${exported.svgLength}`);
  check("导出的 SVG 能被标准 XML 解析器解析", exported.parseError === "no", "");
  check("导出的 SVG 含手绘路径与样式", exported.hasPath === true && exported.hasStyle === true, "");
  check("导出用原生 <text>/<tspan> 替代 foreignObject（否则 PNG 会被污染）",
    exported.hasForeignObject === false && exported.textElements > 0,
    `text=${exported.textElements}, tspan=${exported.tspanElements}`);
  check("导出保留行内样式", exported.boldSpans > 0 && exported.codeTexts > 0,
    `bold=${exported.boldSpans}, code=${exported.codeTexts}`);
  check("exportPng 返回 PNG Blob",
    exported.pngType === "image/png" && exported.pngSize > 5000,
    `type=${exported.pngType}, size=${exported.pngSize}`);
  check("导出把 <img> 转成 SVG <image>",
    exported.imageElements > 0,
    `${exported.imageElements} 个 <image>`);
  check("exportSvgAsync 把图片内联成 data URL",
    exported.asyncImageElements > 0 && exported.asyncImagesInlined === true,
    `${exported.asyncImageElements} 个 <image>，全部为 data URL=${exported.asyncImagesInlined}`);
  check("导出保留了链接跳转图标",
    exported.linkIconsInExport > 0,
    `导出 SVG 里出现 ${exported.linkIconsInExport} 个跳转图标`);

  const pixels = await cdp.evaluate(`(async () => {
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const blob = await root.__vueParentComponent.exposed.exportPng();
    const bitmap = await createImageBitmap(blob);
    const c = document.createElement('canvas');
    c.width = bitmap.width; c.height = bitmap.height;
    const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.drawImage(bitmap, 0, 0);
    const { data } = ctx.getImageData(0, 0, c.width, c.height);
    const colors = new Set();
    let dark = 0;
    for (let i = 0; i < data.length; i += 4) {
      colors.add((data[i] << 16) | (data[i + 1] << 8) | data[i + 2]);
      if (data[i] < 120 && data[i + 1] < 120 && data[i + 2] < 120) dark += 1;
    }
    return { width: bitmap.width, height: bitmap.height, colors: colors.size, dark };
  })()`);
  check("PNG 中确有绘制内容（多色 + 文字像素）",
    pixels.colors > 50 && pixels.dark > 200,
    `${pixels.width}x${pixels.height}, ${pixels.colors} 色, ${pixels.dark} 深色像素`);

  // ---- 确定性：seed 固定则不抖动 ----
  const determinism = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const root = document.querySelector('.mve-preview .mvs-container') || document.querySelector('.mvs-container');
    const renderer = root.__vueParentComponent.exposed.getRenderer();
    const shapes = () => Object.fromEntries([...document.querySelectorAll('.mvs-node')]
      .map(n => [n.dataset.id, n.querySelector('.mvs-node-shape path')?.getAttribute('d')]));
    const before = shapes();
    renderer.setData(renderer.getTree(), { animate: false });
    await wait(400);
    const after = shapes();
    let same = 0, diff = 0;
    for (const id of Object.keys(before)) {
      if (!(id in after)) continue;
      if (before[id] === after[id]) same += 1; else diff += 1;
    }
    return { same, diff };
  })()`);
  check("seed 固定：重绘后手绘形状完全一致（不抖动）",
    determinism.same > 0 && determinism.diff === 0,
    `same=${determinism.same}, diff=${determinism.diff}`);

  // ---- hover 高亮 ----
  const highlight = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const nodes = [...document.querySelectorAll('.mvs-node')];
    nodes[nodes.length - 1].dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await wait(300);
    return {
      active: document.querySelectorAll('.mvs-active').length,
      dimmed: document.querySelectorAll('.mvs-has-highlight .mvs-node:not(.mvs-active)').length,
    };
  })()`);
  check("hover 点亮到根的路径并压暗其余节点", highlight.active > 0 && highlight.dimmed > 0,
    `active=${highlight.active}, dimmed=${highlight.dimmed}`);

  if (SHOT) await cdp.screenshot("02-highlight.png");

  // ---- 含链接的节点不触发压暗蒙版 ----
  const linkHover = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const linkNode = [...document.querySelectorAll('.mvs-node')].find(n => n.querySelector('a'));
    if (!linkNode) return { found: false };
    linkNode.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
    await wait(300);
    return {
      found: true,
      highlighted: document.querySelector('.mvs-has-highlight') !== null,
      dimmed: document.querySelectorAll('.mvs-has-highlight .mvs-node:not(.mvs-active)').length,
    };
  })()`);
  check("含链接的节点不触发压暗蒙版", linkHover.found && !linkHover.highlighted && linkHover.dimmed === 0,
    `found=${linkHover.found}, highlighted=${linkHover.highlighted}, dimmed=${linkHover.dimmed}`);

  // ---- 浏览器右键菜单被屏蔽 ----
  const contextMenu = await cdp.evaluate(`(() => {
    const container = document.querySelector('.mvs-container');
    if (!container) return { found: false };
    const event = new MouseEvent('contextmenu', { bubbles: true, cancelable: true });
    container.dispatchEvent(event);
    return { found: true, defaultPrevented: event.defaultPrevented };
  })()`);
  check("画布上的右键菜单被屏蔽", contextMenu.found && contextMenu.defaultPrevented === true,
    `found=${contextMenu.found}, defaultPrevented=${contextMenu.defaultPrevented}`);

  // ---- playground 纯预览 tab ----
  const preview = await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const tabButton = [...document.querySelectorAll('.pg-tab')]
      .find((b) => b.textContent.trim() === '纯预览');
    if (!tabButton) return { error: '找不到「纯预览」tab' };
    tabButton.click();
    for (let i = 0; i < 80; i += 1) {
      if (document.querySelectorAll('.mvs-node').length > 0) break;
      await wait(100);
    }
    await wait(900);
    return {
      nodes: document.querySelectorAll('.mvs-node').length,
      hasEditor: !!document.querySelector('.mve-root'),
      hasPanel: !!document.querySelector('.pg-panel'),
      hasToolbar: !!document.querySelector('.mve-toolbar'),
      fullBleed: !!document.querySelector('.pg-bare'),
    };
  })()`);
  check("纯预览 tab 能渲染出导图",
    preview.nodes > 0 && !preview.hasEditor && !preview.hasPanel && !preview.hasToolbar,
    preview.error ??
      `nodes=${preview.nodes}, 编辑器=${preview.hasEditor}, 参数面板=${preview.hasPanel}, 工具栏=${preview.hasToolbar}`);
  if (SHOT) await cdp.screenshot("03-preview.png");

  // ---- 移动端触摸手势 ----
  // 切到整屏导图的 tab，再做设备模拟，手势不受编辑器干扰
  await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    [...document.querySelectorAll('.pg-tab')]
      .find((b) => b.textContent.trim() === '纯预览')?.click();
    for (let i = 0; i < 80; i += 1) {
      if (document.querySelectorAll('.mvs-node').length > 0) break;
      await wait(100);
    }
    await wait(900);
  })()`);

  await cdp.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 2,
    mobile: true,
  });
  await cdp.send("Emulation.setTouchEmulationEnabled", {
    enabled: true,
    maxTouchPoints: 5,
  });
  // 重载页面，让触摸能力在挂载前就生效 —— 真机就是这个时序
  await cdp.send("Page.reload", { ignoreCache: false });
  await sleep(1200);
  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      await cdp.evaluate(`(async () => {
        const wait = (ms) => new Promise(r => setTimeout(r, ms));
        for (let i = 0; i < 150; i += 1) {
          if (document.querySelectorAll('.mvs-node').length > 0) break;
          await wait(100);
        }
        await wait(1200);
        [...document.querySelectorAll('.pg-tab')]
          .find((b) => b.textContent.trim() === '纯预览')?.click();
        await wait(900);
        return document.querySelectorAll('.mvs-node').length;
      })()`);
      break;
    } catch {
      await sleep(1500);
    }
  }
  await sleep(500);

  /**
   * 派发触摸事件。
   *
   * 用 `Input.dispatchTouchEvent` 但不 await 它的返回：设备模拟 + 重载之后
   * 这个命令会卡住不响应（实测整个测试挂死在这里），但事件本身已经派发出去了。
   * 页面内自造 TouchEvent 试过，d3-zoom 的 gesture 不认，所以还是得走 CDP。
   */
  const dispatch = async (type, points) => {
    cdp
      .send(
        "Input.dispatchTouchEvent",
        {
          type,
          touchPoints: points.map(([x, y], index) => ({
            x,
            y,
            id: index + 1,
            radiusX: 10,
            radiusY: 10,
            force: 1,
          })),
        },
        3000,
      )
      .catch((error) => {
        touchErrors.push(`${type}: ${error.message}`);
      });
    await sleep(80);
  };
  const touchErrors = [];

  const readScene = `(() => {
    const layer = document.querySelector('.mvs-zoom');
    const m = /translate\\(([-\\d.]+),([-\\d.]+)\\) scale\\(([\\d.]+)\\)/.exec(layer.getAttribute('transform') || '');
    const svg = document.querySelector('.mvs-svg').getBoundingClientRect();
    return {
      x: m ? Number(m[1]) : 0,
      y: m ? Number(m[2]) : 0,
      k: m ? Number(m[3]) : 1,
      scrollY: window.scrollY,
      svgTop: Math.round(svg.top),
      svgWidth: Math.round(svg.width),
    };
  })()`;

  const mobileVisible = await cdp.evaluate(`(() => {
    const nodes = [...document.querySelectorAll('.mvs-node')];
    const svg = document.querySelector('.mvs-svg').getBoundingClientRect();
    const inside = nodes.filter((n) => {
      const r = n.getBoundingClientRect();
      return r.right > svg.left && r.left < svg.right && r.bottom > svg.top && r.top < svg.bottom;
    });
    return { total: nodes.length, inside: inside.length };
  })()`);
  check(
    "手机视口首屏导图落在可视区域内",
    mobileVisible.inside > 0,
    `${mobileVisible.inside}/${mobileVisible.total} 个节点在视口内`,
  );
  if (SHOT) await cdp.screenshot("04-mobile.png");

  const before = await cdp.evaluate(readScene);
  await cdp.evaluate(`(() => {
    window.__touchLog = [];
    const svg = document.querySelector('.mvs-svg');
    ['touchstart', 'touchmove', 'touchend'].forEach((type) =>
      svg.addEventListener(type, (e) => window.__touchLog.push(type + ':' + e.touches.length), true));
    return true;
  })()`);
  const touchEnv = await cdp.evaluate(`({
    maxTouchPoints: navigator.maxTouchPoints,
    hasTouchStart: 'ontouchstart' in window,
    svgRect: (() => {
      const r = document.querySelector('.mvs-svg').getBoundingClientRect();
      return [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)];
    })(),
  })`);
  const cx = Math.round(195);
  const cy = Math.round(420);

  // 单指拖拽平移
  await dispatch("touchStart", [[cx, cy]]);
  await dispatch("touchMove", [[cx + 30, cy + 20]]);
  await dispatch("touchMove", [[cx + 60, cy + 40]]);
  await dispatch("touchMove", [[cx + 90, cy + 60]]);
  await dispatch("touchEnd", []);
  await sleep(500);
  const afterPan = await cdp.evaluate(readScene);

  // 先确认触摸事件确实到达了 DOM。headless Chrome 在部分环境下
  // 会「接受 Input.dispatchTouchEvent 但不把事件派发到页面」，
  // 这种情况下后面的断言全部无意义，直接跳过
  touchDelivered = (await cdp.evaluate("window.__touchLog.length")) > 0;

  touchCheck(
    "单指拖拽能平移画布",
    Math.abs(afterPan.x - before.x) > 20 &&
      Math.abs(afterPan.y - before.y) > 10 &&
      Math.abs(afterPan.k - before.k) < 0.01,
    `translate (${before.x},${before.y}) → (${afterPan.x},${afterPan.y})，缩放不变 k=${afterPan.k}；` +
      `touch=${JSON.stringify(touchEnv)}；` +
      `事件日志=${JSON.stringify(await cdp.evaluate("window.__touchLog"))}；` +
      `错误=${touchErrors.slice(0, 2).join(" | ") || "无"}`,
  );
  touchCheck(
    "平移手势不会带动页面滚动",
    afterPan.scrollY === before.scrollY && afterPan.svgTop === before.svgTop,
    `scrollY ${before.scrollY} → ${afterPan.scrollY}，svg.top ${before.svgTop} → ${afterPan.svgTop}`,
  );

  // 双指张开放大
  await dispatch("touchStart", [
    [cx - 30, cy],
    [cx + 30, cy],
  ]);
  await dispatch("touchMove", [
    [cx - 60, cy],
    [cx + 60, cy],
  ]);
  await dispatch("touchMove", [
    [cx - 90, cy],
    [cx + 90, cy],
  ]);
  await dispatch("touchEnd", []);
  await sleep(500);
  const afterPinch = await cdp.evaluate(readScene);

  touchCheck(
    "双指张开能放大",
    afterPinch.k > afterPan.k * 1.3,
    `k ${afterPan.k} → ${afterPinch.k}`,
  );
  touchCheck(
    "缩放手势不会带动页面滚动",
    afterPinch.scrollY === before.scrollY,
    `scrollY ${afterPan.scrollY} → ${afterPinch.scrollY}`,
  );

  // 双指捏合缩小
  await dispatch("touchStart", [
    [cx - 90, cy],
    [cx + 90, cy],
  ]);
  await dispatch("touchMove", [
    [cx - 45, cy],
    [cx + 45, cy],
  ]);
  await dispatch("touchMove", [
    [cx - 20, cy],
    [cx + 20, cy],
  ]);
  await dispatch("touchEnd", []);
  await sleep(500);
  const afterPinchIn = await cdp.evaluate(readScene);
  touchCheck("双指捏合能缩小", afterPinchIn.k < afterPinch.k, `k ${afterPinch.k} → ${afterPinchIn.k}`);

  // 轻触折叠标识。
  // 先把视图复位到合适比例并等动画收敛，再取坐标 —— 折叠动画期间读到的
  // 位置是旧的，轻触会打到空处
  await cdp.evaluate(`(async () => {
    const wait = (ms) => new Promise(r => setTimeout(r, ms));
    const inst = document.querySelector('.mvs-container').__vueParentComponent.exposed;
    inst.expandAll();
    await wait(900);
    inst.fit();
    await wait(1200);
  })()`);

  const tapTarget = await cdp.evaluate(`(() => {
    const node = [...document.querySelectorAll('.mvs-node')]
      .find((n) => n.dataset.id !== 'root'
        && n.querySelector('.mvs-node-toggle')?.style.display !== 'none');
    if (!node) return null;
    const r = node.querySelector('.mvs-node-toggle').getBoundingClientRect();
    return {
      id: node.dataset.id,
      x: Math.round(r.x + r.width / 2),
      y: Math.round(r.y + r.height / 2),
      size: Math.round(Math.max(r.width, r.height)),
    };
  })()`);

  if (tapTarget) {
    const foldedBefore = await cdp.evaluate(
      `document.querySelector('.mvs-node[data-id="${tapTarget.id}"] .mvs-node-toggle-label')?.textContent ?? null`,
    );
    await dispatch("touchStart", [[tapTarget.x, tapTarget.y]]);
    await sleep(60);
    await dispatch("touchEnd", []);
    await sleep(1000);
    const foldedAfter = await cdp.evaluate(`(() => {
      const el = document.querySelector('.mvs-node[data-id="${tapTarget.id}"] .mvs-node-toggle-label');
      return el && el.style.display !== 'none' ? el.textContent : null;
    })()`);
    touchCheck(
      "轻触折叠标识能折叠节点",
      foldedAfter !== null && foldedAfter !== foldedBefore,
      `点击前=${JSON.stringify(foldedBefore)}，点击后=${JSON.stringify(foldedAfter)}，` +
        `目标点 (${tapTarget.x},${tapTarget.y})，标识尺寸 ${tapTarget.size}px`,
    );
  } else {
    touchCheck("轻触折叠标识能折叠节点", false, "没找到可折叠的节点");
  }

  // 还原模拟设置，避免影响后续状态
  await cdp.send("Emulation.clearDeviceMetricsOverride");
  await cdp.send("Emulation.setTouchEmulationEnabled", { enabled: false });
  await sleep(800);

  const errors = cdp.events
    .filter((e) => e.method === "Runtime.exceptionThrown")
    .map((e) => e.params.exceptionDetails?.exception?.description ?? "unknown");
  check("运行期间无未捕获异常", errors.length === 0, errors.slice(0, 3).join(" | "));

  const failed = results.filter((r) => !r.ok).length;
  console.log(
    `\n=== ${results.length - failed}/${results.length} 通过` +
      (skips.length ? `，${skips.length} 项跳过 ===` : " ==="),
  );
  for (const item of skips) {
    console.log(`  SKIP ${item.name} —— ${item.reason}`);
  }
  if (SHOT) console.log(`截图目录：${OUT_DIR}`);

  chrome.kill();
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((error) => {
  console.error("E2E 失败：", error);
  chrome.kill();
  process.exit(1);
});
