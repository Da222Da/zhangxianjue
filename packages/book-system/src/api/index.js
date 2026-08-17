import axios from 'axios'
import { ElMessage } from 'element-plus'
import router from '@/router'

const api = axios.create({
  baseURL: '/api',
  timeout: 30000
})

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.config?.skipErrorToast) {
      return Promise.reject(err)
    }
    const msg = err.response?.data?.message || '请求失败'
    if (err.response?.status === 401) {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      if (router.currentRoute.value.path !== '/login') {
        router.push('/login')
      }
    }
    if (err.response?.status !== 401 || router.currentRoute.value.path !== '/login') {
      ElMessage.error(msg)
    }
    return Promise.reject(err)
  }
)

export default api
