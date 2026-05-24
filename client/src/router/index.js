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
        redirect: '/credentials/own',
        children: [
          { path: 'own', component: () => import('../views/Credentials.vue') },
          { path: 'supplier', component: () => import('../views/Credentials.vue') },
          { path: 'product-reports', component: () => import('../views/credentials/ProductReports.vue') },
          { path: 'overview', component: () => import('../views/credentials/Overview.vue') }
        ]
      },
      { path: 'health-certs', component: () => import('../views/HealthCerts.vue') },
      { path: 'label-audit', redirect: '/ai/smart' },
      {
        path: 'ai',
        redirect: '/ai/smart',
        children: [
          { path: 'smart', component: () => import('../views/ai/SmartAudit.vue') },
          { path: 'export', component: () => import('../views/ai/ExportAudit.vue') },
          { path: 'nutrition', component: () => import('../views/ai/NutritionGen.vue') },
          { path: 'ingredients', component: () => import('../views/ai/IngredientsVerify.vue') },
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
        redirect: '/system/architecture',
        children: [
          { path: 'architecture', component: () => import('../views/system/Architecture.vue') },
          { path: 'manual', component: () => import('../views/system/SystemDocs.vue') },
          { path: 'procedure', component: () => import('../views/system/SystemDocs.vue') },
          { path: 'sop', component: () => import('../views/system/SystemDocs.vue') },
          { path: 'form', component: () => import('../views/system/SystemDocs.vue') },
          { path: 'external', component: () => import('../views/system/SystemDocs.vue') }
        ]
      },
      {
        path: 'pest',
        redirect: '/pest/supplier',
        children: [
          { path: 'supplier', component: () => import('../views/pest/Supplier.vue') },
          { path: 'staff', component: () => import('../views/pest/Staff.vue') },
          { path: 'chemicals', component: () => import('../views/pest/Chemicals.vue') },
          { path: 'service-records', component: () => import('../views/pest/ServiceRecords.vue') },
          { path: 'service-reports', component: () => import('../views/pest/ServiceReports.vue') },
          { path: 'complaints', component: () => import('../views/pest/Complaints.vue') }
        ]
      },
      {
        path: 'calibration',
        redirect: '/calibration/devices',
        children: [
          { path: 'devices', component: () => import('../views/calibration/Devices.vue') },
          { path: 'plans', component: () => import('../views/calibration/Plans.vue') },
          { path: 'records', component: () => import('../views/calibration/Records.vue') },
          { path: 'agencies', component: () => import('../views/calibration/Agencies.vue') },
          { path: 'exceptions', component: () => import('../views/calibration/Exceptions.vue') }
        ]
      },
      {
        path: 'complaint',
        redirect: '/complaint/dashboard',
        children: [
          { path: 'dashboard', component: () => import('../views/complaint/Dashboard.vue') },
          { path: 'list', component: () => import('../views/complaint/List.vue') },
          { path: 'handle', component: () => import('../views/complaint/Handle.vue') },
          { path: 'satisfaction', component: () => import('../views/complaint/Satisfaction.vue') }
        ]
      },
      {
        path: 'raw-material',
        redirect: '/raw-material/library',
        children: [
          { path: 'library', component: () => import('../views/raw-material/Library.vue') },
          { path: 'standards', component: () => import('../views/raw-material/InspectionStandards.vue') },
          { path: 'inspection', component: () => import('../views/raw-material/Inspection.vue') },
          { path: 'product-standards', component: () => import('../views/raw-material/ProductStandards.vue') },
          { path: 'test-items', component: () => import('../views/raw-material/TestItems.vue') },
          { path: 'samples', component: () => import('../views/raw-material/Samples.vue') },
          { path: 'traceability', component: () => import('../views/raw-material/Traceability.vue') },
          { path: 'non-conforming', component: () => import('../views/raw-material/NonConforming.vue') },
          { path: 'standard-changes', component: () => import('../views/raw-material/StandardChanges.vue') },
          { path: 'supplier-quality', component: () => import('../views/raw-material/SupplierQuality.vue') }
        ]
      },
      {
        path: 'training',
        redirect: '/training/plans',
        children: [
          { path: 'plans', component: () => import('../views/training/Plans.vue') },
          { path: 'courses', component: () => import('../views/training/Courses.vue') },
          { path: 'records', component: () => import('../views/training/Records.vue') },
          { path: 'exams', component: () => import('../views/training/Exams.vue') },
          { path: 'certs', component: () => import('../views/training/Certs.vue') }
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
