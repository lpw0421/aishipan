<template>
  <div class="dashboard">
    <!-- ===== 顶部问候区 ===== -->
    <div class="greeting-bar">
      <div class="greeting-left">
        <h1 class="greeting-text">{{ greeting }}，{{ username }} 👋</h1>
        <p class="greeting-date">{{ currentDateTime }}</p>
      </div>
      <div class="greeting-right">
        <span class="system-status" :class="systemStatus.class">
          <span class="status-dot"></span>
          {{ systemStatus.text }}
        </span>
      </div>
    </div>

    <!-- ===== 食安健康指数仪表盘 ===== -->
    <div class="health-score-section" v-if="healthScore">
      <div class="health-main">
        <div class="health-gauge">
          <svg viewBox="0 0 200 200" class="gauge-svg">
            <circle cx="100" cy="100" r="88" fill="none" stroke="#e5e7eb" stroke-width="14"/>
            <circle cx="100" cy="100" r="88" fill="none" :stroke="healthScore.color" stroke-width="14"
              stroke-linecap="round" :stroke-dasharray="dashArray" stroke-dashoffset="0"
              transform="rotate(-90 100 100)" style="transition: stroke-dasharray 1s ease"/>
            <text x="100" y="90" text-anchor="middle" class="gauge-score" :fill="healthScore.color">{{ healthScore.total_score }}</text>
            <text x="100" y="118" text-anchor="middle" class="gauge-label">/ 100</text>
          </svg>
        </div>
        <div class="health-info">
          <div class="health-level">
            <span class="level-badge" :style="{background: healthScore.color}">{{ healthScore.level }}</span>
            <span class="level-desc">{{ levelDesc }}</span>
          </div>
          <div class="health-trend" v-if="healthScore.trend !== 0">
            <span :class="healthScore.trend > 0 ? 'trend-up' : 'trend-down'">
              {{ healthScore.trend > 0 ? '📈' : '📉' }} {{ Math.abs(healthScore.trend) > 0 ? (healthScore.trend > 0 ? '+' : '') + healthScore.trend : '' }}
            </span>
            <span class="trend-label">较上周</span>
          </div>
          <div class="health-trend" v-else>
            <span class="trend-flat">📊 首次评估</span>
          </div>
        </div>
      </div>
      <div class="health-dims">
        <div class="dim-card" v-for="dim in healthScore.dimensions" :key="dim.key"
          @click="dim.route ? router.push(dim.route) : null">
          <div class="dim-header">
            <span class="dim-name">{{ dim.name }}</span>
            <span class="dim-weight">{{ dim.weight }}%</span>
          </div>
          <div class="dim-score-row">
            <span class="dim-score" :style="{color: dimColor(dim.score)}">{{ dim.score }}</span>
            <span class="dim-max">/ {{ dim.max }}</span>
          </div>
          <el-progress :percentage="dim.score" :stroke-width="8" :color="dimColor(dim.score)" :show-text="false" />
          <div class="dim-detail">{{ dim.detail }}</div>
        </div>
      </div>
    </div>
    <div class="health-loading" v-else-if="healthLoading">
      <div class="spinner"></div>
    </div>

    <!-- ===== 统计卡片 ===== -->
    <div class="stats-grid">
      <div class="stat-card" v-for="card in statCards" :key="card.label" @click="card.onClick ? card.onClick() : null">
        <div class="stat-icon" :class="card.color">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path v-for="d in card.paths" :d="d" />
            <circle v-for="c in card.circles" :cx="c.cx" :cy="c.cy" :r="c.r" />
            <line v-for="l in card.lines" :x1="l.x1" :y1="l.y1" :x2="l.x2" :y2="l.y2" />
            <polyline v-for="p in card.polylines" :points="p" />
            <rect v-for="r in card.rects" :x="r.x" :y="r.y" :width="r.w" :height="r.h" :rx="r.rx" :ry="r.ry" />
          </svg>
        </div>
        <div class="stat-info">
          <div class="stat-label">{{ card.label }}</div>
          <div class="stat-value" :class="{ red: card.valueRed }">{{ card.value }}</div>
          <div class="stat-trend" :class="card.trendDir">
            <span>{{ card.trendText }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 快捷操作 + 趋势图 ===== -->
    <div class="content-grid">
      <div class="section-card quick-section">
        <div class="section-title">快捷操作</div>
        <div class="quick-actions">
          <div class="quick-action blue" @click="goMaterialInspection">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">原料验收</div>
              <div class="desc">入库原料检验记录</div>
            </div>
          </div>
          <div class="quick-action purple" @click="goLabelAudit">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="8" y1="8" x2="16" y2="8"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="8" y1="16" x2="12" y2="16"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">标签审核</div>
              <div class="desc">AI 智能标签合规检查</div>
            </div>
          </div>
          <div class="quick-action emerald" @click="goAddCredential">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">新增资质</div>
              <div class="desc">添加供应商资质信息</div>
            </div>
          </div>
          <div class="quick-action green" @click="goAddHealthCert">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">录入健康证</div>
              <div class="desc">登记员工健康证信息</div>
            </div>
          </div>
          <div class="quick-action orange" @click="goComplaint">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">新增客诉</div>
              <div class="desc">记录客户投诉信息</div>
            </div>
          </div>
          <div class="quick-action amber" @click="goPestService">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">虫害记录</div>
              <div class="desc">虫害服务检查记录</div>
            </div>
          </div>
          <div class="quick-action slate" @click="goCalibrationRecord">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">校准记录</div>
              <div class="desc">计量校准计划与记录</div>
            </div>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">
          近7天到期趋势
          <span class="more" @click="scrollToWarnings">查看全部</span>
        </div>
        <div class="chart-placeholder">
          <div class="chart-bars" v-if="chartBars.length > 0">
            <div class="chart-bar-group" v-for="bar in chartBars" :key="bar.label">
              <div class="chart-bar" :style="{ height: bar.height, background: bar.bg }" :title="bar.label + ': ' + bar.count + ' 项'">
                <span v-if="bar.count > 0" class="bar-count">{{ bar.count }}</span>
              </div>
              <div class="chart-bar-label">{{ bar.label }}</div>
            </div>
          </div>
          <div class="chart-empty" v-else>
            <div class="empty-icon">✅</div>
            <div class="empty-text">近7天无到期项</div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 即将过期预警 ===== -->
    <div class="section-card" ref="warningsRef">
      <div class="section-title">
        即将过期预警（30天内）
        <span class="badge">{{ warnings.length }} 项</span>
      </div>

      <div class="loading-overlay" v-if="loading">
        <div class="spinner"></div>
      </div>

      <div class="empty-state" v-else-if="!loading && warnings.length === 0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <div class="title">暂无即将到期项</div>
        <div class="desc">所有资质和健康证均在有效期内</div>
      </div>

      <table class="warning-table" v-else>
        <thead>
          <tr>
            <th>类型</th>
            <th>名称</th>
            <th>到期日期</th>
            <th>剩余天数</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="item in warnings" :key="item.title + item.expiry_date">
            <td>
              <span class="tag" :class="getTypeTagClass(item.type)">{{ getTypeLabel(item.type) }}</span>
            </td>
            <td class="name-cell">{{ item.title }}</td>
            <td>{{ item.expiry_date }}</td>
            <td :class="item.daysLeft <= 7 ? 'days-critical' : 'days-warning'">{{ item.daysLeft }}天</td>
            <td>
              <span class="tag" :class="item.daysLeft <= 7 ? 'red' : 'orange'">
                {{ item.daysLeft <= 7 ? '即将过期' : '30天内到期' }}
              </span>
            </td>
            <td><span class="action-link" @click="goDetail(item)">去处理</span></td>
          </tr>
        </tbody>
      </table>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../utils/request'

const router = useRouter()
const loading = ref(false)
const warningsRef = ref(null)

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id
const username = user.username || '用户'

// ===== 问候 =====
const currentDateTime = ref('')
let timeTimer = null

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h >= 5 && h < 12) return '早上好'
  if (h >= 12 && h < 18) return '下午好'
  return '晚上好'
})

const systemStatus = computed(() => {
  const urgent = warnings.value.filter(w => w.daysLeft <= 7).length
  if (urgent > 0) return { text: `${urgent} 项即将到期,请及时处理`, class: 'warn' }
  const total = warnings.value.length
  if (total > 0) return { text: `共 ${total} 项近期到期,请关注`, class: 'info' }
  return { text: '系统运行正常', class: 'ok' }
})

const updateTime = () => {
  const now = new Date()
  const weekMap = ['日', '一', '二', '三', '四', '五', '六']
  currentDateTime.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${weekMap[now.getDay()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

// ===== 数据 =====
const stats = reactive({
  certificates: { total: 0, valid: 0, expiring_soon: 0, expired: 0 },
  healthCerts: { total: 0, valid: 0, expiring_soon: 0, expired: 0 },
  complaints: { total: 0, processing: 0, urgent: 0 }
})

const warnings = ref([])
const healthScore = ref(null)
const healthLoading = ref(false)

// ===== 统计卡片 =====
const statCards = computed(() => [
  {
    label: '资质总数',
    value: stats.certificates.total,
    color: 'blue', valueRed: false, trendDir: 'up', trendText: '管理',
    paths: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'],
    polylines: ['14 2 14 8 20 8'],
    circles: [], lines: [], rects: [],
    onClick: () => router.push('/credentials')
  },
  {
    label: '资质异常',
    value: stats.certificates.expiring_soon + stats.certificates.expired,
    color: 'red', valueRed: true, trendDir: 'up', trendText: '待处理',
    paths: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'],
    lines: [{ x1: 12, y1: 9, x2: 12, y2: 13 }, { x1: 12, y1: 17, x2: 12.01, y2: 17 }],
    circles: [], polylines: [], rects: [],
    onClick: () => router.push('/credentials')
  },
  {
    label: '员工总数',
    value: stats.healthCerts.total,
    color: 'green', valueRed: false, trendDir: 'up', trendText: '在职',
    paths: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'],
    circles: [{ cx: 9, cy: 7, r: 4 }],
    lines: [], polylines: [], rects: [],
    onClick: () => router.push('/personnel')
  },
  {
    label: '健康证异常',
    value: stats.healthCerts.expiring_soon + stats.healthCerts.expired,
    color: 'orange', valueRed: true, trendDir: 'up', trendText: '待处理',
    paths: ['M22 11.08V12a10 10 0 1 1-5.93-9.14'],
    polylines: ['22 4 12 14.01 9 11.01'],
    circles: [], lines: [], rects: [],
    onClick: () => router.push('/personnel/health')
  },
  {
    label: '待处理客诉',
    value: stats.complaints.processing,
    color: 'purple', valueRed: stats.complaints.urgent > 0, trendDir: 'down', trendText: stats.complaints.urgent > 0 ? `紧急 ${stats.complaints.urgent}` : '本月',
    paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    circles: [], lines: [], polylines: [], rects: [],
    onClick: () => router.push('/complaint/list')
  }
])

// ===== 图表：从 warnings 中统计近 7 天每天到期数量 =====
const chartBars = computed(() => {
  const now = new Date()
  const days = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(now)
    d.setDate(d.getDate() + i)
    const dateStr = d.toISOString().slice(0, 10)
    const weekMap = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
    days.push({ dateStr, label: i === 0 ? '今天' : weekMap[d.getDay()], count: 0 })
  }

  warnings.value.forEach(w => {
    const day = days.find(d => d.dateStr === w.expiry_date)
    if (day) day.count++
  })

  const maxCount = Math.max(...days.map(d => d.count), 1)
  const colors = [
    'linear-gradient(180deg, #5b8def, #93c5fd)',
    'linear-gradient(180deg, #6366f1, #a5b4fc)',
    'linear-gradient(180deg, #8b5cf6, #c4b5fd)',
    'linear-gradient(180deg, #10b981, #6ee7b7)',
    'linear-gradient(180deg, #f59e0b, #fcd34d)',
    'linear-gradient(180deg, #ef4444, #fca5a5)',
    'linear-gradient(180deg, #ec4899, #f9a8d4)'
  ]

  return days.map((d, i) => ({
    label: d.label,
    count: d.count,
    height: Math.max(d.count > 0 ? (d.count / maxCount) * 85 + 10 : 4, 4) + '%',
    bg: d.count > 0 ? colors[i] : 'linear-gradient(180deg, #e5e7eb, #d1d5db)'
  }))
})

// ===== 健康指数相关 =====
const dashArray = computed(() => {
  if (!healthScore.value) return '0 553'
  const len = (healthScore.value.total_score / 100) * 553
  return `${len} 553`
})

const levelDesc = computed(() => {
  if (!healthScore.value) return ''
  const map = { '优秀': '食安体系运行良好', '良好': '有少量需关注项', '关注': '存在风险项，建议处理', '警告': '存在严重问题，需立即处理' }
  return map[healthScore.value.level] || ''
})

const dimColor = (score) => {
  if (score >= 90) return '#16a34a'
  if (score >= 75) return '#2563eb'
  if (score >= 60) return '#ea580c'
  return '#dc2626'
}

const fetchHealthScore = async () => {
  healthLoading.value = true
  try {
    const res = await request.get('/dashboard/health-score', { params: { user_id: userId } })
    healthScore.value = res
  } catch {
    // ignore
  } finally {
    healthLoading.value = false
  }
}

// ===== 类型标签映射 =====
const getTypeLabel = (type) => {
  const map = {
    certificate: '资质', health_cert: '健康证',
    pest_supplier_doc: '虫害供应商', pest_staff_cert: '虫害人员',
    product_report: '产品报告', training_cert: '培训证书'
  }
  return map[type] || type
}

const getTypeTagClass = (type) => {
  const map = {
    certificate: 'tag-blue', health_cert: 'tag-green',
    pest_supplier_doc: 'tag-amber', pest_staff_cert: 'tag-amber',
    product_report: 'tag-purple', training_cert: 'tag-slate'
  }
  return map[type] || 'tag-blue'
}

// ===== 数据加载 =====
const fetchStats = async () => {
  loading.value = true
  try {
    const res = await request.get('/dashboard/stats', { params: { user_id: userId } })
    stats.certificates = res.certificates
    stats.healthCerts = res.healthCerts
    stats.complaints = res.complaints || { total: 0, processing: 0, urgent: 0 }
    warnings.value = res.warnings
  } catch {
    // 错误在拦截器处理
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  fetchStats()
  fetchHealthScore()
})

onUnmounted(() => {
  clearInterval(timeTimer)
})

// ===== 导航 =====
const scrollToWarnings = () => {
  if (warningsRef.value) {
    warningsRef.value.scrollIntoView({ behavior: 'smooth' })
  }
}

const goMaterialInspection = () => router.push('/raw-material/product-standards')
const goLabelAudit = () => router.push('/ai-audit/label')
const goAddCredential = () => router.push('/credentials?action=add')
const goAddHealthCert = () => router.push('/health-certs?action=add')
const goComplaint = () => router.push('/complaint/list')
const goPestService = () => router.push('/third-party/pest')
const goCalibrationRecord = () => router.push('/third-party/calibration')

const goDetail = (item) => {
  const typeMap = {
    certificate: '/credentials',
    health_cert: '/health-certs',
    pest_supplier_doc: '/third-party/pest',
    pest_staff_cert: '/third-party/pest',
    product_report: '/raw-material/product-standards',
    training_cert: '/training/certs'
  }
  const path = typeMap[item.type] || '/credentials'
  router.push(path)
}
</script>

<style scoped>
/* ===== 布局 ===== */
.dashboard { padding: 28px; }

/* ===== 顶部问候区 ===== */
.greeting-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 24px;
  padding: 20px 28px;
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  border-radius: 16px;
  color: white;
}
.greeting-left { flex: 1; }
.greeting-text {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 0.5px;
}
.greeting-date {
  margin: 6px 0 0 0;
  font-size: 13px;
  opacity: 0.85;
}
.system-status {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 20px;
  font-size: 13px;
  font-weight: 500;
  background: rgba(255,255,255,0.2);
  backdrop-filter: blur(4px);
  white-space: nowrap;
}
.system-status.ok  { background: rgba(16,185,129,0.3); }
.system-status.info { background: rgba(96,165,250,0.3); }
.system-status.warn { background: rgba(239,68,68,0.35); animation: pulse 2s infinite; }
.status-dot {
  width: 8px; height: 8px; border-radius: 50%; display: inline-block;
}
.system-status.ok .status-dot  { background: #34d399; }
.system-status.info .status-dot { background: #93c5fd; }
.system-status.warn .status-dot { background: #fca5a5; }
@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.7; }
}

/* ===== 健康指数仪表盘 ===== */
.health-score-section {
  background: white; border-radius: 16px; padding: 28px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.04);
  margin-bottom: 24px;
}
.health-loading { display: flex; justify-content: center; padding: 60px; margin-bottom: 24px; background: white; border-radius: 16px; }
.health-main { display: flex; align-items: center; gap: 40px; margin-bottom: 28px; }
.health-gauge { flex-shrink: 0; }
.gauge-svg { width: 180px; height: 180px; }
.gauge-score { font-size: 42px; font-weight: 800; }
.gauge-label { font-size: 14px; fill: #9ca3af; }
.health-info { flex: 1; }
.health-level { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
.level-badge { padding: 6px 20px; border-radius: 20px; color: white; font-size: 16px; font-weight: 700; }
.level-desc { font-size: 14px; color: #6b7280; }
.health-trend { font-size: 14px; color: #9ca3af; }
.trend-up { color: #16a34a; font-weight: 600; }
.trend-down { color: #dc2626; font-weight: 600; }
.trend-flat { color: #9ca3af; }
.trend-label { margin-left: 4px; }
.health-dims { display: grid; grid-template-columns: repeat(5, 1fr); gap: 14px; }
.dim-card {
  padding: 16px; border-radius: 12px; background: #f9fafb;
  cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.dim-card:hover { transform: translateY(-2px); box-shadow: 0 4px 12px rgba(0,0,0,0.06); border-color: #d1d5db; }
.dim-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
.dim-name { font-size: 13px; font-weight: 600; color: #374151; }
.dim-weight { font-size: 11px; color: #9ca3af; background: #e5e7eb; padding: 1px 8px; border-radius: 8px; }
.dim-score-row { display: flex; align-items: baseline; gap: 2px; margin-bottom: 8px; }
.dim-score { font-size: 28px; font-weight: 800; }
.dim-max { font-size: 13px; color: #9ca3af; }
.dim-detail { font-size: 12px; color: #6b7280; margin-top: 6px; }

/* ===== 统计卡片 ===== */
.stats-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card {
  background: white; border-radius: 14px; padding: 22px;
  display: flex; align-items: flex-start; gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.04);
  transition: all 0.2s; cursor: pointer;
}
.stat-card:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(0,0,0,0.06); }
.stat-icon { width: 46px; height: 46px; border-radius: 12px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
.stat-icon svg { width: 22px; height: 22px; }
.stat-icon.blue   { background: #e8f0fe; color: #5b8def; }
.stat-icon.red    { background: #fef2f2; color: #ef4444; }
.stat-icon.green  { background: #ecfdf5; color: #10b981; }
.stat-icon.orange { background: #fff7ed; color: #f59e0b; }
.stat-icon.purple { background: #faf5ff; color: #8b5cf6; }
.stat-info { flex: 1; min-width: 0; }
.stat-label { font-size: 13px; color: #8c8ca0; margin-bottom: 6px; }
.stat-value { font-size: 28px; font-weight: 700; color: #1a1a2e; line-height: 1; }
.stat-value.red { color: #ef4444; }
.stat-trend { display: flex; align-items: center; gap: 4px; margin-top: 8px; font-size: 12px; color: #8c8ca0; }

/* ===== 快捷操作 + 图表 ===== */
.content-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 16px; margin-bottom: 24px; }
.section-card {
  background: white; border-radius: 14px; padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04); border: 1px solid rgba(0,0,0,0.04);
  position: relative;
}
.section-title {
  font-size: 16px; font-weight: 600; color: #1a1a2e; margin-bottom: 16px;
  display: flex; align-items: center; justify-content: space-between;
}
.section-title .more { font-size: 13px; color: #5b8def; cursor: pointer; }
.section-title .badge { font-size: 12px; background: #fef2f2; color: #ef4444; padding: 2px 10px; border-radius: 10px; font-weight: 500; }

/* 快捷操作 */
.quick-actions { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
.quick-section .quick-actions { grid-template-columns: 1fr 1fr; }
.quick-action {
  display: flex; align-items: center; gap: 10px; padding: 12px;
  border-radius: 10px; cursor: pointer; transition: all 0.2s; border: 1px solid transparent;
}
.quick-action:hover { transform: translateX(3px); }
.quick-action.blue    { background: linear-gradient(135deg, #f0f5ff, #e8f0fe); }
.quick-action.blue:hover    { border-color: #5b8def; }
.quick-action.green   { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
.quick-action.green:hover   { border-color: #10b981; }
.quick-action.orange  { background: linear-gradient(135deg, #fff7ed, #fed7aa); }
.quick-action.orange:hover  { border-color: #f59e0b; }
.quick-action.purple  { background: linear-gradient(135deg, #f5f3ff, #ede9fe); }
.quick-action.purple:hover  { border-color: #8b5cf6; }
.quick-action.emerald { background: linear-gradient(135deg, #ecfdf5, #a7f3d0); }
.quick-action.emerald:hover { border-color: #059669; }
.quick-action.amber   { background: linear-gradient(135deg, #fffbeb, #fde68a); }
.quick-action.amber:hover   { border-color: #d97706; }
.quick-action.slate   { background: linear-gradient(135deg, #f8fafc, #e2e8f0); }
.quick-action.slate:hover   { border-color: #64748b; }
.quick-action-icon {
  width: 36px; height: 36px; border-radius: 8px;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
}
.quick-action.blue .quick-action-icon    { background: white; color: #5b8def; }
.quick-action.green .quick-action-icon   { background: white; color: #10b981; }
.quick-action.orange .quick-action-icon  { background: white; color: #f59e0b; }
.quick-action.purple .quick-action-icon  { background: white; color: #8b5cf6; }
.quick-action.emerald .quick-action-icon { background: white; color: #059669; }
.quick-action.amber .quick-action-icon   { background: white; color: #d97706; }
.quick-action.slate .quick-action-icon   { background: white; color: #64748b; }
.quick-action-icon svg { width: 18px; height: 18px; }
.quick-action-text { flex: 1; min-width: 0; }
.quick-action-text .title { font-size: 13px; font-weight: 600; color: #1a1a2e; }
.quick-action-text .desc  { font-size: 11px; color: #8c8ca0; margin-top: 1px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

/* 图表区 */
.chart-placeholder { height: 180px; display: flex; flex-direction: column; justify-content: flex-end; }
.chart-empty { text-align: center; padding: 40px 0; }
.chart-empty .empty-icon { font-size: 40px; margin-bottom: 8px; }
.chart-empty .empty-text { font-size: 14px; color: #8c8ca0; }
.chart-bars { display: flex; align-items: flex-end; gap: 12px; padding: 0 8px; height: 100%; }
.chart-bar-group { flex: 1; display: flex; flex-direction: column; align-items: center; gap: 6px; height: 100%; justify-content: flex-end; }
.chart-bar {
  width: 100%; max-width: 44px; border-radius: 6px 6px 2px 2px;
  transition: all 0.3s; cursor: pointer; min-height: 4px;
  display: flex; align-items: flex-start; justify-content: center;
  position: relative;
}
.chart-bar:hover { opacity: 0.85; transform: scaleY(1.05); transform-origin: bottom; }
.bar-count { font-size: 11px; font-weight: 700; color: white; padding-top: 4px; text-shadow: 0 1px 2px rgba(0,0,0,0.2); }
.chart-bar-label { font-size: 11px; color: #8c8ca0; }

/* ===== 预警表格 ===== */
.warning-table { width: 100%; border-collapse: collapse; }
.warning-table th {
  text-align: left; padding: 14px 16px; font-size: 13px;
  font-weight: 500; color: #8c8ca0; border-bottom: 1px solid #eee; background: #fafbfc;
}
.warning-table td { padding: 14px 16px; font-size: 14px; border-bottom: 1px solid #f0f0f0; color: #1a1a2e; }
.warning-table tr:hover td { background: #f9fafb; }
.name-cell { font-weight: 500; }
.days-critical { color: #ef4444; font-weight: 600; }
.days-warning { color: #f59e0b; font-weight: 600; }
.action-link { color: #5b8def; cursor: pointer; font-size: 13px; }
.action-link:hover { text-decoration: underline; }

/* 标签 */
.tag { display: inline-block; padding: 3px 10px; border-radius: 6px; font-size: 12px; font-weight: 500; }
.tag.red    { background: #fef2f2; color: #ef4444; }
.tag.orange { background: #fff7ed; color: #f59e0b; }
.tag.green  { background: #ecfdf5; color: #10b981; }
.tag.blue   { background: #e8f0fe; color: #5b8def; }
.tag-green  { background: #ecfdf5; color: #10b981; }
.tag-amber  { background: #fffbeb; color: #d97706; }
.tag-purple { background: #f5f3ff; color: #8b5cf6; }
.tag-slate  { background: #f8fafc; color: #64748b; }

/* ===== 加载/空状态 ===== */
.loading-overlay { display: flex; align-items: center; justify-content: center; padding: 60px; }
.spinner { width: 32px; height: 32px; border: 3px solid #e8e8f0; border-top-color: #5b8def; border-radius: 50%; animation: spin 0.6s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.empty-state { text-align: center; padding: 48px 20px; }
.empty-state svg { width: 64px; height: 64px; color: #d0d0e0; margin-bottom: 16px; }
.empty-state .title { font-size: 15px; color: #4a4a5a; margin-bottom: 8px; }
.empty-state .desc { font-size: 13px; color: #8c8ca0; }

/* ===== 响应式 ===== */
@media (max-width: 1200px) {
  .stats-grid { grid-template-columns: repeat(3, 1fr); }
  .quick-actions { grid-template-columns: 1fr; }
}
@media (max-width: 768px) {
  .dashboard { padding: 16px; }
  .greeting-bar { flex-direction: column; align-items: flex-start; gap: 12px; padding: 16px 20px; }
  .greeting-text { font-size: 18px; }
  .stats-grid { grid-template-columns: repeat(2, 1fr); }
  .content-grid { grid-template-columns: 1fr; }
  .quick-actions { grid-template-columns: 1fr 1fr; }
  .stat-card { padding: 16px; gap: 12px; }
  .stat-value { font-size: 24px; }
}
@media (max-width: 480px) {
  .stats-grid { grid-template-columns: 1fr; }
  .quick-actions { grid-template-columns: 1fr; }
}
</style>
