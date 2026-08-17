import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/api'

export const useUserStore = defineStore('user', () => {
  const token = ref(localStorage.getItem('token') || '')
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'))

  const isAdmin = computed(() => user.value?.role === 'admin')
  const isEditor = computed(() => ['admin', 'editor'].includes(user.value?.role))

  function setAuth(t, u) {
    token.value = t
    user.value = u
    localStorage.setItem('token', t)
    localStorage.setItem('user', JSON.stringify(u))
  }

  function logout() {
    token.value = ''
    user.value = null
    localStorage.removeItem('token')
    localStorage.removeItem('user')
  }

  return { token, user, isAdmin, isEditor, setAuth, logout }
})

export const useThemeStore = defineStore('theme', () => {
  const theme = ref({
    bgColor: '#0a1628',
    bgGradient: 'linear-gradient(135deg, #0a1628 0%, #1a3a5c 50%, #0d2137 100%)',
    primaryColor: '#c9a227',
    accentColor: '#4fc3f7',
    textColor: '#e8f0f8',
    fontFamily: '"Noto Serif SC", "Source Han Serif SC", Georgia, serif',
    chartOpacity: 0.85,
    panelBg: 'rgba(10, 30, 55, 0.55)'
  })

  function applyTheme(t) {
    theme.value = { ...theme.value, ...t }
    const root = document.documentElement
    root.style.setProperty('--bg-color', theme.value.bgColor)
    root.style.setProperty('--bg-gradient', theme.value.bgGradient)
    root.style.setProperty('--primary-color', theme.value.primaryColor)
    root.style.setProperty('--accent-color', theme.value.accentColor)
    root.style.setProperty('--text-color', theme.value.textColor)
    root.style.setProperty('--font-family', theme.value.fontFamily)
    root.style.setProperty('--chart-opacity', theme.value.chartOpacity)
    root.style.setProperty('--panel-bg', theme.value.panelBg)
    document.body.style.background = theme.value.bgGradient
    document.body.style.fontFamily = theme.value.fontFamily
    document.body.style.color = theme.value.textColor
  }

  async function loadTheme() {
    try {
      const { data } = await api.get('/settings/theme')
      applyTheme({ ...theme.value, ...data })
    } catch {
      applyTheme(theme.value)
    }
  }

  async function saveTheme(t) {
    applyTheme(t)
    await api.put('/settings/theme', theme.value)
  }

  return { theme, applyTheme, loadTheme, saveTheme }
})
