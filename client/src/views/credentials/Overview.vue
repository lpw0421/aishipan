<template>
  <div class="page-container">
    <h2 style="margin-bottom:16px">资质总览</h2>

    <!-- 自有资质 -->
    <el-card class="section-card">
      <template #header><span style="font-weight:bold">📋 自有资质</span></template>
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="overview-stat stat-normal"><div class="overview-num">{{ ownStats.total }}</div><div class="overview-label">自有证照</div></div>
        </el-col>
        <el-col :span="8">
          <div class="overview-stat stat-valid"><div class="overview-num">{{ ownStats.valid }}</div><div class="overview-label">正常</div></div>
        </el-col>
        <el-col :span="8">
          <div class="overview-stat" :class="ownStats.expiringSoon > 0 ? 'stat-warning' : ''"><div class="overview-num">{{ ownStats.expiringSoon }}</div><div class="overview-label">临期 ≤30天</div></div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 供应商资质 -->
    <el-card class="section-card">
      <template #header><span style="font-weight:bold">🏢 供应商资质</span></template>
      <el-row :gutter="16">
        <el-col :span="8">
          <div class="overview-stat"><div class="overview-num">{{ supplierStats.total }}</div><div class="overview-label">证照总数</div></div>
        </el-col>
        <el-col :span="8">
          <div class="overview-stat stat-valid"><div class="overview-num">{{ supplierStats.valid }}</div><div class="overview-label">正常</div></div>
        </el-col>
        <el-col :span="8">
          <div class="overview-stat" :class="supplierStats.expiringSoon > 0 ? 'stat-warning' : ''"><div class="overview-num">{{ supplierStats.expiringSoon }}</div><div class="overview-label">临期</div></div>
        </el-col>
      </el-row>
      <div style="margin-top:12px;color:#909399;font-size:13px">
        合规率：{{ supplierStats.total > 0 ? Math.round((supplierStats.valid + supplierStats.expiringSoon) / supplierStats.total * 100) : 0 }}%
      </div>
    </el-card>

    <!-- 产品报告 -->
    <el-card class="section-card">
      <template #header><span style="font-weight:bold">🔬 产品检测报告</span></template>
      <el-row :gutter="16">
        <el-col :span="6">
          <div class="overview-stat"><div class="overview-num">{{ productStats.total }}</div><div class="overview-label">报告总数</div></div>
        </el-col>
        <el-col :span="6">
          <div class="overview-stat stat-valid"><div class="overview-num">{{ productStats.qualified }}</div><div class="overview-label">合格</div></div>
        </el-col>
        <el-col :span="6">
          <div class="overview-stat stat-danger"><div class="overview-num">{{ productStats.unqualified }}</div><div class="overview-label">不合格</div></div>
        </el-col>
        <el-col :span="6">
          <div class="overview-stat stat-warning"><div class="overview-num">{{ productStats.expiringSoon }}</div><div class="overview-label">临期</div></div>
        </el-col>
      </el-row>
    </el-card>

    <!-- 临期预警汇总 -->
    <el-card>
      <template #header><span style="font-weight:bold">⚠️ 临期预警（30天内）</span></template>
      <el-table :data="urgentList" stripe size="small" v-loading="loading">
        <el-table-column label="类型" width="90">
          <template #default="{row}">
            <el-tag :type="row.source==='own'?'primary':row.source==='supplier'?'warning':'success'" size="small">{{ row.source === 'own' ? '自有资质' : row.source === 'supplier' ? '供应商' : '产品报告' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="名称" min-width="200">
          <template #default="{row}">
            {{ row.company_name ? row.company_name + ' - ' : '' }}{{ row.name || row.product_name }}
          </template>
        </el-table-column>
        <el-table-column label="到期日期" width="120">
          <template #default="{row}">{{ row.expiry_date }}</template>
        </el-table-column>
        <el-table-column label="剩余天数" width="100">
          <template #default="{row}">
            <el-tag :type="row.daysLeft <= 7 ? 'danger' : 'warning'" size="small">{{ row.daysLeft }} 天</el-tag>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && urgentList.length===0" description="暂无临期预警，一切正常" />
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import request from '../../utils/request'

const loading = ref(false)
const ownList = ref([])
const supplierList = ref([])
const productList = ref([])

const ownStats = computed(() => {
  const now = new Date()
  const deadline = new Date(); deadline.setDate(deadline.getDate() + 30)
  return {
    total: ownList.value.length,
    valid: ownList.value.filter(r => !r.expiry_date || new Date(r.expiry_date) > deadline).length,
    expiringSoon: ownList.value.filter(r => r.expiry_date && new Date(r.expiry_date) <= deadline && new Date(r.expiry_date) >= now).length,
    expired: ownList.value.filter(r => r.expiry_date && new Date(r.expiry_date) < now).length
  }
})

const supplierStats = computed(() => {
  const now = new Date()
  const deadline = new Date(); deadline.setDate(deadline.getDate() + 30)
  return {
    total: supplierList.value.length,
    valid: supplierList.value.filter(r => !r.expiry_date || new Date(r.expiry_date) > deadline).length,
    expiringSoon: supplierList.value.filter(r => r.expiry_date && new Date(r.expiry_date) <= deadline && new Date(r.expiry_date) >= now).length,
    expired: supplierList.value.filter(r => r.expiry_date && new Date(r.expiry_date) < now).length
  }
})

const productStats = computed(() => {
  const now = new Date()
  const deadline = new Date(); deadline.setDate(deadline.getDate() + 30)
  return {
    total: productList.value.length,
    qualified: productList.value.filter(r => r.conclusion === '合格').length,
    unqualified: productList.value.filter(r => r.conclusion !== '合格').length,
    expiringSoon: productList.value.filter(r => r.expiry_date && new Date(r.expiry_date) <= deadline && new Date(r.expiry_date) >= now).length
  }
})

const urgentList = computed(() => {
  const now = new Date()
  const deadline = new Date(); deadline.setDate(deadline.getDate() + 30)
  const items = []
  ownList.value.filter(r => r.expiry_date && new Date(r.expiry_date) <= deadline && new Date(r.expiry_date) >= now).forEach(r => {
    items.push({ source: 'own', name: r.name, company_name: r.company_name, expiry_date: r.expiry_date, daysLeft: Math.ceil((new Date(r.expiry_date) - now) / 86400000) })
  })
  supplierList.value.filter(r => r.expiry_date && new Date(r.expiry_date) <= deadline && new Date(r.expiry_date) >= now).forEach(r => {
    items.push({ source: 'supplier', name: r.name, company_name: r.company_name, expiry_date: r.expiry_date, daysLeft: Math.ceil((new Date(r.expiry_date) - now) / 86400000) })
  })
  productList.value.filter(r => r.expiry_date && new Date(r.expiry_date) <= deadline && new Date(r.expiry_date) >= now).forEach(r => {
    items.push({ source: 'product', product_name: r.product_name, expiry_date: r.expiry_date, daysLeft: Math.ceil((new Date(r.expiry_date) - now) / 86400000) })
  })
  return items.sort((a, b) => a.daysLeft - b.daysLeft)
})

const fetchAll = async () => {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const [ownRes, supplierRes, productRes] = await Promise.all([
      request.get('/certificates', { params: { user_id: user.id, category: 'own' } }),
      request.get('/certificates', { params: { user_id: user.id, category: 'supplier' } }),
      request.get('/product-reports', { params: { user_id: user.id } })
    ])
    ownList.value = ownRes.list
    supplierList.value = supplierRes.list
    productList.value = productRes.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchAll)
</script>

<style scoped>
.section-card { margin-bottom: 16px; }
.overview-stat { text-align: center; padding: 16px 0; border-radius: 8px; background: #f5f7fa; }
.overview-num { font-size: 32px; font-weight: bold; color: #303133; }
.overview-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-valid { background: #f0f9eb; }
.stat-valid .overview-num { color: #67c23a; }
.stat-warning { background: #fdf6ec; }
.stat-warning .overview-num { color: #e6a23c; }
.stat-danger { background: #fef0f0; }
.stat-danger .overview-num { color: #f56c6c; }
.stat-normal { background: #ecf5ff; }
.stat-normal .overview-num { color: #409eff; }
</style>
