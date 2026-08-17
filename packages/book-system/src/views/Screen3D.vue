<template>
  <div class="screen3d" :class="'scene-' + activeScene">
    <BookScene3D
      :stats="stats"
      :selected-id="selectedId"
      @select="onSelect"
      @effect="onEffect"
      @ready="sceneReady = true"
    />

    <header class="s3-header">
      <div class="header-left">
        <button type="button" class="back-btn" @click="$router.push('/dashboard')">← 图表大屏</button>
        <div>
          <h1>3D 图书推荐场景</h1>
          <p>{{ currentTime }}</p>
        </div>
      </div>
      <div class="header-center">
        <button
          v-for="m in scenes"
          :key="m.id"
          type="button"
          :class="{ active: activeScene === m.id }"
          @click="activeScene = m.id"
        >
          {{ m.name }}
        </button>
      </div>
      <div class="header-right">
        <span>{{ userStore.user?.username }}</span>
        <button type="button" class="logout-btn" @click="logout">退出</button>
      </div>
    </header>

    <div class="kpi-row">
      <div class="kpi" v-for="k in sceneKpis" :key="k.label">
        <strong>{{ k.value }}</strong>
        <span>{{ k.label }}</span>
      </div>
    </div>

    <aside class="side-panel left-panel">
      <div class="scene-badge">{{ currentSceneMeta.name }}</div>
      <h3>{{ currentSceneMeta.title }}</h3>
      <p>{{ currentSceneMeta.desc }}</p>
      <ul>
        <li v-for="tip in currentSceneMeta.tips" :key="tip">{{ tip }}</li>
      </ul>
      <div class="legend" v-if="leftLegend.length">
        <div class="legend-title">{{ currentSceneMeta.legendTitle }}</div>
        <div v-for="c in leftLegend" :key="c.name" class="legend-item">
          <i :style="{ background: c.color }"></i>
          <span>{{ c.name }}</span>
          <b>{{ c.value }}</b>
        </div>
      </div>
    </aside>

    <aside class="side-panel right-panel" :class="{ open: !!selected }">
      <template v-if="selected">
        <div class="panel-head">
          <h3>{{ selected.title }}</h3>
          <button type="button" @click="clearSelect">×</button>
        </div>
        <div class="tag-row">
          <span class="type-tag">{{ selected.type }}</span>
          <span class="effect-tag" v-if="lastEffect">{{ effectLabel(lastEffect.effect) }}</span>
        </div>
        <p class="insight" v-if="selected.insight">{{ selected.insight }}</p>
        <div class="data-rows">
          <div class="row" v-for="(v, k) in selected.data" :key="k">
            <span>{{ k }}</span>
            <strong>{{ v }}</strong>
          </div>
        </div>
        <div class="extra" v-if="selected.extra?.length">
          <h4>{{ extraTitle }}</h4>
          <div class="extra-item" v-for="(e, i) in selected.extra" :key="i">
            <span>{{ e.title }}</span>
            <em>{{ e.score }}</em>
          </div>
        </div>
        <div class="actions">
          <button type="button" @click="focusRelated">{{ currentSceneMeta.actionText }}</button>
          <button type="button" class="ghost" @click="clearSelect">关闭</button>
        </div>
      </template>
      <template v-else>
        <h3>交互提示</h3>
        <p>{{ currentSceneMeta.idleTip }}</p>
        <div class="fx-guide">
          <div v-for="g in currentSceneMeta.clickGuide" :key="g">· {{ g }}</div>
        </div>
        <p class="muted">拖拽旋转 · 滚轮缩放 · 点击产生专属动效</p>
      </template>
    </aside>

    <div class="effect-toast" v-if="effectToast">{{ effectToast }}</div>

    <footer class="s3-footer">
      <BookScene3DSwitcher v-model="activeScene" :scenes="scenes" />
      <span class="hint">四套主题场景 · 差异化数据与点击特效</span>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, provide, watch } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { useUserStore } from '@/stores'
import BookScene3D from '@/components/BookScene3D.vue'
import BookScene3DSwitcher from '@/components/BookScene3DSwitcher.vue'

const router = useRouter()
const userStore = useUserStore()

const stats = ref({
  totalBooks: 0,
  totalUsers: 0,
  totalRatings: 0,
  avgRating: 0,
  categories: [],
  topBooks: [],
  modelStats: [],
  categoryRatings: []
})

const scenes = [
  {
    id: 'bookshelf',
    name: '智慧书架',
    title: '智慧书架 · 馆藏陈列',
    desc: '暖色木质书架，精装书脊可点选。每层绑定真实分类数据，铭牌与书册展示不同指标。',
    tips: ['点击金色铭牌 → 分类层统计', '点击书册 → 单书推荐详情', '点击底座 → 全局馆藏概览'],
    legendTitle: '分类藏书',
    actionText: '同层同类',
    idleTip: '请点击书架上的书册、分类铭牌或底座，触发「书架点亮」并展示对应数据。',
    clickGuide: ['书册：评分 / 推荐分 / 层架位置', '铭牌：分类藏书与借阅热度', '底座：总量与场景主题']
  },
  {
    id: 'bookstack',
    name: '知识之塔',
    title: '知识之塔 · 表征深化',
    desc: '螺旋层叠书塔与琥珀光环，塔高映射藏书规模，塔芯汇聚多模型能量。',
    tips: ['点击塔层书册 → 层级知识密度', '点击塔层 → 对应模型名', '点击塔芯晶体 → 模型贡献榜'],
    legendTitle: '模型贡献',
    actionText: '查看塔芯',
    idleTip: '点击塔层或金色塔芯，触发「塔芯共鸣」，右侧展示层级与模型数据。',
    clickGuide: ['塔层：层级 / 知识密度 / 模型', '塔芯：全局指标与模型得分', '光环随时间脉动']
  },
  {
    id: 'galaxy',
    name: '推荐星图',
    title: '推荐星图 · 引力排序',
    desc: '冷色宇宙风，Top 图书化为带大气层的星球，轨道与连线指向引擎核心。',
    tips: ['星球大小 ≈ 推荐分', '点击星球 → 书目与轨道信息', '点击冰晶核心 → 模型引擎状态'],
    legendTitle: 'Top 推荐',
    actionText: '同轨图书',
    idleTip: '点击星球或核心，触发「星轨聚焦」，相机缓动靠近并展示星图数据。',
    clickGuide: ['星球：作者 / 分类 / 星等', '核心：模型组合与轨道层', '粒子星尘环绕']
  },
  {
    id: 'network',
    name: '兴趣网络',
    title: '兴趣网络 · 跨类关联',
    desc: '青绿兴趣簇带光环互联，节点大小表示该类图书量，中枢解释多样性跳转。',
    tips: ['点击兴趣节点 → 簇指标', '点击中枢 → 网络全局', '连线表示跨类关联'],
    legendTitle: '兴趣簇',
    actionText: '关联簇',
    idleTip: '点击节点或中枢多面体，触发「兴趣共振」，展示跨类兴趣数据。',
    clickGuide: ['节点：均分 / 推荐分 / 连接潜力', '中枢：节点数与关联边', '光环呼吸动画']
  }
]

const activeScene = ref('bookshelf')
const selected = ref(null)
const selectedId = ref(null)
const sceneReady = ref(false)
const currentTime = ref('')
const lastEffect = ref(null)
const effectToast = ref('')
let timer = null
let toastTimer = null

provide('activeScene', activeScene)

const currentSceneMeta = computed(() => scenes.find((s) => s.id === activeScene.value) || scenes[0])

const palette = ['#c9a227', '#4fc3f7', '#48c9b0', '#e8d48b', '#af7ac5', '#5dade2']
function catColor(name) {
  let h = 0
  for (let i = 0; i < String(name).length; i++) h += name.charCodeAt(i)
  return palette[h % palette.length]
}

const sceneKpis = computed(() => {
  const s = stats.value
  if (activeScene.value === 'bookshelf') {
    return [
      { label: '图书总量', value: s.totalBooks },
      { label: '分类层', value: Math.min(s.categories?.length || 0, 4) },
      { label: '平均评分', value: s.avgRating },
      { label: '架上可点', value: (s.categories || []).slice(0, 4).reduce((a, c) => a + Math.min(c.count || 0, 9), 0) }
    ]
  }
  if (activeScene.value === 'bookstack') {
    return [
      { label: '塔层估算', value: Math.min(Math.max(Math.ceil((s.totalBooks || 50) / 5), 8), 14) },
      { label: '模型数', value: s.modelStats?.length || 0 },
      { label: '评分记录', value: s.totalRatings },
      { label: '平均评分', value: s.avgRating }
    ]
  }
  if (activeScene.value === 'galaxy') {
    return [
      { label: '星体数', value: s.topBooks?.length || 0 },
      { label: '轨道层', value: 3 },
      { label: '最高推荐分', value: s.topBooks?.[0]?.recommend_score ?? '-' },
      { label: '用户数', value: s.totalUsers }
    ]
  }
  return [
    { label: '兴趣簇', value: s.categoryRatings?.length || s.categories?.length || 0 },
    { label: '用户数', value: s.totalUsers },
    { label: '分类数', value: s.categories?.length || 0 },
    { label: '平均评分', value: s.avgRating }
  ]
})

const leftLegend = computed(() => {
  if (activeScene.value === 'bookstack') {
    return (stats.value.modelStats || []).slice(0, 6).map((m, i) => ({
      name: m.model_type,
      value: Number(m.avg_score || 0).toFixed(3),
      color: palette[i % palette.length]
    }))
  }
  if (activeScene.value === 'galaxy') {
    return (stats.value.topBooks || []).slice(0, 6).map((b, i) => ({
      name: b.title,
      value: b.recommend_score,
      color: palette[i % palette.length]
    }))
  }
  if (activeScene.value === 'network') {
    const list = stats.value.categoryRatings?.length
      ? stats.value.categoryRatings
      : stats.value.categories || []
    return list.slice(0, 6).map((c, i) => ({
      name: c.name || c.category,
      value: c.count ?? Number(c.avg_score || 0).toFixed(1),
      color: palette[i % palette.length]
    }))
  }
  return (stats.value.categories || []).slice(0, 6).map((c) => ({
    name: c.name,
    value: c.count,
    color: catColor(c.name)
  }))
})

const extraTitle = computed(() => {
  const map = {
    bookshelf: '同层关联推荐',
    bookstack: '模型得分',
    galaxy: '同轨推荐',
    network: '簇内图书'
  }
  return map[activeScene.value] || '关联推荐'
})

function effectLabel(effect) {
  return {
    'shelf-glow': '书架点亮',
    'book-pull': '书册抽出',
    'tower-pulse': '塔芯共鸣',
    'galaxy-focus': '星轨聚焦',
    'network-wave': '兴趣共振'
  }[effect] || '交互反馈'
}

function onSelect(payload) {
  selected.value = payload
  selectedId.value = payload?.id || null
}

function onEffect(payload) {
  lastEffect.value = payload
  effectToast.value = effectLabel(payload.effect)
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => {
    effectToast.value = ''
  }, 1200)
}

function clearSelect() {
  selected.value = null
  selectedId.value = null
  lastEffect.value = null
}

function focusRelated() {
  if (!selected.value) return
  ElMessage.success(`${currentSceneMeta.value.actionText}：${selected.value.title}`)
}

function logout() {
  userStore.logout()
  router.push('/login')
}

watch(activeScene, () => clearSelect())

async function loadStats() {
  try {
    const { data } = await api.get('/books/stats')
    stats.value = data
  } catch {
    ElMessage.error('3D 场景数据加载失败')
  }
}

onMounted(() => {
  currentTime.value = new Date().toLocaleString('zh-CN')
  timer = setInterval(() => {
    currentTime.value = new Date().toLocaleString('zh-CN')
  }, 1000)
  loadStats()
})

onBeforeUnmount(() => {
  clearInterval(timer)
  clearTimeout(toastTimer)
})
</script>

<style scoped lang="scss">
.screen3d {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-gradient);
  --accent-scene: #c9a227;

  &.scene-bookshelf { --accent-scene: #c9a227; }
  &.scene-bookstack { --accent-scene: #e8a838; }
  &.scene-galaxy { --accent-scene: #4fc3f7; }
  &.scene-network { --accent-scene: #48c9b0; }
}

.s3-header {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  z-index: 30;
  height: 64px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: linear-gradient(to bottom, rgba(8, 18, 36, 0.92), transparent);
}

.header-left {
  display: flex;
  align-items: center;
  gap: 14px;
  h1 {
    font-size: 18px;
    color: var(--accent-scene);
    letter-spacing: 1px;
  }
  p {
    font-size: 11px;
    color: rgba(232, 240, 248, 0.45);
    font-family: 'JetBrains Mono', monospace;
  }
}

.back-btn {
  border: 1px solid rgba(201, 162, 39, 0.4);
  background: rgba(10, 30, 55, 0.6);
  color: var(--accent-scene);
  padding: 6px 12px;
  border-radius: 6px;
  cursor: pointer;
  font-family: inherit;
  font-size: 13px;
}

.header-center {
  display: flex;
  gap: 6px;
  background: rgba(10, 30, 55, 0.7);
  padding: 4px;
  border-radius: 10px;
  border: 1px solid color-mix(in srgb, var(--accent-scene) 40%, transparent);

  button {
    border: none;
    background: transparent;
    color: rgba(232, 240, 248, 0.55);
    padding: 7px 14px;
    border-radius: 8px;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    &.active {
      background: color-mix(in srgb, var(--accent-scene) 30%, transparent);
      color: var(--accent-scene);
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  color: var(--accent-color);
}

.logout-btn {
  border: 1px solid rgba(255, 100, 100, 0.4);
  background: transparent;
  color: #ff6b6b;
  padding: 4px 10px;
  border-radius: 4px;
  cursor: pointer;
  font-family: inherit;
}

.kpi-row {
  position: absolute;
  top: 72px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 25;
  display: flex;
  gap: 20px;
  padding: 10px 22px;
  background: rgba(10, 30, 55, 0.55);
  border: 1px solid color-mix(in srgb, var(--accent-scene) 35%, transparent);
  border-radius: 10px;
  backdrop-filter: blur(10px);
  pointer-events: none;
}

.kpi {
  text-align: center;
  min-width: 72px;
  strong {
    display: block;
    font-size: 20px;
    color: var(--accent-scene);
    font-family: 'JetBrains Mono', monospace;
  }
  span {
    font-size: 11px;
    color: rgba(232, 240, 248, 0.5);
  }
}

.side-panel {
  position: absolute;
  top: 140px;
  bottom: 80px;
  z-index: 25;
  width: 300px;
  padding: 18px;
  background: rgba(10, 28, 50, 0.78);
  border: 1px solid color-mix(in srgb, var(--accent-scene) 40%, transparent);
  border-radius: 12px;
  backdrop-filter: blur(12px);
  overflow-y: auto;
  pointer-events: auto;

  h3 {
    color: var(--accent-scene);
    font-size: 16px;
    margin-bottom: 8px;
  }
  p {
    font-size: 13px;
    line-height: 1.6;
    color: rgba(232, 240, 248, 0.7);
    margin-bottom: 10px;
  }
  ul {
    padding-left: 16px;
    margin-bottom: 14px;
    li {
      font-size: 12px;
      color: rgba(232, 240, 248, 0.55);
      line-height: 1.8;
    }
  }
}

.left-panel { left: 16px; }
.right-panel {
  right: 16px;
  &.open { border-color: color-mix(in srgb, var(--accent-scene) 65%, transparent); }
}

.scene-badge {
  display: inline-block;
  padding: 2px 10px;
  font-size: 11px;
  border-radius: 999px;
  margin-bottom: 10px;
  color: #0a1628;
  background: var(--accent-scene);
  font-weight: 600;
}

.legend-title {
  font-size: 12px;
  color: var(--accent-scene);
  margin-bottom: 8px;
}

.legend {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.legend-item {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  i {
    width: 10px;
    height: 10px;
    border-radius: 2px;
    flex-shrink: 0;
  }
  span {
    flex: 1;
    color: rgba(232, 240, 248, 0.75);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  b {
    color: var(--accent-scene);
    font-family: 'JetBrains Mono', monospace;
  }
}

.panel-head {
  display: flex;
  justify-content: space-between;
  align-items: center;
  button {
    border: none;
    background: none;
    color: rgba(255, 255, 255, 0.5);
    font-size: 20px;
    cursor: pointer;
  }
}

.tag-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-bottom: 10px;
}

.type-tag,
.effect-tag {
  display: inline-block;
  padding: 2px 8px;
  font-size: 11px;
  border-radius: 4px;
}

.type-tag {
  color: var(--accent-scene);
  border: 1px solid color-mix(in srgb, var(--accent-scene) 50%, transparent);
}

.effect-tag {
  color: #0a1628;
  background: var(--accent-scene);
}

.insight {
  font-size: 12px !important;
  color: rgba(232, 240, 248, 0.55) !important;
  padding: 8px 10px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  border-left: 3px solid var(--accent-scene);
}

.data-rows {
  display: flex;
  flex-direction: column;
  gap: 8px;
  margin-bottom: 16px;
  .row {
    display: flex;
    justify-content: space-between;
    gap: 8px;
    padding: 8px 10px;
    background: rgba(255, 255, 255, 0.04);
    border-radius: 6px;
    font-size: 13px;
    span { color: rgba(232, 240, 248, 0.55); }
    strong { color: var(--text-color); text-align: right; }
  }
}

.extra {
  h4 {
    font-size: 13px;
    color: var(--accent-scene);
    margin-bottom: 8px;
  }
}
.extra-item {
  display: flex;
  justify-content: space-between;
  gap: 8px;
  padding: 6px 0;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  font-size: 13px;
  em {
    font-style: normal;
    color: var(--accent-scene);
    font-family: 'JetBrains Mono', monospace;
  }
}

.actions {
  display: flex;
  gap: 8px;
  margin-top: 16px;
  button {
    flex: 1;
    padding: 8px;
    border-radius: 6px;
    border: none;
    background: var(--accent-scene);
    color: #0a1628;
    cursor: pointer;
    font-family: inherit;
    font-size: 13px;
    &.ghost {
      background: transparent;
      border: 1px solid color-mix(in srgb, var(--accent-scene) 45%, transparent);
      color: var(--accent-scene);
    }
  }
}

.fx-guide {
  font-size: 12px;
  color: rgba(232, 240, 248, 0.55);
  line-height: 1.9;
  margin-bottom: 12px;
}

.muted {
  color: rgba(232, 240, 248, 0.4) !important;
}

.effect-toast {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  z-index: 40;
  pointer-events: none;
  padding: 10px 22px;
  border-radius: 24px;
  background: rgba(10, 22, 40, 0.75);
  border: 1px solid var(--accent-scene);
  color: var(--accent-scene);
  font-size: 14px;
  letter-spacing: 2px;
  animation: toast-fade 1.2s ease-out forwards;
}

@keyframes toast-fade {
  0% { opacity: 0; transform: translate(-50%, -40%); }
  20% { opacity: 1; transform: translate(-50%, -50%); }
  80% { opacity: 1; }
  100% { opacity: 0; transform: translate(-50%, -60%); }
}

.s3-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  z-index: 30;
  height: 64px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 6px;
  background: linear-gradient(to top, rgba(8, 18, 36, 0.92), transparent);
  .hint {
    font-size: 11px;
    color: rgba(232, 240, 248, 0.35);
  }
}
</style>
