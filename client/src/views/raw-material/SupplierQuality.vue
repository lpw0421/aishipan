<template>
  <div class="page-container">
    <div class="toolbar"><h2>供应商质量评估</h2></div>

    <!-- 评估概览 -->
    <el-row :gutter="16" class="stats-row" v-if="statsCards.length">
      <el-col :span="4" v-for="s in statsCards" :key="s.label">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-value" :style="{color:s.color}">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 供应商评分列表 -->
    <el-card>
      <el-button @click="fetchList" :loading="loading" class="mb16">刷新评估</el-button>
      <el-table :data="list" v-loading="loading" stripe @row-click="openDetail">
        <el-table-column prop="supplier" label="供应商" min-width="160" />
        <el-table-column prop="total" label="验收总批次" width="100" align="center" />
        <el-table-column prop="pass" label="合格" width="70" align="center"><template #default="{row}"><span class="text-success">{{ row.pass }}</span></template></el-table-column>
        <el-table-column prop="reject" label="拒收" width="70" align="center"><template #default="{row}"><span class="text-danger">{{ row.reject }}</span></template></el-table-column>
        <el-table-column prop="concession" label="让步" width="70" align="center"><template #default="{row}"><span class="text-warning">{{ row.concession }}</span></template></el-table-column>
        <el-table-column prop="acceptRate" label="合格率" width="90" align="center">
          <template #default="{row}"><el-progress :percentage="row.acceptRate" :color="row.acceptRate>=90?'#67c23a':row.acceptRate>=75?'#e6a23c':'#f56c6c'" :stroke-width="8" /></template>
        </el-table-column>
        <el-table-column prop="score" label="综合评分" width="100" align="center" sortable />
        <el-table-column prop="level" label="等级" width="80" align="center">
          <template #default="{row}">
            <el-tag :type="row.level==='A'?'success':row.level==='B'?'':row.level==='C'?'warning':'danger'" size="small">{{ row.level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="suggest" label="建议" min-width="120" />
      </el-table>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog :title="'供应商详情 — ' + currentSupplier" v-model="showDetail" width="800px">
      <div v-if="detail">
        <el-descriptions :column="3" border class="mb20">
          <el-descriptions-item label="供应商">{{ detail.supplier }}</el-descriptions-item>
          <el-descriptions-item label="综合评分">{{ detail.score }}</el-descriptions-item>
          <el-descriptions-item label="等级"><el-tag :type="detail.level==='A'?'success':detail.level==='B'?'':detail.level==='C'?'warning':'danger'">{{ detail.level }}</el-tag></el-descriptions-item>
          <el-descriptions-item label="验收总数">{{ detail.total }}</el-descriptions-item>
          <el-descriptions-item label="合格">{{ detail.pass }}</el-descriptions-item>
          <el-descriptions-item label="合格率">{{ detail.acceptRate }}%</el-descriptions-item>
          <el-descriptions-item label="拒收">{{ detail.reject }}</el-descriptions-item>
          <el-descriptions-item label="让步">{{ detail.concession }}</el-descriptions-item>
        </el-descriptions>
        <h4>最近 20 批验收记录</h4>
        <el-table :data="detail.recent_batches" stripe size="small">
          <el-table-column prop="batch_number" label="批次号" width="140" />
          <el-table-column prop="material_name" label="原料名称" />
          <el-table-column prop="arrival_time" label="到货时间" width="110"><template #default="{row}">{{ row.arrival_time?.slice(0,10) }}</template></el-table-column>
          <el-table-column prop="judge_result" label="判定结果" width="100">
            <template #default="{row}"><el-tag :type="row.judge_result==='合格'?'success':row.judge_result==='让步接收'?'warning':'danger'" size="small">{{ row.judge_result }}</el-tag></template>
          </el-table-column>
        </el-table>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import axios from 'axios'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const list = ref([])
const loading = ref(false)
const showDetail = ref(false)
const currentSupplier = ref('')
const detail = ref(null)

const statsCards = computed(() => {
  if (list.value.length === 0) return []
  const total = list.value.length
  const aCount = list.value.filter(l => l.level === 'A').length
  const dCount = list.value.filter(l => l.level === 'D').length
  const avgScore = Math.round(list.value.reduce((s, l) => s + l.score, 0) / total)
  return [
    { label: '供应商总数', value: total, color: '#409eff' },
    { label: 'A级(优秀)', value: aCount, color: '#67c23a' },
    { label: 'D级(不合格)', value: dCount, color: '#f56c6c' },
    { label: '平均评分', value: avgScore, color: '#e6a23c' }
  ]
})

async function fetchList() {
  loading.value = true
  try {
    const { data } = await axios.get('/api/supplier-quality', { params: { user_id: user.id } })
    list.value = data.list
  } finally { loading.value = false }
}

async function openDetail(row) {
  currentSupplier.value = row.supplier
  // URL编码供应商名称
  const { data } = await axios.get(`/api/supplier-quality/${encodeURIComponent(row.supplier)}/detail`, { params: { user_id: user.id } })
  detail.value = data
  showDetail.value = true
}

onMounted(fetchList)
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.stats-row{margin-bottom:16px}
.stat-card{text-align:center}
.stat-value{font-size:28px;font-weight:700}
.stat-label{font-size:13px;color:#909399;margin-top:4px}
.mb16{margin-bottom:16px}
.mb20{margin-bottom:20px}
.text-success{color:#67c23a;font-weight:600}
.text-danger{color:#f56c6c;font-weight:600}
.text-warning{color:#e6a23c;font-weight:600}
</style>
