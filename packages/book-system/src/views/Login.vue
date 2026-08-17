<template>
  <div class="login-page">
    <div class="login-left">
      <div class="brand">
        <div class="brand-icon">
          <svg viewBox="0 0 80 80" width="72" height="72">
            <rect x="8" y="12" width="28" height="52" rx="2" fill="#c9a227" opacity="0.9"/>
            <rect x="22" y="8" width="28" height="52" rx="2" fill="#e8d48b"/>
            <rect x="36" y="16" width="28" height="52" rx="2" fill="#4fc3f7" opacity="0.85"/>
            <line x1="28" y1="20" x2="42" y2="20" stroke="#1a3a5c" stroke-width="2"/>
            <line x1="28" y1="28" x2="40" y2="28" stroke="#1a3a5c" stroke-width="2"/>
          </svg>
        </div>
        <h1>深度学习个性化图书推荐系统</h1>
        <p class="subtitle">Deep Learning Personalized Book Recommendation</p>
      </div>

      <div class="features">
        <div class="feature-item" v-for="f in features" :key="f.title">
          <div class="feature-icon">{{ f.icon }}</div>
          <div>
            <h3>{{ f.title }}</h3>
            <p>{{ f.desc }}</p>
          </div>
        </div>
      </div>

      <div class="book-gallery">
        <div class="book-spine" v-for="(b, i) in bookCovers" :key="i" :style="{ background: b.color, height: b.h + 'px' }">
          <span>{{ b.title }}</span>
        </div>
      </div>

      <div class="tech-tags">
        <span>Vue3</span>
        <span>ECharts</span>
        <span>Three.js</span>
        <span>SQLite</span>
        <span>深度学习</span>
        <span>NCF / DeepFM / DIN</span>
      </div>
    </div>

    <div class="login-right">
      <div class="login-card">
        <div class="wx-header">
          <div class="wx-logo">
            <svg viewBox="0 0 48 48" width="40" height="40">
              <circle cx="24" cy="24" r="22" fill="#07c160"/>
              <path d="M14 22c0-5 4.5-9 10-9s10 4 10 9-4.5 9-10 9c-.6 0-1.2 0-1.8-.1L16 34l1.5-4.2C14.5 28 14 25.2 14 22z" fill="#fff"/>
              <circle cx="20" cy="21" r="1.5" fill="#07c160"/>
              <circle cx="28" cy="21" r="1.5" fill="#07c160"/>
            </svg>
          </div>
          <h2>欢迎登录</h2>
          <p>图书推荐可视化平台</p>
        </div>

        <div class="login-tabs">
          <button :class="{ active: loginType === 'account' }" @click="loginType = 'account'">账号登录</button>
          <button :class="{ active: loginType === 'phone' }" @click="loginType = 'phone'">手机号登录</button>
        </div>

        <el-form :model="form" @submit.prevent="handleLogin" class="login-form">
          <el-form-item v-if="loginType === 'account'">
            <el-input v-model="form.username" placeholder="用户名" size="large" prefix-icon="User" />
          </el-form-item>
          <el-form-item v-else>
            <el-input v-model="form.phone" placeholder="手机号" size="large" prefix-icon="Iphone" maxlength="11" />
          </el-form-item>
          <el-form-item>
            <el-input v-model="form.password" type="password" placeholder="密码" size="large" prefix-icon="Lock" show-password />
          </el-form-item>
          <el-form-item>
            <div class="captcha-row">
              <el-input v-model="form.captchaCode" placeholder="验证码" size="large" prefix-icon="Key" />
              <div class="captcha-img" @click="loadCaptcha" v-html="captchaSvg" title="点击刷新"></div>
            </div>
          </el-form-item>
          <el-button type="primary" size="large" class="login-btn" :loading="loading" @click="handleLogin">
            登 录
          </el-button>
        </el-form>

        <div class="demo-tips">
          <p>演示账号</p>
          <div class="demo-accounts">
            <span @click="fillDemo('admin', 'admin123')">管理员 admin</span>
            <span @click="fillDemo('editor', 'editor123')">编辑 editor</span>
            <span @click="fillDemo('user1', 'user123')">用户 user1</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import api from '@/api'
import { useUserStore, useThemeStore } from '@/stores'

const router = useRouter()
const userStore = useUserStore()
const themeStore = useThemeStore()

const loginType = ref('account')
const loading = ref(false)
const captchaId = ref('')
const captchaSvg = ref('')

const form = reactive({
  username: '',
  phone: '',
  password: '',
  captchaCode: ''
})

const features = [
  { icon: '📚', title: '智能推荐引擎', desc: '基于 NCF、DeepFM、DIN 等深度学习模型' },
  { icon: '📊', title: '多维数据大屏', desc: 'ECharts 三维可视化与实时指标监控' },
  { icon: '🎯', title: '个性化洞察', desc: '用户画像、兴趣矩阵与推荐效果分析' }
]

const bookCovers = [
  { title: '三体', color: '#1a5276', h: 140 },
  { title: '活着', color: '#7b241c', h: 120 },
  { title: '深度学习', color: '#1a5276', h: 155 },
  { title: '人类简史', color: '#6c3483', h: 130 },
  { title: '围城', color: '#117a65', h: 145 },
  { title: '算法导论', color: '#b9770e', h: 160 },
  { title: '推荐系统', color: '#1a3a5c', h: 135 }
]

async function loadCaptcha() {
  try {
    const { data } = await api.get('/auth/captcha')
    captchaId.value = data.id
    captchaSvg.value = data.svg
  } catch {
    captchaSvg.value = ''
    ElMessage.error('验证码加载失败，请点击刷新')
  }
}

function fillDemo(u, p) {
  loginType.value = 'account'
  form.username = u
  form.password = p
}

async function handleLogin() {
  if (loginType.value === 'account' && !form.username) {
    return ElMessage.warning('请输入用户名')
  }
  if (loginType.value === 'phone') {
    if (!form.phone) return ElMessage.warning('请输入手机号')
    if (!/^1\d{10}$/.test(form.phone)) return ElMessage.warning('手机号格式不正确')
  }
  if (!form.password) return ElMessage.warning('请输入密码')
  if (!form.captchaCode) return ElMessage.warning('请输入验证码')

  loading.value = true
  try {
    const { data } = await api.post('/auth/login', {
      ...form,
      captchaId: captchaId.value,
      loginType: loginType.value
    })
    userStore.setAuth(data.token, data.user)
    await themeStore.loadTheme()
    ElMessage.success('登录成功')
    router.push('/screen3d')
  } catch {
    loadCaptcha()
    form.captchaCode = ''
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  loadCaptcha()
  themeStore.applyTheme(themeStore.theme)
})
</script>

<style scoped lang="scss">
.login-page {
  display: flex;
  height: 100vh;
  width: 100vw;
  overflow: hidden;
}

.login-left {
  flex: 1.2;
  padding: 48px 56px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  background:
    radial-gradient(ellipse at 20% 50%, rgba(201, 162, 39, 0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 20%, rgba(79, 195, 247, 0.1) 0%, transparent 40%),
    linear-gradient(160deg, #0a1628 0%, #132a45 60%, #0d2137 100%);
  overflow-y: auto;
  position: relative;

  &::after {
    content: '';
    position: absolute;
    right: 0;
    top: 0;
    bottom: 0;
    width: 1px;
    background: linear-gradient(to bottom, transparent, rgba(201, 162, 39, 0.4), transparent);
  }
}

.brand {
  h1 {
    font-size: 32px;
    font-weight: 700;
    color: #e8d48b;
    margin-top: 16px;
    letter-spacing: 2px;
    line-height: 1.4;
  }
  .subtitle {
    color: rgba(232, 240, 248, 0.5);
    font-size: 13px;
    margin-top: 8px;
    font-family: 'JetBrains Mono', monospace;
    letter-spacing: 1px;
  }
}

.features {
  display: flex;
  flex-direction: column;
  gap: 20px;
  margin: 32px 0;
}

.feature-item {
  display: flex;
  gap: 16px;
  align-items: flex-start;
  padding: 14px 18px;
  background: rgba(255, 255, 255, 0.04);
  border-left: 3px solid var(--primary-color);
  border-radius: 0 8px 8px 0;

  .feature-icon {
    font-size: 28px;
    line-height: 1;
  }
  h3 {
    font-size: 16px;
    color: var(--primary-color);
    margin-bottom: 4px;
  }
  p {
    font-size: 13px;
    color: rgba(232, 240, 248, 0.6);
  }
}

.book-gallery {
  display: flex;
  align-items: flex-end;
  gap: 6px;
  height: 170px;
  padding: 0 8px;

  .book-spine {
    width: 42px;
    border-radius: 2px 2px 0 0;
    display: flex;
    align-items: center;
    justify-content: center;
    writing-mode: vertical-rl;
    box-shadow: 2px 0 8px rgba(0, 0, 0, 0.3);
    transition: transform 0.3s;
    cursor: default;

    span {
      font-size: 11px;
      color: rgba(255, 255, 255, 0.9);
      letter-spacing: 2px;
      padding: 8px 0;
    }

    &:hover {
      transform: translateY(-8px);
    }
  }
}

.tech-tags {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 24px;

  span {
    padding: 4px 12px;
    font-size: 12px;
    border: 1px solid rgba(201, 162, 39, 0.35);
    border-radius: 4px;
    color: rgba(232, 240, 248, 0.7);
    background: rgba(201, 162, 39, 0.08);
  }
}

.login-right {
  flex: 0 0 440px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f5f5;
  padding: 40px;
}

.login-card {
  width: 100%;
  max-width: 360px;
  background: #fff;
  border-radius: 12px;
  padding: 36px 32px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
}

.wx-header {
  text-align: center;
  margin-bottom: 28px;

  .wx-logo {
    margin-bottom: 12px;
  }
  h2 {
    font-size: 22px;
    color: #191919;
    font-weight: 600;
  }
  p {
    font-size: 13px;
    color: #888;
    margin-top: 6px;
  }
}

.login-tabs {
  display: flex;
  margin-bottom: 20px;
  border-bottom: 1px solid #eee;

  button {
    flex: 1;
    padding: 10px;
    border: none;
    background: none;
    font-size: 15px;
    color: #888;
    cursor: pointer;
    position: relative;
    font-family: inherit;

    &.active {
      color: #07c160;
      font-weight: 600;

      &::after {
        content: '';
        position: absolute;
        bottom: -1px;
        left: 25%;
        width: 50%;
        height: 2px;
        background: #07c160;
        border-radius: 1px;
      }
    }
  }
}

.login-form {
  :deep(.el-input__wrapper) {
    background-color: #f7f7f7 !important;
    box-shadow: none !important;
    border-radius: 6px;
  }
  :deep(.el-input__inner) {
    color: #333 !important;
  }
}

.captcha-row {
  display: flex;
  gap: 10px;
  width: 100%;

  .el-input {
    flex: 1;
  }

  .captcha-img {
    width: 120px;
    height: 40px;
    cursor: pointer;
    border-radius: 6px;
    overflow: hidden;
    flex-shrink: 0;
    border: 1px solid #e5e5e5;

    :deep(svg) {
      width: 100%;
      height: 100%;
    }
  }
}

.login-btn {
  width: 100%;
  height: 44px;
  font-size: 16px;
  border-radius: 6px;
  background: #07c160 !important;
  border-color: #07c160 !important;
  color: #fff !important;
  margin-top: 8px;

  &:hover {
    background: #06ad56 !important;
    border-color: #06ad56 !important;
  }
}

.demo-tips {
  margin-top: 24px;
  text-align: center;

  > p {
    font-size: 12px;
    color: #aaa;
    margin-bottom: 8px;
  }
}

.demo-accounts {
  display: flex;
  justify-content: center;
  gap: 12px;

  span {
    font-size: 12px;
    color: #07c160;
    cursor: pointer;
    padding: 2px 8px;
    border-radius: 4px;

    &:hover {
      background: rgba(7, 193, 96, 0.1);
    }
  }
}

@media (max-width: 900px) {
  .login-page {
    flex-direction: column;
  }
  .login-left {
    flex: none;
    padding: 32px 24px;
    max-height: 40vh;
  }
  .login-right {
    flex: 1;
    width: 100%;
  }
  .book-gallery, .tech-tags {
    display: none;
  }
}
</style>
