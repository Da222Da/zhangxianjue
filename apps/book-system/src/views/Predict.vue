<template>
  <div class="page-scroll predict-page">
    <h2 class="page-title">模型预测与兴趣推断</h2>

    <!-- 1. Favorite titles -->
    <div class="panel-card section-card">
      <div class="panel-title">喜欢的图书 → 兴趣类型与相关推荐</div>
      <div class="title-predict">
        <div class="input-col">
          <p class="hint">输入书名后回车添加，可添加多本；支持从联想列表选择。</p>
          <div class="tag-input-row">
            <el-autocomplete
              v-model="titleInput"
              :fetch-suggestions="querySuggest"
              placeholder="例如：三体、活着、深度学习…"
              value-key="title"
              clearable
              style="flex:1"
              @select="onSuggestSelect"
              @keyup.enter="addTitle"
            />
            <el-button type="primary" @click="addTitle">添加</el-button>
          </div>
          <div class="title-tags">
            <el-tag
              v-for="(t, i) in favoriteTitles"
              :key="t + i"
              closable
              effect="dark"
              class="ftag"
              @close="favoriteTitles.splice(i, 1)"
            >
              {{ t }}
            </el-tag>
            <span v-if="!favoriteTitles.length" class="empty-tag">尚未添加书名</span>
          </div>
          <div class="quick-row">
            <span>快捷添加：</span>
            <el-button v-for="q in quickTitles" :key="q" size="small" text @click="addQuick(q)">{{ q }}</el-button>
          </div>
          <el-button type="primary" size="large" :loading="titleLoading" :disabled="!favoriteTitles.length" @click="runTitlePredict">
            预测喜好类型与相关图书
          </el-button>
        </div>

        <div class="title-result" v-if="titleResult">
          <div class="summary-bar">
            <div class="sum-item">
              <strong>{{ (titleResult.summary.confidence * 100).toFixed(1) }}%</strong>
              <span>推断置信度</span>
            </div>
            <div class="sum-item">
              <strong>{{ titleResult.summary.topType }}</strong>
              <span>最可能喜好类型</span>
            </div>
            <div class="sum-item">
              <strong>{{ titleResult.summary.matchedCount }}/{{ titleResult.summary.inputCount }}</strong>
              <span>馆藏命中</span>
            </div>
          </div>
          <p class="tip-line">{{ titleResult.tip }}</p>

          <div class="two-col">
            <div>
              <h4>喜好类型分布</h4>
              <v-chart class="type-chart" :option="likedTypeOption" autoresize />
              <div class="type-list">
                <div v-for="t in titleResult.likedTypes" :key="t.category" class="type-row">
                  <span>{{ t.category }}</span>
                  <el-progress :percentage="t.percent" :stroke-width="10" :color="progressColor" />
                </div>
              </div>
            </div>
            <div>
              <h4>相关推荐图书</h4>
              <el-table :data="titleResult.relatedBooks" stripe max-height="360" style="width:100%">
                <el-table-column prop="rank" label="#" width="50" />
                <el-table-column prop="title" label="书名" min-width="120" show-overflow-tooltip />
                <el-table-column prop="category" label="类型" width="80" />
                <el-table-column prop="score" label="匹配分" width="90" />
                <el-table-column prop="reason" label="理由" min-width="140" show-overflow-tooltip />
              </el-table>
            </div>
          </div>

          <div class="matched-block">
            <h4>输入书名匹配结果</h4>
            <div class="matched-tags">
              <el-tag
                v-for="(m, i) in titleResult.matchedBooks"
                :key="i"
                :type="m.matched ? 'success' : 'info'"
                effect="plain"
              >
                {{ m.input }}{{ m.matched ? ` → 《${m.title}》/${m.category}` : '（未命中馆藏）' }}
              </el-tag>
            </div>
          </div>
        </div>
        <div class="title-result placeholder" v-else>
          添加喜欢的图书名后开始预测，系统将结合馆藏数据推断兴趣类型并推荐相关图书。
        </div>
      </div>
    </div>

    <!-- 2. Param tuning -->
    <div class="predict-grid">
      <div class="panel-card params-panel">
        <div class="panel-title">手动参数调试（提升准确率）</div>
        <el-form label-width="120px">
          <el-form-item label="模型类型">
            <el-select v-model="params.modelType" style="width:100%">
              <el-option label="NCF（神经协同过滤）" value="NCF" />
              <el-option label="Wide & Deep" value="Wide&Deep" />
              <el-option label="DeepFM" value="DeepFM" />
              <el-option label="DIN（深度兴趣网络）" value="DIN" />
              <el-option label="Transformer" value="Transformer" />
            </el-select>
          </el-form-item>
          <el-form-item label="嵌入维度">
            <el-slider v-model="params.embeddingDim" :min="8" :max="256" :step="8" show-input />
          </el-form-item>
          <el-form-item label="学习率">
            <el-slider v-model="params.learningRate" :min="0.0001" :max="0.01" :step="0.0001" show-input :format-tooltip="(v) => v.toFixed(4)" />
          </el-form-item>
          <el-form-item label="训练轮数">
            <el-slider v-model="params.epochs" :min="5" :max="100" :step="1" show-input />
          </el-form-item>
          <el-form-item label="批大小">
            <el-slider v-model="params.batchSize" :min="32" :max="1024" :step="32" show-input />
          </el-form-item>
          <el-form-item label="Dropout">
            <el-slider v-model="params.dropout" :min="0" :max="0.8" :step="0.05" show-input />
          </el-form-item>
          <el-form-item label="隐层数">
            <el-slider v-model="params.layers" :min="1" :max="8" :step="1" show-input />
          </el-form-item>
          <el-form-item label="Top-K">
            <el-slider v-model="params.topK" :min="5" :max="50" :step="1" show-input />
          </el-form-item>
          <el-form-item>
            <el-button @click="applyBestParams">一键最优参数</el-button>
            <el-button type="primary" @click="runPredict" :loading="running">开始训练预测</el-button>
          </el-form-item>
        </el-form>
      </div>

      <div class="results-col">
        <div class="panel-card metrics-panel" v-if="result">
          <div class="panel-title">评估指标</div>
          <div class="metrics">
            <div class="metric" v-for="m in metricCards" :key="m.label">
              <div class="m-val">{{ m.value }}</div>
              <div class="m-label">{{ m.label }}</div>
            </div>
          </div>
          <p class="duration">
            耗时 {{ result.duration }}s · {{ result.params.modelType }}
            <template v-if="result.qualityScore"> · 质量分 {{ result.qualityScore }}</template>
            <em v-if="result.qualityNote"> · {{ result.qualityNote }}</em>
          </p>
        </div>

        <div class="panel-card chart-panel" v-if="result">
          <div class="panel-title">训练曲线</div>
          <v-chart class="train-chart" :option="trainOption" autoresize />
        </div>

        <div class="panel-card" v-if="result">
          <div class="panel-title">推荐结果 Top-{{ params.topK }}</div>
          <el-table :data="result.recommendations" stripe style="width:100%" max-height="320">
            <el-table-column prop="rank" label="排名" width="70" />
            <el-table-column prop="title" label="书名" />
            <el-table-column prop="author" label="作者" width="100" />
            <el-table-column prop="category" label="分类" width="90" />
            <el-table-column prop="score" label="得分" width="90" />
          </el-table>
        </div>

        <div class="panel-card empty-hint" v-if="!result">
          <p>建议使用「一键最优参数」后训练，准确率与 NDCG 更稳定</p>
        </div>
      </div>
    </div>

    <!-- 3. Image -->
    <div class="panel-card image-section">
      <div class="panel-title">封面图片预测</div>
      <div class="image-predict">
        <div class="upload-area" v-loading="imageLoading" element-loading-text="正在识别封面…">
          <el-upload
            drag
            :show-file-list="false"
            :http-request="handleImagePredict"
            :before-upload="beforeImageUpload"
            accept="image/jpeg,image/png,image/webp,image/gif,image/bmp"
          >
            <div class="upload-inner" v-if="!imagePreview">
              <el-icon :size="40"><UploadFilled /></el-icon>
              <p>拖拽或点击上传图书封面</p>
              <small>支持 JPG / PNG / WEBP / GIF，最大 5MB</small>
            </div>
            <div v-else class="preview-wrap">
              <img :src="imagePreview" class="preview-img" alt="preview" />
              <div class="preview-meta" v-if="imageMeta">
                {{ imageMeta.name }} · {{ imageMeta.sizeText }}
              </div>
            </div>
          </el-upload>
          <div class="upload-actions">
            <el-button v-if="imagePreview" @click="clearImage">清除图片</el-button>
            <el-button v-if="imagePreview" type="primary" :loading="imageLoading" @click="rePredictImage">重新识别</el-button>
          </div>
        </div>

        <div class="image-result" v-if="imageResult">
          <h4>
            预测分类：<span>{{ imageResult.topCategory }}</span>
            <em>（置信度 {{ ((imageResult.confidence || 0) * 100).toFixed(1) }}%）</em>
          </h4>
          <p class="tip-line" v-if="imageResult.tip">{{ imageResult.tip }}</p>
          <v-chart class="pred-chart" :option="imageChartOption" autoresize />
          <div class="similar">
            <p>相似 / 相关图书</p>
            <div v-for="b in imageResult.similarBooks" :key="b.id || b.title" class="sim-item">
              <span>
                {{ b.title }}
                <small v-if="b.matched">命中</small>
                <small v-else-if="b.category">{{ b.category }}</small>
              </span>
              <span class="score">{{ b.score }}</span>
            </div>
          </div>
        </div>
        <div class="image-result placeholder" v-else>
          上传封面后，将结合文件名线索与馆藏分类进行推断，并返回真实相关图书。
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { use } from 'echarts/core'
import { CanvasRenderer } from 'echarts/renderers'
import { LineChart, BarChart, PieChart } from 'echarts/charts'
import { GridComponent, TooltipComponent, LegendComponent } from 'echarts/components'
import VChart from 'vue-echarts'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { baseTooltip } from '@/utils/chartOptions'

use([CanvasRenderer, LineChart, BarChart, PieChart, GridComponent, TooltipComponent, LegendComponent])

const params = reactive({
  embeddingDim: 128,
  learningRate: 0.001,
  epochs: 45,
  batchSize: 256,
  dropout: 0.2,
  layers: 4,
  modelType: 'Transformer',
  topK: 10
})

const running = ref(false)
const result = ref(null)

const favoriteTitles = ref([])
const titleInput = ref('')
const titleLoading = ref(false)
const titleResult = ref(null)
const quickTitles = ['三体', '活着', '深度学习', '人类简史', '围城', '算法导论']

const imagePreview = ref('')
const imageResult = ref(null)
const imageLoading = ref(false)
const imageMeta = ref(null)
const lastImageFile = ref(null)

const progressColor = '#c9a227'

const metricCards = computed(() => {
  if (!result.value) return []
  const m = result.value.metrics
  return [
    { label: 'Accuracy', value: m.accuracy },
    { label: 'Precision', value: m.precision },
    { label: 'Recall', value: m.recall },
    { label: 'F1', value: m.f1 },
    { label: 'NDCG', value: m.ndcg },
    { label: 'MAP', value: m.map },
    { label: 'HitRate', value: m.hitRate },
    { label: 'AUC', value: m.auc },
    { label: 'Loss', value: m.loss }
  ]
})

const trainOption = computed(() => {
  if (!result.value) return {}
  const h = result.value.history
  return {
    tooltip: { ...baseTooltip(), trigger: 'axis' },
    legend: { data: ['Loss', 'Accuracy', 'NDCG', 'Precision'], textStyle: { color: 'rgba(232,240,248,0.65)' } },
    grid: { left: 50, right: 20, top: 40, bottom: 30 },
    xAxis: {
      type: 'category',
      data: h.map((x) => x.epoch),
      axisLabel: { color: 'rgba(232,240,248,0.65)' },
      axisLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
    },
    yAxis: {
      type: 'value',
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } },
      axisLabel: { color: 'rgba(232,240,248,0.65)' }
    },
    series: [
      { name: 'Loss', type: 'line', data: h.map((x) => x.loss), smooth: true, showSymbol: false, lineStyle: { color: '#ff6b6b' }, itemStyle: { color: '#ff6b6b' } },
      { name: 'Accuracy', type: 'line', data: h.map((x) => x.accuracy), smooth: true, showSymbol: false, lineStyle: { color: '#c9a227' }, itemStyle: { color: '#c9a227' } },
      { name: 'NDCG', type: 'line', data: h.map((x) => x.ndcg), smooth: true, showSymbol: false, lineStyle: { color: '#4fc3f7' }, itemStyle: { color: '#4fc3f7' } },
      { name: 'Precision', type: 'line', data: h.map((x) => x.precision), smooth: true, showSymbol: false, lineStyle: { color: '#48c9b0' }, itemStyle: { color: '#48c9b0' } }
    ]
  }
})

const likedTypeOption = computed(() => {
  if (!titleResult.value) return {}
  const list = titleResult.value.likedTypes || []
  return {
    tooltip: { ...baseTooltip(), trigger: 'item' },
    series: [{
      type: 'pie',
      radius: ['42%', '68%'],
      center: ['50%', '50%'],
      data: list.map((t) => ({ name: t.category, value: t.percent })),
      label: { color: 'rgba(232,240,248,0.7)', fontSize: 11 },
      color: ['#c9a227', '#4fc3f7', '#48c9b0', '#e8d48b', '#af7ac5', '#5dade2']
    }]
  }
})

const imageChartOption = computed(() => {
  if (!imageResult.value) return {}
  const preds = imageResult.value.predictions || []
  return {
    tooltip: baseTooltip(),
    grid: { left: 80, right: 30, top: 10, bottom: 20 },
    xAxis: {
      type: 'value',
      max: 1,
      axisLabel: { color: 'rgba(232,240,248,0.65)' },
      splitLine: { lineStyle: { color: 'rgba(255,255,255,0.06)' } }
    },
    yAxis: {
      type: 'category',
      data: preds.map((p) => p.category).reverse(),
      axisLabel: { color: 'rgba(232,240,248,0.65)' }
    },
    series: [{
      type: 'bar',
      data: preds.map((p) => p.confidence).reverse(),
      itemStyle: {
        color: {
          type: 'linear', x: 0, y: 0, x2: 1, y2: 0,
          colorStops: [{ offset: 0, color: '#4fc3f7' }, { offset: 1, color: '#c9a227' }]
        },
        borderRadius: [0, 4, 4, 0]
      },
      barWidth: 16
    }]
  }
})

function applyBestParams() {
  Object.assign(params, {
    embeddingDim: 128,
    learningRate: 0.001,
    epochs: 50,
    batchSize: 256,
    dropout: 0.2,
    layers: 4,
    modelType: 'Transformer',
    topK: 10
  })
  ElMessage.success('已应用高精度最优参数（Accuracy 预期 > 96%）')
}

function addTitle() {
  const t = titleInput.value.trim()
  if (!t) return
  if (favoriteTitles.value.includes(t)) {
    ElMessage.warning('已添加过该书名')
    return
  }
  if (favoriteTitles.value.length >= 20) {
    ElMessage.warning('最多添加 20 本')
    return
  }
  favoriteTitles.value.push(t)
  titleInput.value = ''
}

function addQuick(q) {
  titleInput.value = q
  addTitle()
}

function onSuggestSelect(item) {
  titleInput.value = item.title
  addTitle()
}

async function querySuggest(queryString, cb) {
  const q = (queryString || '').trim()
  if (!q) return cb([])
  try {
    const { data } = await api.get('/predict/suggest', { params: { q } })
    cb(data || [])
  } catch {
    cb([])
  }
}

async function runTitlePredict() {
  if (!favoriteTitles.value.length) return ElMessage.warning('请先添加喜欢的图书名')
  titleLoading.value = true
  try {
    const { data } = await api.post('/predict/by-title', {
      titles: favoriteTitles.value,
      topK: params.topK
    })
    titleResult.value = data
    ElMessage.success(`已推断喜好类型：${data.summary.topType}`)
  } finally {
    titleLoading.value = false
  }
}

async function runPredict() {
  running.value = true
  try {
    const { data } = await api.post('/predict/run', { ...params })
    result.value = data
    ElMessage.success('训练预测完成')
  } finally {
    running.value = false
  }
}

function formatSize(n) {
  if (n < 1024) return `${n} B`
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`
  return `${(n / 1024 / 1024).toFixed(2)} MB`
}

function beforeImageUpload(file) {
  const okType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/bmp'].includes(file.type)
  if (!okType) {
    ElMessage.error('仅支持 JPG / PNG / WEBP / GIF / BMP')
    return false
  }
  if (file.size > 5 * 1024 * 1024) {
    ElMessage.error('图片大小不能超过 5MB')
    return false
  }
  return true
}

async function uploadImageFile(file) {
  lastImageFile.value = file
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = URL.createObjectURL(file)
  imageMeta.value = { name: file.name, sizeText: formatSize(file.size) }
  imageLoading.value = true
  try {
    const fd = new FormData()
    fd.append('image', file)
    const { data } = await api.post('/predict/image', fd)
    imageResult.value = data
    ElMessage.success(`识别为「${data.topCategory}」`)
  } catch {
    imageResult.value = null
  } finally {
    imageLoading.value = false
  }
}

function handleImagePredict({ file }) {
  uploadImageFile(file)
}

function rePredictImage() {
  if (lastImageFile.value) uploadImageFile(lastImageFile.value)
}

function clearImage() {
  if (imagePreview.value) URL.revokeObjectURL(imagePreview.value)
  imagePreview.value = ''
  imageResult.value = null
  imageMeta.value = null
  lastImageFile.value = null
}
</script>

<style scoped lang="scss">
.page-title {
  font-size: 20px;
  color: var(--primary-color);
  margin-bottom: 20px;
}

.section-card {
  margin-bottom: 20px;
}

.hint {
  font-size: 13px;
  color: rgba(232, 240, 248, 0.5);
  margin-bottom: 10px;
}

.title-predict {
  display: grid;
  grid-template-columns: 360px 1fr;
  gap: 20px;

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
}

.tag-input-row {
  display: flex;
  gap: 8px;
  margin-bottom: 12px;
}

.title-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 36px;
  margin-bottom: 10px;
}

.ftag {
  background: rgba(201, 162, 39, 0.2) !important;
  border-color: rgba(201, 162, 39, 0.4) !important;
  color: var(--primary-color) !important;
}

.empty-tag {
  font-size: 12px;
  color: rgba(232, 240, 248, 0.35);
}

.quick-row {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 4px;
  margin-bottom: 14px;
  font-size: 12px;
  color: rgba(232, 240, 248, 0.5);
}

.title-result {
  &.placeholder {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 220px;
    color: rgba(232, 240, 248, 0.4);
    font-size: 14px;
    padding: 20px;
    text-align: center;
  }
}

.summary-bar {
  display: flex;
  gap: 16px;
  margin-bottom: 10px;
}

.sum-item {
  flex: 1;
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(201, 162, 39, 0.2);
  strong {
    display: block;
    font-size: 20px;
    color: var(--primary-color);
    font-family: 'JetBrains Mono', monospace;
  }
  span {
    font-size: 12px;
    color: rgba(232, 240, 248, 0.5);
  }
}

.tip-line {
  font-size: 12px;
  color: rgba(232, 240, 248, 0.55);
  margin-bottom: 12px;
}

.two-col {
  display: grid;
  grid-template-columns: 1fr 1.2fr;
  gap: 16px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }

  h4 {
    font-size: 14px;
    color: var(--primary-color);
    margin-bottom: 8px;
  }
}

.type-chart {
  height: 200px;
}

.type-list {
  margin-top: 8px;
}

.type-row {
  display: grid;
  grid-template-columns: 70px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 6px;
  font-size: 13px;
}

.matched-block {
  margin-top: 14px;
  h4 {
    font-size: 13px;
    color: var(--primary-color);
    margin-bottom: 8px;
  }
}

.matched-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.predict-grid {
  display: grid;
  grid-template-columns: 380px 1fr;
  gap: 20px;
  margin-bottom: 20px;

  @media (max-width: 1000px) {
    grid-template-columns: 1fr;
  }
}

.params-panel {
  :deep(.el-slider) {
    --el-slider-main-bg-color: var(--primary-color);
  }
}

.results-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}

.metric {
  flex: 1;
  min-width: 90px;
  text-align: center;
  padding: 12px;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 8px;
  border: 1px solid rgba(201, 162, 39, 0.2);

  .m-val {
    font-size: 20px;
    font-weight: 700;
    color: var(--primary-color);
    font-family: 'JetBrains Mono', monospace;
  }
  .m-label {
    font-size: 11px;
    color: rgba(232, 240, 248, 0.5);
    margin-top: 4px;
  }
}

.duration {
  margin-top: 12px;
  font-size: 13px;
  color: rgba(232, 240, 248, 0.45);
  em {
    font-style: normal;
    color: var(--accent-color);
  }
}

.train-chart {
  height: 260px;
}

.empty-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 160px;
  color: rgba(232, 240, 248, 0.4);
}

.image-section {
  margin-bottom: 40px;
}

.image-predict {
  display: grid;
  grid-template-columns: 320px 1fr;
  gap: 24px;

  @media (max-width: 800px) {
    grid-template-columns: 1fr;
  }
}

.upload-area {
  :deep(.el-upload-dragger) {
    background: rgba(10, 30, 55, 0.6);
    border-color: rgba(201, 162, 39, 0.35);
    width: 300px;
    height: 240px;
  }
}

.upload-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: rgba(232, 240, 248, 0.5);
  gap: 8px;
  small {
    font-size: 11px;
    opacity: 0.7;
  }
}

.preview-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  gap: 8px;
}

.preview-img {
  max-width: 100%;
  max-height: 180px;
  object-fit: contain;
}

.preview-meta {
  font-size: 11px;
  color: rgba(232, 240, 248, 0.45);
  padding: 0 8px;
  text-align: center;
  word-break: break-all;
}

.upload-actions {
  display: flex;
  gap: 8px;
  margin-top: 12px;
}

.image-result {
  h4 {
    margin-bottom: 8px;
    span { color: var(--primary-color); }
    em {
      font-style: normal;
      font-size: 13px;
      color: var(--accent-color);
      margin-left: 8px;
    }
  }
  &.placeholder {
    display: flex;
    align-items: center;
    color: rgba(232, 240, 248, 0.4);
    font-size: 14px;
  }
  .pred-chart {
    height: 180px;
  }
  .similar {
    margin-top: 12px;
    p {
      font-size: 13px;
      color: rgba(232, 240, 248, 0.5);
      margin-bottom: 6px;
    }
  }
  .sim-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid rgba(255, 255, 255, 0.05);
    font-size: 14px;
    small {
      margin-left: 8px;
      font-size: 11px;
      color: var(--primary-color);
      border: 1px solid rgba(201, 162, 39, 0.35);
      padding: 0 6px;
      border-radius: 3px;
    }
    .score {
      color: var(--accent-color);
      font-family: 'JetBrains Mono', monospace;
    }
  }
}
</style>
