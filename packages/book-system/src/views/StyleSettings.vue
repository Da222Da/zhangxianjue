<template>
  <div class="page-scroll style-settings">
    <h2 class="page-title">系统样式设置</h2>

    <div class="style-grid">
      <div class="panel-card preview-panel">
        <div class="panel-title">实时预览</div>
        <div class="preview-box" :style="previewStyle">
          <h3>深度学习图书推荐系统</h3>
          <p>这是样式预览区域，调整左侧参数可实时查看效果。</p>
          <div class="preview-chips">
            <span>主色</span>
            <span class="accent">强调色</span>
          </div>
          <div class="preview-chart-mock">
            <div class="bar" v-for="i in 6" :key="i" :style="{ height: 30 + i * 12 + 'px', background: i % 2 ? 'var(--p)' : 'var(--a)' }"></div>
          </div>
        </div>
      </div>

      <div class="panel-card form-panel">
        <div class="panel-title">样式参数</div>
        <el-form label-width="110px">
          <el-form-item label="背景色">
            <div class="color-row">
              <el-color-picker v-model="form.bgColor" />
              <el-input v-model="form.bgColor" style="width:160px" />
            </div>
          </el-form-item>
          <el-form-item label="背景渐变">
            <el-input v-model="form.bgGradient" type="textarea" :rows="2" />
          </el-form-item>
          <el-form-item label="主题色">
            <div class="color-row">
              <el-color-picker v-model="form.primaryColor" />
              <el-input v-model="form.primaryColor" style="width:160px" />
            </div>
          </el-form-item>
          <el-form-item label="强调色">
            <div class="color-row">
              <el-color-picker v-model="form.accentColor" />
              <el-input v-model="form.accentColor" style="width:160px" />
            </div>
          </el-form-item>
          <el-form-item label="文字颜色">
            <div class="color-row">
              <el-color-picker v-model="form.textColor" />
              <el-input v-model="form.textColor" style="width:160px" />
            </div>
          </el-form-item>
          <el-form-item label="面板背景">
            <el-input v-model="form.panelBg" />
          </el-form-item>
          <el-form-item label="字体">
            <el-select v-model="form.fontFamily" style="width:100%">
              <el-option label="Noto Serif SC（衬线）" value='"Noto Serif SC", "Source Han Serif SC", Georgia, serif' />
              <el-option label="JetBrains Mono（等宽）" value='"JetBrains Mono", Consolas, monospace' />
              <el-option label="系统默认" value='system-ui, -apple-system, sans-serif' />
              <el-option label="宋体风格" value='"SimSun", "Songti SC", serif' />
            </el-select>
          </el-form-item>
          <el-form-item label="图表透明度">
            <el-slider v-model="form.chartOpacity" :min="0.3" :max="1" :step="0.05" show-input />
          </el-form-item>
          <el-form-item label="预设主题">
            <div class="presets">
              <button v-for="p in presets" :key="p.name" @click="applyPreset(p)" :style="{ borderColor: p.primaryColor, color: p.primaryColor }">
                {{ p.name }}
              </button>
            </div>
          </el-form-item>
          <el-form-item>
            <el-button type="primary" @click="save" :loading="saving">保存样式</el-button>
            <el-button @click="reset">重置</el-button>
          </el-form-item>
        </el-form>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, computed, onMounted, ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useThemeStore } from '@/stores'

const themeStore = useThemeStore()
const saving = ref(false)

const form = reactive({ ...themeStore.theme })

const previewStyle = computed(() => ({
  background: form.bgGradient || form.bgColor,
  color: form.textColor,
  fontFamily: form.fontFamily,
  '--p': form.primaryColor,
  '--a': form.accentColor
}))

const presets = [
  {
    name: '书香金典',
    bgColor: '#0a1628',
    bgGradient: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d2137 100%)',
    primaryColor: '#c9a227',
    accentColor: '#4fc3f7',
    textColor: '#e8f0f8',
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif',
    chartOpacity: 0.85,
    panelBg: 'rgba(10, 30, 55, 0.55)'
  },
  {
    name: '墨韵青绿',
    bgColor: '#0a1f1a',
    bgGradient: 'linear-gradient(135deg, #0a1f1a 0%, #1a3d32 50%, #0d2820 100%)',
    primaryColor: '#5dcaa5',
    accentColor: '#e8d48b',
    textColor: '#e8f5f0',
    fontFamily: '"Noto Serif SC", Georgia, serif',
    chartOpacity: 0.85,
    panelBg: 'rgba(10, 40, 35, 0.55)'
  },
  {
    name: '深夜琥珀',
    bgColor: '#1a1208',
    bgGradient: 'linear-gradient(135deg, #1a1208 0%, #2d2110 50%, #1a140a 100%)',
    primaryColor: '#e8a838',
    accentColor: '#f0c878',
    textColor: '#f5ead8',
    fontFamily: '"Noto Serif SC", Georgia, serif',
    chartOpacity: 0.9,
    panelBg: 'rgba(40, 28, 12, 0.6)'
  },
  {
    name: '科技蓝调',
    bgColor: '#060d1a',
    bgGradient: 'linear-gradient(135deg, #060d1a 0%, #0d1f3c 50%, #081428 100%)',
    primaryColor: '#3d9eff',
    accentColor: '#00e5c0',
    textColor: '#d0e4ff',
    fontFamily: '"JetBrains Mono", Consolas, monospace',
    chartOpacity: 0.8,
    panelBg: 'rgba(8, 20, 45, 0.6)'
  }
]

function applyPreset(p) {
  Object.assign(form, p)
  themeStore.applyTheme(form)
}

function reset() {
  Object.assign(form, presets[0])
  themeStore.applyTheme(form)
}

async function save() {
  saving.value = true
  try {
    await themeStore.saveTheme({ ...form })
    ElMessage.success('样式已保存')
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  Object.assign(form, themeStore.theme)
})
</script>

<style scoped lang="scss">
.page-title {
  font-size: 20px;
  color: var(--primary-color);
  margin-bottom: 20px;
}

.style-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  padding-bottom: 40px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
}

.preview-box {
  border-radius: 10px;
  padding: 28px;
  min-height: 320px;
  border: 1px solid rgba(255, 255, 255, 0.1);

  h3 {
    font-size: 22px;
    color: var(--p);
    margin-bottom: 10px;
  }
  p {
    opacity: 0.7;
    font-size: 14px;
    margin-bottom: 20px;
  }
}

.preview-chips {
  display: flex;
  gap: 8px;
  margin-bottom: 24px;

  span {
    padding: 4px 14px;
    border-radius: 4px;
    font-size: 12px;
    background: var(--p);
    color: #0a1628;
    &.accent {
      background: var(--a);
    }
  }
}

.preview-chart-mock {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 120px;

  .bar {
    flex: 1;
    border-radius: 4px 4px 0 0;
    opacity: 0.85;
  }
}

.color-row {
  display: flex;
  align-items: center;
  gap: 12px;
}

.presets {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;

  button {
    padding: 6px 14px;
    border: 1px solid;
    background: transparent;
    border-radius: 6px;
    cursor: pointer;
    font-size: 13px;
    font-family: inherit;
  }
}
</style>
