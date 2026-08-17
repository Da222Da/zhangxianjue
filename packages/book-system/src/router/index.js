import { createRouter, createWebHistory } from 'vue-router'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('@/views/Login.vue'),
    meta: { public: true }
  },
  {
    path: '/',
    component: () => import('@/layouts/MainLayout.vue'),
    redirect: '/screen3d',
    children: [
      {
        path: 'screen3d',
        name: 'Screen3D',
        component: () => import('@/views/Screen3D.vue'),
        meta: { title: '3D场景大屏', fullscreen: true }
      },
      {
        path: 'dashboard',
        name: 'Dashboard',
        component: () => import('@/views/Dashboard.vue'),
        meta: { title: '图表数据大屏', fullscreen: true }
      },
      {
        path: 'books',
        name: 'Books',
        component: () => import('@/views/DataManage.vue'),
        meta: { title: '图书管理', roles: ['admin', 'editor'] }
      },
      {
        path: 'users',
        name: 'Users',
        component: () => import('@/views/UserManage.vue'),
        meta: { title: '用户管理', roles: ['admin'] }
      },
      {
        path: 'db-settings',
        name: 'DbSettings',
        component: () => import('@/views/DbSettings.vue'),
        meta: { title: '数据库设置', roles: ['admin'] }
      },
      {
        path: 'style',
        name: 'StyleSettings',
        component: () => import('@/views/StyleSettings.vue'),
        meta: { title: '样式设置', roles: ['admin'] }
      },
      {
        path: 'predict',
        name: 'Predict',
        component: () => import('@/views/Predict.vue'),
        meta: { title: '模型预测' }
      }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('token')
  if (!to.meta.public && !token) {
    return next('/login')
  }
  if (to.path === '/login' && token) {
    return next('/screen3d')
  }
  const user = JSON.parse(localStorage.getItem('user') || 'null')
  if (to.meta.roles && user && !to.meta.roles.includes(user.role)) {
    return next('/screen3d')
  }
  next()
})

export default router
