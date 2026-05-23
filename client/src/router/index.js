import { createRouter, createWebHistory } from 'vue-router'

// 路由配置（组件懒加载：仅访问时才加载对应 JS）
const routes = [
  // 登录/注册（无需 Layout 包裹）
  { path: '/login', component: () => import('../views/Login.vue') },
  { path: '/register', component: () => import('../views/Register.vue') },

  // 后台管理（MainLayout 统一包裹，子页面渲染到 <router-view>）
  {
    path: '/',
    component: () => import('../views/MainLayout.vue'),
    redirect: '/dashboard',
    children: [
      { path: 'dashboard', component: () => import('../views/Dashboard.vue') },
      { path: 'credentials', component: () => import('../views/Credentials.vue') },
      { path: 'health-certs', component: () => import('../views/HealthCerts.vue') },
      { path: 'label-audit', component: () => import('../views/LabelAudit.vue') },
      { path: 'regulations', component: () => import('../views/Regulations.vue') }
    ]
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

// 全局路由守卫：检查登录状态
router.beforeEach((to, from, next) => {
  const user = localStorage.getItem('user')

  const publicPages = ['/login', '/register']

  if (publicPages.includes(to.path)) {
    if (user && to.path !== '/register') {
      next('/dashboard')
    } else {
      next()
    }
  } else {
    if (!user) {
      next('/login')
    } else {
      next()
    }
  }
})

export default router
