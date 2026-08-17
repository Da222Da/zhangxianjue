<template>
  <div class="dashboard">
    <header class="dash-header">
      <div class="header-left">
        <span class="sys-title">图书推荐 · 数据可视化大屏</span>
        <span class="sys-time">{{ currentTime }}</span>
      </div>
      <nav class="header-nav">
        <button
          v-for="p in pages"
          :key="p.id"
          type="button"
          :class="{ active: currentPage === p.id }"
          @click="currentPage = p.id"
        >
          {{ p.name }}
        </button>
      </nav>
      <div class="header-right">
        <router-link to="/screen3d" class="nav-link highlight">3D 场景</router-link>
        <router-link to="/predict" class="nav-link">预测</router-link>
        <router-link v-if="userStore.isEditor" to="/books" class="nav-link">管理</router-link>
        <span class="user-name">{{ userStore.user?.username }}</span>
        <button type="button" class="logout-btn" @click="logout">退出</button>
      </div>
    </header>

    <div class="kpi-bar">
      <div class="kpi" v-for="k in kpis" :key="k.label">
        <div class="kpi-value">{{ k.value }}</div>
        <div class="kpi-label">{{ k.label }}</div>
      </div>
    </div>

    <div class="charts-grid" v-loading="statsLoading">
      <template v-if="currentPage === 1">
        <div class="chart-card"><div class="panel-title">推荐趋势 · 大面积图</div><v-chart class="chart" :option="optLargeArea" autoresize /></div>
        <div class="chart-card"><div class="panel-title">分类分布</div><v-chart class="chart" :option="optPie" autoresize /></div>
        <div class="chart-card"><div class="panel-title">渐变堆叠面积图</div><v-chart class="chart" :option="optStackArea" autoresize /></div>
        <div class="chart-card"><div class="panel-title">模型雷达图</div><v-chart class="chart" :option="optRadar" autoresize /></div>
      </template>

      <template v-else-if="currentPage === 2">
        <div class="chart-card"><div class="panel-title">缓动函数可视化</div><v-chart class="chart" :option="optEasing" autoresize /></div>
        <div class="chart-card"><div class="panel-title">矩阵微型折线</div><v-chart class="chart" :option="optMiniLine" autoresize /></div>
        <div class="chart-card"><div class="panel-title">堆叠柱状归一化</div><v-chart class="chart" :option="optStackNorm" autoresize /></div>
        <div class="chart-card"><div class="panel-title">阶梯瀑布图</div><v-chart class="chart" :option="optWaterfall" autoresize /></div>
      </template>

      <template v-else-if="currentPage === 3">
        <div class="chart-card wide"><div class="panel-title">主题河流图</div><v-chart class="chart" :option="optRiver" autoresize /></div>
        <div class="chart-card"><div class="panel-title">象形柱图 · Top推荐</div><v-chart class="chart" :option="optPictorial" autoresize /></div>
        <div class="chart-card"><div class="panel-title">农历日历热力</div><v-chart class="chart" :option="optCalendar" autoresize /></div>
      </template>

      <template v-else-if="currentPage === 4">
        <div class="chart-card"><div class="panel-title">相关矩阵 · 热力图</div><v-chart class="chart" :option="optCorrHeat" autoresize /></div>
        <div class="chart-card"><div class="panel-title">相关矩阵 · 散点图</div><v-chart class="chart" :option="optCorrScatter" autoresize /></div>
        <div class="chart-card"><div class="panel-title">散点矩阵组合</div><v-chart class="chart" :option="optScatterMatrix" autoresize /></div>
        <div class="chart-card"><div class="panel-title">评分分布</div><v-chart class="chart" :option="optRatingBar" autoresize /></div>
      </template>

      <template v-else>
        <div class="chart-card">
          <div class="panel-title">三维散点图</div>
          <v-chart v-if="glReady" class="chart" :option="optScatter3d" autoresize />
          <div v-else class="placeholder">加载中...</div>
        </div>
        <div class="chart-card">
          <div class="panel-title">三维柱状图</div>
          <v-chart v-if="glReady" class="chart" :option="optBar3d" autoresize />
          <div v-else class="placeholder">加载中...</div>
        </div>
        <div class="chart-card wide">
          <div class="panel-title">Top 推荐图书榜</div>
          <div class="top-list">
            <div class="top-item" v-for="(b, i) in (stats.topBooks || [])" :key="b.id || i">
              <span class="rank" :class="'r' + (i + 1)">{{ i + 1 }}</span>
              <span class="t-title">{{ b.title }}</span>
              <span class="t-author">{{ b.author }}</span>
              <span class="t-score">{{ b.recommend_score }}</span>
            </div>
          </div>
        </div>
      </template>
    </div>

    <footer class="dash-footer">
      <div class="footer-pages">
        <button
          v-for="p in pages"
          :key="'f' + p.id"
          type="button"
          :class="{ active: currentPage === p.id }"
          @click="switchPage(p.id)"
        >
          {{ p.name }}
        </button>
      </div>
    </footer>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue'
import { useRouter } from 'vue-router'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import {
  LineChart, BarChart, PieChart, ScatterChart, HeatmapChart,
  RadarChart, PictorialBarChart, ThemeRiverChart
} from 'echarts/charts'
import {
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent,
  CalendarComponent, SingleAxisComponent
} from 'echarts/components'
import VChart from 'vue-echarts'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { useUserStore } from '@/stores'
import * as charts from '@/utils/chartOptions'

use([
  CanvasRenderer,
  LineChart, BarChart, PieChart, ScatterChart, HeatmapChart,
  RadarChart, PictorialBarChart, ThemeRiverChart,
  GridComponent, TooltipComponent, LegendComponent, VisualMapComponent,
  CalendarComponent, SingleAxisComponent
])

const router = useRouter()
const userStore = useUserStore()

const stats = ref({
  totalBooks: 0,
  totalUsers: 0,
  totalRatings: 0,
  avgRating: 0,
  categories: [],
  topBooks: [],
  ratingDist: [],
  yearly: [],
  modelStats: [],
  categoryRatings: [],
  trend: []
})

const currentPage = ref(1)
const currentTime = ref('')
const statsLoading = ref(false)
const glReady = ref(false)
let timer = null

const pages = [
  { id: 1, name: '概览监测' },
  { id: 2, name: '趋势分析' },
  { id: 3, name: '主题洞察' },
  { id: 4, name: '关联矩阵' },
  { id: 5, name: '三维图表' }
]

const modelAccuracy = computed(() => {
  const list = stats.value.modelStats || []
  if (!list.length) return '--'
  const avg = list.reduce((s, m) => s + (m.avg_score || 0), 0) / list.length
  return (avg * 100).toFixed(1) + '%'
})

const kpis = computed(() => [
  { label: '图书总量', value: stats.value.totalBooks },
  { label: '用户数', value: stats.value.totalUsers },
  { label: '评分记录', value: stats.value.totalRatings },
  { label: '平均评分', value: stats.value.avgRating },
  { label: '分类数', value: stats.value.categories?.length || 0 },
  { label: '推荐准确率', value: modelAccuracy.value }
])

const optLargeArea = computed(() => charts.largeAreaOption(stats.value.trend || []))
const optStackArea = computed(() => charts.gradientStackArea(stats.value.trend || []))
const optPie = computed(() => charts.categoryPie(stats.value.categories || []))
const optRadar = computed(() => charts.modelRadar(stats.value.modelStats || []))
const optEasing = computed(() => charts.easingVizOption())
const optMiniLine = computed(() => charts.miniLineMatrix(stats.value.topBooks || []))
const optStackNorm = computed(() => charts.stackedBarNorm(stats.value.categories || []))
const optWaterfall = computed(() => charts.waterfallOption(stats.value.yearly || []))
const optRiver = computed(() => charts.themeRiverOption(stats.value.categories || []))
const optPictorial = computed(() => charts.pictorialBar(stats.value.topBooks || []))
const optCalendar = computed(() => charts.calendarHeatmap())
const optCorrHeat = computed(() => charts.corrHeatmap(stats.value.categories || []))
const optCorrScatter = computed(() => charts.corrScatter(stats.value.categoryRatings || []))
const optScatterMatrix = computed(() => charts.scatterMatrixCombo(stats.value.categoryRatings || []))
const optScatter3d = computed(() => charts.scatter3d(stats.value.topBooks || []))
const optBar3d = computed(() => charts.bar3d(stats.value.categories || []))
const optRatingBar = computed(() => {
  const dist = stats.value.ratingDist || []
  return {
    tooltip: charts.baseTooltip(),
    grid: { left: 40, right: 16, top: 20, bottom: 24 },
    xAxis: {
      type: 'category',
      data: dist.map((d) => d.star + '星'),
      axisLabel: { color: 'rgba(232,240,248,0.65)' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: 'rgba(232,240,248,0.65)' }
    },
    series: [{
      type: 'bar',
      data: dist.map((d) => d.count),
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
          colorStops: [{ offset: 0, color: '#c9a227' }, { offset: 1, color: '#4fc3f7' }]
        },
        borderRadius: [4, 4, 0, 0]
      },
      barWidth: 28
    }]
  }
})

async function ensureGl() {
  if (glReady.value) return
  try {
    await import('echarts-gl')
    glReady.value = true
  } catch {
    ElMessage.warning('三维图表加载失败')
  }
}

function switchPage(id) {
  currentPage.value = id
}

watch(currentPage, (id) => {
  if (id === 5) ensureGl()
})

function logout() {
  userStore.logout()
  router.push('/login')
}

async function loadStats() {
  statsLoading.value = true
  try {
    const { data } = await api.get('/books/stats')
    stats.value = {
      totalBooks: data.totalBooks || 0,
      totalUsers: data.totalUsers || 0,
      totalRatings: data.totalRatings || 0,
      avgRating: data.avgRating || 0,
      categories: data.categories || [],
      topBooks: data.topBooks || [],
      ratingDist: data.ratingDist || [],
      yearly: data.yearly || [],
      modelStats: data.modelStats || [],
      categoryRatings: data.categoryRatings || [],
      trend: data.trend || []
    }
  } catch {
    ElMessage.error('大屏数据加载失败')
  } finally {
    statsLoading.value = false
  }
}

onMounted(() => {
  currentTime.value = new Date().toLocaleString('zh-CN')
  timer = setInterval(() => {
    currentTime.value = new Date().toLocaleString('zh-CN')
  }, 1000)
  loadStats()
})

onBeforeUnmount(() => clearInterval(timer))
</script>

<style scoped lang="scss">
.dashboard {
  position: relative;
  width: 100%;
  height: 100vh;
  overflow: hidden;
  background: var(--bg-gradient);
  display: flex;
  flex-direction: column;
}

.dash-header {
  flex-shrink: 0;
  height: 56px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 20px;
  background: rgba(10, 22, 40, 0.85);
  border-bottom: 1px solid rgba(201, 162, 39, 0.25);
  z-index: 10;
}

.header-left {
  display: flex;
  flex-direction: column;
  .sys-title {
    font-size: 17px;
    font-weight: 700;
    color: var(--primary-color);
  }
  .sys-time {
    font-size: 11px;
    color: rgba(232, 240, 248, 0.45);
    font-family: 'JetBrains Mono', monospace;
  }
}

.header-nav {
  display: flex;
  gap: 4px;
  background: rgba(10, 30, 55, 0.6);
  padding: 4px;
  border-radius: 8px;
  border: 1px solid rgba(201, 162, 39, 0.25);

  button {
    padding: 6px 14px;
    border: none;
    background: transparent;
    color: rgba(232, 240, 248, 0.6);
    font-size: 13px;
    border-radius: 6px;
    cursor: pointer;
    font-family: inherit;
    &.active {
      background: rgba(201, 162, 39, 0.3);
      color: var(--primary-color);
    }
  }
}

.header-right {
  display: flex;
  align-items: center;
  gap: 12px;
  font-size: 13px;
  .nav-link {
    color: rgba(232, 240, 248, 0.6);
    text-decoration: none;
    &.highlight { color: var(--accent-color); }
    &:hover { color: var(--primary-color); }
  }
  .user-name { color: var(--accent-color); }
  .logout-btn {
    background: transparent;
    border: 1px solid rgba(255, 80, 80, 0.4);
    color: #ff6b6b;
    padding: 4px 10px;
    border-radius: 4px;
    cursor: pointer;
    font-size: 12px;
    font-family: inherit;
  }
}

.kpi-bar {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  gap: 28px;
  padding: 12px 20px;
  background: rgba(10, 30, 55, 0.35);
  border-bottom: 1px solid rgba(201, 162, 39, 0.15);
}

.kpi {
  text-align: center;
  .kpi-value {
    font-size: 20px;
    font-weight: 700;
    color: var(--primary-color);
    font-family: 'JetBrains Mono', monospace;
  }
  .kpi-label {
    font-size: 11px;
    color: rgba(232, 240, 248, 0.5);
  }
}

.charts-grid {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 14px;
  padding: 14px 16px 70px;
}

.chart-card {
  background: var(--panel-bg);
  border: 1px solid var(--border-color);
  border-radius: 10px;
  padding: 12px;
  min-height: 280px;
  display: flex;
  flex-direction: column;

  &.wide {
    grid-column: 1 / -1;
    min-height: 320px;
  }

  .chart {
    flex: 1;
    min-height: 220px;
    width: 100%;
  }
}

.placeholder {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgba(232, 240, 248, 0.4);
}

.top-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-content: flex-start;
}

.top-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  width: calc(50% - 4px);
  font-size: 13px;
  .rank {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 12px;
    font-weight: 700;
    background: rgba(255, 255, 255, 0.1);
    &.r1 { background: #c9a227; color: #0a1628; }
    &.r2 { background: #a0a0a0; color: #0a1628; }
    &.r3 { background: #cd7f32; color: #0a1628; }
  }
  .t-title { flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  .t-author { color: rgba(232, 240, 248, 0.45); font-size: 12px; }
  .t-score { color: var(--accent-color); font-family: 'JetBrains Mono', monospace; }
}

.dash-footer {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 52px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(to top, rgba(10, 22, 40, 0.95), transparent);
  pointer-events: none;
  > * { pointer-events: auto; }
}

.footer-pages {
  display: flex;
  gap: 6px;
  button {
    padding: 4px 14px;
    border: 1px solid rgba(201, 162, 39, 0.25);
    background: rgba(10, 30, 55, 0.65);
    color: rgba(232, 240, 248, 0.55);
    font-size: 12px;
    border-radius: 12px;
    cursor: pointer;
    font-family: inherit;
    &.active {
      border-color: var(--primary-color);
      color: var(--primary-color);
      background: rgba(201, 162, 39, 0.25);
    }
  }
}

@media (max-width: 900px) {
  .charts-grid {
    grid-template-columns: 1fr;
  }
  .top-item {
    width: 100%;
  }
}
</style>
