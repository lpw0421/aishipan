<template>
  <div class="dashboard">
    <!-- ===== 统计卡片 ===== -->
    <div class="stats-grid">
      <div class="stat-card" v-for="card in statCards" :key="card.label">
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline :points="card.trendDir === 'up' ? '23 6 13.5 15.5 8.5 10.5 1 18' : '23 18 13.5 8.5 8.5 13.5 1 6'"/></svg>
            <span>{{ card.trendText }}</span>
            <span class="label">较上周</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 快捷操作 + 趋势图 ===== -->
    <div class="content-grid">
      <div class="section-card">
        <div class="section-title">快捷操作</div>
        <div class="quick-actions">
          <div class="quick-action blue" @click="goAddCredential">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">新增资质</div>
              <div class="desc">添加供应商资质信息</div>
            </div>
            <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="quick-action green" @click="goAddHealthCert">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">录入健康证</div>
              <div class="desc">登记员工健康证信息</div>
            </div>
            <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
          <div class="quick-action orange" @click="goComplaint">
            <div class="quick-action-icon">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            </div>
            <div class="quick-action-text">
              <div class="title">新增客诉</div>
              <div class="desc">记录客户投诉信息</div>
            </div>
            <svg class="arrow" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>
      </div>

      <div class="section-card">
        <div class="section-title">
          近7天到期趋势
          <span class="more">查看全部</span>
        </div>
        <div class="chart-placeholder">
          <div class="chart-bars">
            <div class="chart-bar-group" v-for="bar in chartBars" :key="bar.label">
              <div class="chart-bar" :style="{ height: bar.height, background: bar.bg || 'linear-gradient(180deg, #5b8def, #93c5fd)' }"></div>
              <div class="chart-bar-label">{{ bar.label }}</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- ===== 即将过期预警 ===== -->
    <div class="section-card">
      <div class="section-title">
        即将过期预警（30天内）
        <span class="badge">{{ warnings.length }} 项</span>
      </div>

      <!-- 加载中 -->
      <div class="loading-overlay" v-if="loading">
        <div class="spinner"></div>
      </div>

      <!-- 空状态 -->
      <div class="empty-state" v-else-if="!loading && warnings.length === 0">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
          <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
          <polyline points="22 4 12 14.01 9 11.01"/>
        </svg>
        <div class="title">暂无即将到期项</div>
        <div class="desc">所有资质和健康证均在有效期内</div>
      </div>

      <!-- 预警表格 -->
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
              <span class="tag" :class="item.type === 'certificate' ? 'tag-blue' : 'tag-green'">
                {{ item.type === 'certificate' ? '资质' : '健康证' }}
              </span>
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
import { ref, reactive, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import request from '../utils/request'

const router = useRouter()
const loading = ref(false)

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

const stats = reactive({
  certificates: { total: 0, valid: 0, expiring_soon: 0, expired: 0 },
  healthCerts: { total: 0, valid: 0, expiring_soon: 0, expired: 0 },
  complaints: null
})

const warnings = ref([])

// 统计卡片配置
const statCards = computed(() => [
  {
    label: '资质总数',
    value: stats.certificates.total,
    color: 'blue',
    valueRed: false,
    trendDir: 'up',
    trendText: '管理',
    paths: ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z'],
    polylines: ['14 2 14 8 20 8'],
    circles: [], lines: [], rects: []
  },
  {
    label: '资质异常',
    value: stats.certificates.expiring_soon + stats.certificates.expired,
    color: 'red',
    valueRed: true,
    trendDir: 'up',
    trendText: '待处理',
    paths: ['M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'],
    lines: [{ x1: 12, y1: 9, x2: 12, y2: 13 }, { x1: 12, y1: 17, x2: 12.01, y2: 17 }],
    circles: [], polylines: [], rects: []
  },
  {
    label: '员工总数',
    value: stats.healthCerts.total,
    color: 'green',
    valueRed: false,
    trendDir: 'up',
    trendText: '在职',
    paths: ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2'],
    circles: [{ cx: 9, cy: 7, r: 4 }],
    lines: [], polylines: [], rects: []
  },
  {
    label: '健康证异常',
    value: stats.healthCerts.expiring_soon + stats.healthCerts.expired,
    color: 'orange',
    valueRed: true,
    trendDir: 'up',
    trendText: '待处理',
    paths: ['M22 11.08V12a10 10 0 1 1-5.93-9.14'],
    polylines: ['22 4 12 14.01 9 11.01'],
    circles: [], lines: [], rects: []
  },
  {
    label: '客诉总数',
    value: stats.complaints ? stats.complaints.total : 0,
    color: 'purple',
    valueRed: false,
    trendDir: 'down',
    trendText: '本月',
    paths: ['M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'],
    circles: [], lines: [], polylines: [], rects: []
  }
])

// 图表柱状条
const chartBars = [
  { label: '周一', height: '60%' },
  { label: '周二', height: '40%' },
  { label: '周三', height: '80%' },
  { label: '周四', height: '55%' },
  { label: '周五', height: '70%' },
  { label: '周六', height: '35%', bg: 'linear-gradient(180deg,#f59e0b,#fbbf24)' },
  { label: '周日', height: '25%', bg: 'linear-gradient(180deg,#f59e0b,#fbbf24)' }
]

const fetchStats = async () => {
  loading.value = true
  try {
    const res = await request.get('/dashboard/stats', { params: { user_id: userId } })
    stats.certificates = res.certificates
    stats.healthCerts = res.healthCerts
    stats.complaints = res.complaints
    warnings.value = res.warnings
  } catch {
    // 错误在拦截器处理
  } finally {
    loading.value = false
  }
}

onMounted(fetchStats)

const goAddCredential = () => {
  router.push('/credentials?action=add')
}

const goAddHealthCert = () => {
  router.push('/health-certs?action=add')
}

const goComplaint = () => {
  router.push('/complaint/list')
}

const goDetail = (item) => {
  if (item.type === 'certificate') {
    router.push('/credentials')
  } else {
    router.push('/health-certs')
  }
}
</script>

<style scoped>
/* ===== 布局 ===== */
.dashboard {
  padding: 28px;
}

/* ===== 统计卡片 ===== */
.stats-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  margin-bottom: 24px;
}

.stat-card {
  background: white;
  border-radius: 14px;
  padding: 22px;
  display: flex;
  align-items: flex-start;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.04);
  transition: all 0.2s;
  cursor: pointer;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 20px rgba(0,0,0,0.06);
}

.stat-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.stat-icon svg { width: 22px; height: 22px; }

.stat-icon.blue   { background: #e8f0fe; color: #5b8def; }
.stat-icon.red    { background: #fef2f2; color: #ef4444; }
.stat-icon.green  { background: #ecfdf5; color: #10b981; }
.stat-icon.orange { background: #fff7ed; color: #f59e0b; }
.stat-icon.purple { background: #faf5ff; color: #8b5cf6; }

.stat-info { flex: 1; min-width: 0; }

.stat-label {
  font-size: 13px;
  color: #8c8ca0;
  margin-bottom: 6px;
}

.stat-value {
  font-size: 28px;
  font-weight: 700;
  color: #1a1a2e;
  line-height: 1;
}

.stat-value.red { color: #ef4444; }

.stat-trend {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 8px;
  font-size: 12px;
}

.stat-trend.up   { color: #ef4444; }
.stat-trend.down { color: #10b981; }

.stat-trend svg { width: 14px; height: 14px; }
.stat-trend .label { color: #8c8ca0; }

/* ===== 快捷操作 + 图表 ===== */
.content-grid {
  display: grid;
  grid-template-columns: 1fr 2fr;
  gap: 16px;
  margin-bottom: 24px;
}

.section-card {
  background: white;
  border-radius: 14px;
  padding: 24px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
  border: 1px solid rgba(0,0,0,0.04);
  position: relative;
}

.section-title {
  font-size: 16px;
  font-weight: 600;
  color: #1a1a2e;
  margin-bottom: 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.section-title .more {
  font-size: 13px;
  color: #5b8def;
  cursor: pointer;
}

.section-title .badge {
  font-size: 12px;
  background: #fef2f2;
  color: #ef4444;
  padding: 2px 10px;
  border-radius: 10px;
  font-weight: 500;
}

/* 快捷操作 */
.quick-actions {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.quick-action {
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 16px;
  border-radius: 12px;
  cursor: pointer;
  transition: all 0.2s;
  border: 1px solid transparent;
}

.quick-action:hover {
  transform: translateX(4px);
}

.quick-action.blue   { background: linear-gradient(135deg, #f0f5ff, #e8f0fe); }
.quick-action.blue:hover   { border-color: #5b8def; }
.quick-action.green  { background: linear-gradient(135deg, #ecfdf5, #d1fae5); }
.quick-action.green:hover  { border-color: #10b981; }
.quick-action.orange { background: linear-gradient(135deg, #fff7ed, #fed7aa); }
.quick-action.orange:hover { border-color: #f59e0b; }

.quick-action-icon {
  width: 42px;
  height: 42px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.quick-action.blue .quick-action-icon   { background: white; color: #5b8def; }
.quick-action.green .quick-action-icon  { background: white; color: #10b981; }
.quick-action.orange .quick-action-icon { background: white; color: #f59e0b; }

.quick-action-icon svg { width: 20px; height: 20px; }

.quick-action-text { flex: 1; }
.quick-action-text .title { font-size: 14px; font-weight: 600; color: #1a1a2e; }
.quick-action-text .desc  { font-size: 12px; color: #8c8ca0; margin-top: 2px; }

.quick-action .arrow {
  color: #d0d0e0;
  transition: all 0.2s;
  flex-shrink: 0;
}

.quick-action:hover .arrow {
  color: #5b8def;
  transform: translateX(2px);
}

/* 图表区 */
.chart-placeholder {
  height: 200px;
  display: flex;
  flex-direction: column;
}

.chart-bars {
  flex: 1;
  display: flex;
  align-items: flex-end;
  gap: 12px;
  padding: 0 8px;
}

.chart-bar-group {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.chart-bar {
  width: 100%;
  max-width: 40px;
  border-radius: 6px 6px 2px 2px;
  transition: all 0.3s;
  cursor: pointer;
  min-height: 4px;
}

.chart-bar:hover { opacity: 0.8; }

.chart-bar-label {
  font-size: 11px;
  color: #8c8ca0;
}

/* ===== 预警表格 ===== */
.warning-table {
  width: 100%;
  border-collapse: collapse;
}

.warning-table th {
  text-align: left;
  padding: 14px 16px;
  font-size: 13px;
  font-weight: 500;
  color: #8c8ca0;
  border-bottom: 1px solid #eee;
  background: #fafbfc;
}

.warning-table td {
  padding: 14px 16px;
  font-size: 14px;
  border-bottom: 1px solid #f0f0f0;
  color: #1a1a2e;
}

.warning-table tr:hover td { background: #f9fafb; }

.name-cell {
  font-weight: 500;
}

.days-critical {
  color: #ef4444;
  font-weight: 600;
}

.days-warning {
  color: #f59e0b;
  font-weight: 600;
}

.action-link {
  color: #5b8def;
  cursor: pointer;
  font-size: 13px;
}

.action-link:hover { text-decoration: underline; }

/* 标签 */
.tag {
  display: inline-block;
  padding: 3px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.tag.red    { background: #fef2f2; color: #ef4444; }
.tag.orange { background: #fff7ed; color: #f59e0b; }
.tag.green  { background: #ecfdf5; color: #10b981; }
.tag.blue   { background: #e8f0fe; color: #5b8def; }
.tag-green  { background: #ecfdf5; color: #10b981; }

/* ===== 加载状态 ===== */
.loading-overlay {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 60px;
}

.spinner {
  width: 32px;
  height: 32px;
  border: 3px solid #e8e8f0;
  border-top-color: #5b8def;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 空状态 ===== */
.empty-state {
  text-align: center;
  padding: 48px 20px;
}

.empty-state svg {
  width: 64px;
  height: 64px;
  color: #d0d0e0;
  margin-bottom: 16px;
}

.empty-state .title {
  font-size: 15px;
  color: #4a4a5a;
  margin-bottom: 8px;
}

.empty-state .desc {
  font-size: 13px;
  color: #8c8ca0;
}

/* ===== 响应式 ===== */
@media (max-width: 1200px) {
  .stats-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

@media (max-width: 768px) {
  .dashboard {
    padding: 16px;
  }
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
  .content-grid {
    grid-template-columns: 1fr;
  }
  .stat-card {
    padding: 16px;
    gap: 12px;
  }
  .stat-value {
    font-size: 24px;
  }
}

@media (max-width: 480px) {
  .stats-grid {
    grid-template-columns: 1fr;
  }
}
</style>
