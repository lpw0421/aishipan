<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>客诉看板</h2>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="4">
        <div class="stat-card stat-total">
          <div class="stat-number">{{ stats.total }}</div>
          <div class="stat-label">本月客诉</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card stat-processing">
          <div class="stat-number">{{ stats.processing }}</div>
          <div class="stat-label">处理中</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card stat-closed">
          <div class="stat-number">{{ stats.closed }}</div>
          <div class="stat-label">已关闭</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card stat-urgent" :class="{ blink: stats.urgent > 0 }">
          <div class="stat-number">{{ stats.urgent }}</div>
          <div class="stat-label">🔴 紧急客诉</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card stat-satisfaction">
          <div class="stat-number">{{ stats.avgSatisfaction || '-' }}</div>
          <div class="stat-label">客户满意度</div>
        </div>
      </el-col>
      <el-col :span="4">
        <div class="stat-card stat-time">
          <div class="stat-number">{{ stats.avgDays || '-' }}</div>
          <div class="stat-label">平均处理天数</div>
        </div>
      </el-col>
    </el-row>

    <!-- 图表 -->
    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-header">📈 客诉趋势（近6个月）</span></template>
          <div class="chart-box">
            <div class="bar-chart">
              <div v-for="m in monthlyTrend" :key="m.month" class="bar-col">
                <div class="bar-val">{{ m.cnt }}</div>
                <div class="bar-fill" :style="{height: barHeight(m.cnt)+'px'}"></div>
                <div class="bar-label">{{ m.month.slice(5) }}月</div>
              </div>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-header">🎯 客诉类型分布</span></template>
          <div class="type-list">
            <div v-for="t in byType" :key="t.complaint_type" class="type-item">
              <span class="type-name">{{ t.complaint_type }}</span>
              <span class="type-count">{{ t.cnt }}</span>
              <el-progress :percentage="typePercent(t.cnt)" :stroke-width="8" :color="typeColor(t.complaint_type)" />
            </div>
          </div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 紧急客诉列表 -->
    <el-card v-if="urgentList.length > 0" shadow="hover" style="margin-top:16px">
      <template #header><span class="card-header" style="color:#f56c6c">🔴 待处理紧急客诉</span></template>
      <el-table :data="urgentList" border stripe size="small">
        <el-table-column prop="complaint_number" label="编号" width="160" />
        <el-table-column prop="customer_name" label="投诉人" width="80" />
        <el-table-column prop="problem_desc" label="问题摘要" min-width="200">
          <template #default="{row}">{{ row.problem_desc?.slice(0, 50) }}{{ row.problem_desc?.length > 50 ? '...' : '' }}</template>
        </el-table-column>
        <el-table-column prop="product_name" label="关联产品" width="120" />
        <el-table-column prop="complaint_date" label="投诉日期" width="110" />
        <el-table-column label="等待时间" width="100">
          <template #default="{row}">
            <el-tag type="danger">{{ waitDays(row.complaint_date) }}天</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="100">
          <template #default="{row}">
            <el-button type="primary" size="small" @click="$router.push('/complaint/handle?id='+row.id)">处理</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import request from '../../utils/request'

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

const stats = ref({ total: 0, processing: 0, closed: 0, urgent: 0, avgSatisfaction: 0, avgDays: 0 })
const byType = ref([])
const monthlyTrend = ref([])
const urgentList = ref([])

const barHeight = (cnt) => {
  const values = monthlyTrend.value.map(m => m.cnt)
  const max = values.length > 0 ? Math.max(...values) : 1
  return Math.max(20, Math.round((cnt / Math.max(max, 1)) * 160))
}

const typePercent = (cnt) => {
  const total = byType.value.reduce((s, t) => s + t.cnt, 0)
  return total > 0 ? Math.round(cnt / total * 100) : 0
}

const typeColor = (type) => {
  const map = { '异物': '#f56c6c', '变质': '#f56c6c', '过敏': '#f56c6c', '标签错误': '#e6a23c', '包装破损': '#e6a23c', '缺斤少两': '#409eff', '服务态度': '#67c23a' }
  return map[type] || '#909399'
}

const waitDays = (date) => {
  return Math.ceil((new Date() - new Date(date)) / (1000 * 60 * 60 * 24))
}

const fetchData = async () => {
  try {
    const res = await request.get('/complaints/stats', { params: { user_id: userId } })
    stats.value = res
    byType.value = res.byType || []
    monthlyTrend.value = res.monthlyTrend || []
  } catch {}

  // 获取紧急客诉列表
  try {
    const res = await request.get('/complaints', {
      params: { user_id: userId, urgency: '紧急', status: '待处理' }
    })
    urgentList.value = res.list || []
  } catch {}
}

onMounted(fetchData)
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.stats-row .el-col { margin-bottom:8px }
.stat-card { text-align:center; padding:20px 0; border-radius:8px; color:#fff }
.stat-card.stat-total { background:linear-gradient(135deg,#409eff,#66b1ff) }
.stat-card.stat-processing { background:linear-gradient(135deg,#e6a23c,#ebb563) }
.stat-card.stat-closed { background:linear-gradient(135deg,#67c23a,#85ce61) }
.stat-card.stat-urgent { background:linear-gradient(135deg,#f56c6c,#f89898) }
.stat-card.stat-urgent.blink { animation:blink 1s infinite }
.stat-card.stat-satisfaction { background:linear-gradient(135deg,#409eff,#66b1ff) }
.stat-card.stat-time { background:linear-gradient(135deg,#909399,#b4b4b4) }
.stat-number { font-size:32px; font-weight:bold }
.stat-label { font-size:13px; margin-top:4px; opacity:.9 }
@keyframes blink { 50% { opacity:.6 } }
.chart-box { padding:10px 0 }
.bar-chart { display:flex; justify-content:space-around; align-items:flex-end; height:200px }
.bar-col { display:flex; flex-direction:column; align-items:center; gap:4px }
.bar-val { font-size:13px; font-weight:bold; color:#303133 }
.bar-fill { width:40px; background:linear-gradient(to top,#409eff,#66b1ff); border-radius:4px 4px 0 0; min-height:4px; transition:height .3s }
.bar-label { font-size:12px; color:#909399 }
.type-list { max-height:300px; overflow-y:auto }
.type-item { padding:8px 0; display:flex; align-items:center; gap:10px; flex-wrap:wrap }
.type-name { width:70px; font-size:13px; color:#606266 }
.type-count { width:30px; font-size:14px; font-weight:bold; color:#303133 }
.type-item :deep(.el-progress) { flex:1; min-width:80px }
</style>
