<!-- src/components/Header.vue -->
<template>
  <header class="site-header">
    <div class="header-inner">
      <!--
        品牌区：只保留图标，回到首页。
        ⚠️ 纯图标链接必须给 aria-label，否则读屏软件读不出可访问名称。
      -->
      <router-link to="/timeline" class="brand" aria-label="返回首页">
        <!--
          品牌图标与浏览器 favicon 是**同一个文件**，改一处两边同时生效。
          alt 留空 + aria-hidden：链接本身已有 aria-label，图标纯装饰。
          外面套一层手绘纸片：logo 线条很细，直接贴在页面上会显得单薄。
        -->
        <span class="brand-badge" aria-hidden="true">
          <img class="brand-mark" src="/favicon.svg" alt="" />
        </span>
      </router-link>

      <!-- 主导航：当前项加深加粗，并在文字下方带一条主色下划线 -->
      <nav class="site-nav" aria-label="主导航">
        <router-link v-for="item in navItems" :key="item.to" :to="item.to" class="nav-item" :class="{ 'is-active': item.section === activeSection }">
          {{ item.label }}
        </router-link>
      </nav>

      <div class="header-actions">
        <!-- 已登录：头像 + 下拉菜单 -->
        <el-dropdown v-if="authStore.isAuthenticated" trigger="click">
          <button type="button" class="user-trigger" aria-label="账号菜单">
            <el-avatar :size="30" :src="avatarUrl" class="user-avatar">{{ authStore.initial }}</el-avatar>
            <span class="user-name">{{ authStore.displayName }}</span>
          </button>
          <template #dropdown>
            <el-dropdown-menu>
              <el-dropdown-item disabled>{{ authStore.user?.phone || authStore.user?.username }}</el-dropdown-item>
              <el-dropdown-item divided @click="goAccount">个人中心</el-dropdown-item>
              <el-dropdown-item @click="handleLogout">退出登录</el-dropdown-item>
            </el-dropdown-menu>
          </template>
        </el-dropdown>

        <!-- 未登录：登录 / 注册入口放在页头右侧（参考图红框位置） -->
        <template v-else>
          <router-link class="auth-login" :to="loginRoute">登录</router-link>
          <router-link class="auth-register" :to="registerRoute">注册</router-link>
        </template>

        <!-- 移动端汉堡按钮 -->
        <button
          type="button"
          class="menu-toggle"
          :aria-expanded="drawerOpen"
          aria-controls="site-mobile-drawer"
          aria-label="打开菜单"
          @click="drawerOpen = true"
        >
          <span class="menu-toggle__bar"></span>
          <span class="menu-toggle__bar"></span>
          <span class="menu-toggle__bar"></span>
        </button>
      </div>
    </div>

    <!-- 移动端抽屉：Teleport 到 body，避免被 header 的层叠上下文裁切 -->
    <Teleport to="body">
      <Transition name="drawer-fade">
        <div v-if="drawerOpen" class="drawer-mask" @click.self="closeDrawer">
          <aside id="site-mobile-drawer" class="mobile-drawer" role="dialog" aria-modal="true" aria-label="站点菜单">
            <div class="drawer-header">
              <span class="drawer-title">探索站点</span>
              <button type="button" class="drawer-close" aria-label="关闭菜单" @click="closeDrawer">×</button>
            </div>

            <nav class="drawer-nav">
              <router-link
                v-for="item in navItems"
                :key="item.to"
                :to="item.to"
                class="drawer-nav__item"
                :class="{ 'is-active': item.section === activeSection }"
                @click="closeDrawer"
              >
                <span class="drawer-nav__mark" aria-hidden="true"></span>
                {{ item.label }}
              </router-link>
            </nav>

            <div class="drawer-auth">
              <template v-if="authStore.isAuthenticated">
                <div class="drawer-user">
                  <el-avatar :size="38" :src="avatarUrl">{{ authStore.initial }}</el-avatar>
                  <div class="drawer-user__meta">
                    <strong>{{ authStore.displayName }}</strong>
                    <small>{{ authStore.user?.role_name }} · {{ authStore.user?.phone || authStore.user?.username }}</small>
                  </div>
                </div>
                <router-link class="drawer-auth__button is-primary" :to="{ name: 'Account' }" @click="closeDrawer">个人中心</router-link>
                <button type="button" class="drawer-auth__button" @click="handleLogout">退出登录</button>
              </template>

              <template v-else>
                <router-link class="drawer-auth__button is-primary" :to="loginRoute" @click="closeDrawer">登录</router-link>
                <router-link class="drawer-auth__button" :to="registerRoute" @click="closeDrawer">注册</router-link>
              </template>
            </div>
          </aside>
        </div>
      </Transition>
    </Teleport>
  </header>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { ElMessage, ElMessageBox } from "element-plus";
import { useAuth } from "@/composables/useAuth";
import { resolveAssetUrl } from "@/services/apiConfig";

const route = useRoute();
const router = useRouter();
const { authStore, logout, loadUser } = useAuth();

/** 移动端抽屉开关 */
const drawerOpen = ref(false);

/**
 * 导航项 = 带 `meta.section.navOrder` 的路由
 *
 * ✅ 决策：从路由表派生，菜单和面包屑共用同一份 `meta.section`，
 * 不用在两处各维护一份「路径 → 文案」的映射。新增导航项只需在路由 meta 里
 * 补一个 `navOrder`，详情页不带 navOrder 所以不会混进导航。
 *
 * ⚠️ 必须按 navOrder 排序：`router.getRoutes()` 的返回顺序由路由匹配器决定，
 * 与路由表里的声明顺序无关（实测动态参数路由会排在静态路由前面）。
 */
const navItems = computed(() =>
  router
    .getRoutes()
    .filter((record) => record.meta.section?.navOrder !== undefined && record.meta.section.to)
    .sort((a, b) => (a.meta.section?.navOrder ?? 0) - (b.meta.section?.navOrder ?? 0))
    .map((record) => ({
      to: record.meta.section?.to ?? record.path,
      label: record.meta.section?.zh ?? "",
      section: record.meta.section?.en ?? "",
    })),
);

/**
 * 当前路由所属分区
 *
 * ⚠️ 这里刻意**不用** router-link 自带的 `.router-link-active`：
 * vue-router 的判定是「链接目标的路由记录是否出现在当前 matched 里」
 * （见其 activeRecordIndex 实现）。`/notes` 与 `/notes/:id` 是兄弟记录而不是父子，
 * 所以在详情页里 `/notes` 的链接**不会被判定为 active**。
 *
 * 改为按 `meta.section.en` 判定后，详情页共享所属分区的 section，
 * 因此在 `/notes/1` 时「攻略笔记」依然高亮。
 */
const activeSection = computed(() => route.meta.section?.en);

/** 头像地址：相对路径需要拼接口 origin */
const avatarUrl = computed(() => (authStore.user?.avatar ? resolveAssetUrl(authStore.user.avatar) : undefined));

/** 登录 / 注册入口带上当前路径，登录成功后回到这里 */
const loginRoute = computed(() => ({ name: "Login", query: { redirect: route.fullPath } }));
const registerRoute = computed(() => ({ name: "Register", query: { redirect: route.fullPath } }));

const closeDrawer = (): void => {
  drawerOpen.value = false;
};

const goAccount = (): void => {
  void router.push({ name: "Account" });
};

const handleLogout = async (): Promise<void> => {
  try {
    await ElMessageBox.confirm("确定要退出登录吗？", "提示", {
      confirmButtonText: "退出",
      cancelButtonText: "取消",
      type: "warning",
    });
  } catch {
    return;
  }

  closeDrawer();
  await logout();
  ElMessage.success("已退出登录");
};

/** 抽屉打开时锁住页面滚动，并支持 Esc 关闭 */
const handleKeydown = (event: KeyboardEvent): void => {
  if (event.key === "Escape") {
    closeDrawer();
  }
};

/** 窗口拉宽到桌面尺寸时收起抽屉，避免遮罩残留 */
const handleResize = (): void => {
  if (window.innerWidth > 768) {
    closeDrawer();
  }
};

watch(drawerOpen, (open) => {
  document.body.style.overflow = open ? "hidden" : "";
  if (open) {
    window.addEventListener("keydown", handleKeydown);
  } else {
    window.removeEventListener("keydown", handleKeydown);
  }
});

onMounted(() => {
  window.addEventListener("resize", handleResize);
  // 角色 / 权限可能在后台调整过，进入页面时补拉一次用户信息
  void loadUser();
});

onBeforeUnmount(() => {
  document.body.style.overflow = "";
  window.removeEventListener("keydown", handleKeydown);
  window.removeEventListener("resize", handleResize);
});
</script>

<style scoped>
.site-header {
  /*
   * 用主题令牌而非写死 #fff：style.css 里有 prefers-color-scheme 深色分支，
   * 写死白色会让深色模式下头部糊成一块白板
   */
  position: relative;
  background: var(--surface);

  /*
   * ⚠️ 高度必须落在 .site-header 上并配合 border-box：
   * Layout 的内容区高度是 calc(100vh - var(--header-height))，
   * 头的实际高度一旦比令牌多 1px，页面总高就会变成 100vh + 1px，触发整页纵向滚动条。
   * 因此底边改用绝对定位的 ::after 画（不占高度），而不是 border-bottom。
   */
  height: var(--header-height);
  box-sizing: border-box;
}

/* 手绘波浪底边：用 mask 画一条抖动的线，颜色跟随 --border，深浅色自动适配 */
.site-header::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  height: 6px;
  background-color: var(--border);
  -webkit-mask: var(--squiggle) repeat-x;
  mask: var(--squiggle) repeat-x;
  -webkit-mask-size: 48px 6px;
  mask-size: 48px 6px;
}

.header-inner {
  display: flex;
  align-items: center;
  gap: 40px;
  max-width: var(--content-max-width);
  /* 跟随父级，父级已把 1px 边框算进 --header-height */
  height: 100%;
  margin: 0 auto;
  padding: 0 24px;
  /* ⚠️ 必须显式声明：全局没有 box-sizing 重置，默认 content-box 会让
     实际宽度变成 max-width + 左右各 24px，与下方内容区错位 */
  box-sizing: border-box;
}

/* ===== 品牌区（纯图标）===== */
.brand {
  display: flex;
  align-items: center;
  flex-shrink: 0;
  text-decoration: none;
}

/* 手绘纸片底座：给细线条的 logo 一个轮廓，同时呼应页面的纸张语言 */
.brand-badge {
  display: grid;
  place-items: center;
  width: 50px;
  height: 50px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: 14px 6px 16px 8px / 8px 16px 6px 14px;
  background: var(--surface);
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  transform: rotate(-2deg);
  transition: transform 0.25s;
}

.brand:hover .brand-badge {
  transform: rotate(-2deg) scale(1.05);
}

/* 图标本身复用 favicon.svg（柑橘生命周期环） */
.brand-mark {
  display: block;
  width: 46px;
  height: 46px;
}

/* ===== 主导航 ===== */
.site-nav {
  display: flex;
  align-items: center;
  gap: 28px;
  /* 把导航推到右侧，替代原来挂在 el-menu-item 上的 margin-right: auto */
  margin-left: auto;
}

.nav-item {
  position: relative;
  display: inline-flex;
  align-items: center;
  padding: 8px 0;
  color: var(--text);
  font-size: 15px;
  text-decoration: none;
  transition: color 0.2s;
}

.nav-item:hover {
  color: var(--text-h);
}

/* 选中态由 meta.section 判定，不依赖 router-link-active，原因见 script 中的说明 */
.nav-item.is-active {
  color: var(--text-h);
  font-weight: 600;
}

/* 选中下划线贴着文字留 8px 间距（= padding 的下边界），而不是贴头部底边 */
.nav-item.is-active::after {
  content: "";
  position: absolute;
  left: 0;
  right: 0;
  bottom: -1px;
  height: 5px;
  background-color: var(--brand-accent);
  /* 手绘波浪线：与标题下划线同一套笔触 */
  -webkit-mask: var(--squiggle) repeat-x;
  mask: var(--squiggle) repeat-x;
  -webkit-mask-size: 36px 5px;
  mask-size: 36px 5px;
}

/* ===== 右侧操作区 ===== */
.header-actions {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-shrink: 0;
}

.auth-login {
  color: var(--text);
  font-size: 15px;
  text-decoration: none;
  transition: color 0.2s;
}

.auth-login:hover {
  color: var(--text-h);
}

/* 注册按钮：手绘纸片，与站内卡片同一套描边与错位投影 */
.auth-register {
  padding: 7px 16px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--accent-bg);
  color: var(--ink);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  transition:
    transform 0.2s,
    box-shadow 0.2s;
}

.auth-register:hover {
  transform: translate(-1px, -1px);
  box-shadow: 3px 3px 0 var(--sketch-shadow);
}

.user-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text-h);
  font: inherit;
  cursor: pointer;
}

.user-avatar {
  border: var(--sketch-line) solid var(--ink);
  background: var(--accent-bg);
  color: var(--ink);
  font-weight: 600;
}

.user-name {
  max-width: 120px;
  overflow: hidden;
  font-size: 14px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* 汉堡按钮：桌面隐藏，移动端显示 */
.menu-toggle {
  display: none;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  width: 36px;
  height: 36px;
  padding: 0 7px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  cursor: pointer;
}

.menu-toggle__bar {
  display: block;
  width: 100%;
  height: 2px;
  border-radius: 2px;
  background: var(--ink);
}

/* ===== 移动端抽屉 ===== */
.drawer-mask {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  justify-content: flex-end;
  background: rgb(47 53 66 / 38%);
  backdrop-filter: blur(2px);
}

.mobile-drawer {
  display: flex;
  flex-direction: column;
  width: min(320px, 86vw);
  height: 100%;
  padding: 22px 20px;
  box-sizing: border-box;
  border-left: var(--sketch-line) solid var(--ink);
  background: var(--surface);
  box-shadow: -8px 0 30px rgb(47 53 66 / 18%);
}

.drawer-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 22px;
}

.drawer-title {
  color: var(--text-h);
  font-size: 18px;
  font-weight: 700;
}

.drawer-close {
  width: 32px;
  height: 32px;
  padding: 0;
  border: none;
  background: transparent;
  color: var(--text);
  font-size: 24px;
  line-height: 1;
  cursor: pointer;
}

.drawer-nav {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.drawer-nav__item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 13px 10px;
  border-radius: var(--sketch-radius-sm);
  color: var(--text);
  font-size: 16px;
  text-decoration: none;
}

.drawer-nav__item:hover {
  background: var(--accent-bg);
}

.drawer-nav__item.is-active {
  color: var(--text-h);
  font-weight: 600;
}

.drawer-nav__mark {
  width: 7px;
  height: 7px;
  flex-shrink: 0;
  background: var(--border);
  transform: rotate(-4deg);
}

.drawer-nav__item.is-active .drawer-nav__mark {
  background: var(--orange);
}

.drawer-auth {
  display: flex;
  flex-direction: column;
  gap: 10px;
  margin-top: auto;
  padding-top: 20px;
  border-top: 1.5px dashed var(--border);
}

.drawer-user {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 6px;
}

.drawer-user__meta {
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.drawer-user__meta strong {
  color: var(--text-h);
  font-size: 14px;
}

.drawer-user__meta small {
  overflow: hidden;
  color: var(--text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.drawer-auth__button {
  display: block;
  padding: 11px 14px;
  border: var(--sketch-line) solid var(--ink);
  border-radius: var(--sketch-radius-sm);
  background: var(--surface);
  color: var(--text-h);
  font: inherit;
  font-size: 15px;
  text-align: center;
  text-decoration: none;
  box-shadow: 2px 2px 0 var(--sketch-shadow);
  cursor: pointer;
}

.drawer-auth__button.is-primary {
  background: var(--accent-bg);
  font-weight: 600;
}

/* 抽屉过渡 */
.drawer-fade-enter-active,
.drawer-fade-leave-active {
  transition: opacity 0.22s ease;
}

.drawer-fade-enter-active .mobile-drawer,
.drawer-fade-leave-active .mobile-drawer {
  transition: transform 0.22s ease;
}

.drawer-fade-enter-from,
.drawer-fade-leave-to {
  opacity: 0;
}

.drawer-fade-enter-from .mobile-drawer,
.drawer-fade-leave-to .mobile-drawer {
  transform: translateX(100%);
}

@media (max-width: 768px) {
  .header-inner {
    gap: 16px;
    padding: 0 16px;
  }

  .site-nav {
    display: none;
  }

  .header-actions {
    margin-left: auto;
  }

  /* 未登录时移动端只留汉堡入口，登录 / 注册收进抽屉 */
  .auth-login,
  .auth-register {
    display: none;
  }

  .user-name {
    display: none;
  }

  .menu-toggle {
    display: flex;
  }
}
</style>
