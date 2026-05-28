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
      {
        path: 'credentials',
        redirect: '/credentials/supplier',
        children: [
          { path: 'own', redirect: '/credentials/supplier' },
          { path: 'supplier', component: () => import('../views/Credentials.vue') },
          { path: 'product-reports', component: () => import('../views/credentials/ProductReports.vue') },
          { path: 'overview', component: () => import('../views/credentials/Overview.vue') },
          { path: 'supplier-quality', component: () => import('../views/raw-material/SupplierQuality.vue') }
        ]
      },
      { path: 'health-certs', redirect: '/personnel/health-certs' },
      { path: 'label-audit', redirect: '/ai/smart' },
      {
        path: 'ai',
        redirect: '/ai/smart',
        children: [
          { path: 'smart', component: () => import('../views/ai/SmartAudit.vue') },
          { path: 'supplier-score', component: () => import('../views/ai/SupplierScore.vue') },
          { path: 'complaint-classify', component: () => import('../views/ai/ComplaintClassify.vue') },
          { path: 'complaint-reply', component: () => import('../views/ai/ComplaintReply.vue') },
          { path: 'complaint-analysis', component: () => import('../views/ai/ComplaintAnalysis.vue') }
        ]
      },
      {
        path: 'regulations',
        redirect: '/regulations/national',
        children: [
          { path: 'national', component: () => import('../views/Regulations.vue') },
          { path: 'industry', component: () => import('../views/Regulations.vue') },
          { path: 'company', component: () => import('../views/Regulations.vue') }
        ]
      },
      {
        path: 'system',
        redirect: '/system',
        children: [
          { path: '', component: () => import('../views/system/SystemWrapper.vue') },
          { path: 'architecture', redirect: '/system' },
          { path: 'manual', redirect: '/system' },
          { path: 'procedure', redirect: '/system' },
          { path: 'sop', redirect: '/system' },
          { path: 'form', redirect: '/system' },
          { path: 'external', redirect: '/system' }
        ]
      },
      {
        path: 'pest',
        redirect: '/third-party/pest',
        children: [
          { path: 'supplier', redirect: '/third-party/pest' },
          { path: 'staff', redirect: '/third-party/pest' },
          { path: 'chemicals', redirect: '/third-party/pest' },
          { path: 'service-records', redirect: '/third-party/pest' },
          { path: 'service-reports', redirect: '/third-party/pest' },
          { path: 'complaints', redirect: '/third-party/pest' }
        ]
      },
      {
        path: 'calibration',
        redirect: '/third-party/calibration',
        children: [
          { path: 'devices', redirect: '/third-party/calibration' },
          { path: 'plans', redirect: '/third-party/calibration' },
          { path: 'records', redirect: '/third-party/calibration' },
          { path: 'agencies', redirect: '/third-party/calibration' },
          { path: 'exceptions', redirect: '/third-party/calibration' }
        ]
      },
      {
        path: 'complaint',
        redirect: '/raw-material/product-standards',
        children: [
          { path: 'dashboard', redirect: '/raw-material/product-standards' },
          { path: 'list', redirect: '/raw-material/product-standards' },
          { path: 'handle', redirect: '/raw-material/product-standards' },
          { path: 'satisfaction', redirect: '/raw-material/product-standards' }
        ]
      },
      {
        path: 'raw-material',
        redirect: '/raw-material/library',
        children: [
          { path: 'library', component: () => import('../views/raw-material/Library.vue') },
          { path: 'inspection', redirect: '/raw-material/library' },
          { path: 'product-standards', component: () => import('../views/raw-material/ProductStandards.vue') },
          { path: 'samples', redirect: '/raw-material/library' },
          { path: 'traceability', component: () => import('../views/raw-material/Traceability.vue') },
          { path: 'non-conforming', redirect: '/raw-material/library' },
          { path: 'standard-changes', redirect: '/raw-material/library' },
          { path: 'supplier-quality', redirect: '/credentials/supplier-quality' }
        ]
      },
      {
        path: 'third-party',
        redirect: '/third-party/pest',
        children: [
          { path: 'pest', component: () => import('../views/pest/PestWrapper.vue') },
          { path: 'calibration', component: () => import('../views/calibration/CalibrationWrapper.vue') }
        ]
      },
      { path: 'training', component: () => import('../views/training/TrainingWrapper.vue') },
      { path: 'training/plans', redirect: '/training' },
      { path: 'training/courses', redirect: '/training' },
      { path: 'training/records', redirect: '/training' },
      { path: 'training/exams', redirect: '/training' },
      { path: 'training/certs', redirect: '/training' },
      {
        path: 'personnel',
        redirect: '/personnel/info',
        children: [
          { path: 'info', component: () => import('../views/hr/PersonnelWrapper.vue') },
          { path: 'list', redirect: '/personnel/info' },
          { path: 'health-certs', redirect: '/personnel/info' }
        ]
      }
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
