<template>
  <div class="page-container">
    <div class="toolbar"><h2>满意度追踪</h2></div>

    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <div class="stat-card">
          <div class="stat-num">{{ stats.avgSatisfaction || '-' }}</div>
          <div class="stat-label">整体满意度均分</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-good">
          <div class="stat-num">{{ satisfiedCount }}</div>
          <div class="stat-label">满意客诉 (4-5星)</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-warn">
          <div class="stat-num">{{ neutralCount }}</div>
          <div class="stat-label">一般客诉 (3星)</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-bad">
          <div class="stat-num">{{ unsatisfiedCount }}</div>
          <div class="stat-label">不满意客诉 (1-2星)</div>
        </div>
      </el-col>
    </el-row>

    <el-row :gutter="16" style="margin-top:16px">
      <!-- 按类型满意度 -->
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span class="card-header">📊 按投诉类型满意度</span></template>
          <el-table :data="byType" border stripe size="small">
            <el-table-column prop="type" label="投诉类型" width="100" />
            <el-table-column prop="count" label="已评价数" width="90" align="center" />
            <el-table-column prop="avgScore" label="平均分" width="80" align="center">
              <template #default="{row}">
                <el-tag :type="row.avgScore>=4?'success':row.avgScore>=3?'warning':'danger'" size="small">{{ row.avgScore }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="评分分布" min-width="150">
              <template #default="{row}">
                <div class="score-bar">
                  <div class="score-seg seg-5" :style="{flex:row.d5}"></div>
                  <div class="score-seg seg-4" :style="{flex:row.d4}"></div>
                  <div class="score-seg seg-3" :style="{flex:row.d3}"></div>
                  <div class="score-seg seg-2" :style="{flex:row.d2}"></div>
                  <div class="score-seg seg-1" :style="{flex:row.d1}"></div>
                </div>
              </template>
            </el-table-column>
          </el-table>
        </el-card>
      </el-col>

      <!-- 不满意客诉列表 -->
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header>
            <span class="card-header" style="color:#f56c6c">⚠️ 不满意客诉 (≤2星) — 需二次跟进</span>
          </template>
          <el-table :data="unsatisfiedList" border stripe size="small" max-height="350">
            <el-table-column prop="complaint_number" label="编号" width="160" />
            <el-table-column prop="customer_name" label="客户" width="70" />
            <el-table-column label="评分" width="80">
              <template #default="{row}">
                <el-rate :model-value="row.satisfaction_score" :max="5" disabled show-score size="small" />
              </template>
            </el-table-column>
            <el-table-column prop="complaint_type" label="类型" width="80" />
            <el-table-column label="状态" width="80">
              <template #default="{row}"><el-tag type="danger" size="small">{{ row.need_followup ? '需跟进' : '已跟进' }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="70">
              <template #default="{row}">
                <el-button type="primary" size="small" @click="$router.push('/complaint/handle?id='+row.id)">处理</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="unsatisfiedList.length===0" description="暂无不满意的客诉 👍" />
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import request from '../../utils/request'

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

const stats = ref({ avgSatisfaction: 0 })
const byType = ref([])
const unsatisfiedList = ref([])

const satisfiedCount = ref(0)
const neutralCount = ref(0)
const unsatisfiedCount = computed(() => unsatisfiedList.value.length)

const fetchData = async () => {
  try {
    // stats
    const res = await request.get('/complaints/stats', { params: { user_id: userId } })
    stats.value = res

    // unsatisfied list
    const res2 = await request.get('/complaints', {
      params: { user_id: userId, status: '已关闭' }
    })
    unsatisfiedList.value = (res2.list || []).filter(r => r.satisfaction_score > 0 && r.satisfaction_score <= 2)
    const allRated = (res2.list || []).filter(r => r.satisfaction_score > 0)
    satisfiedCount.value = allRated.filter(r => r.satisfaction_score >= 4).length
    neutralCount.value = allRated.filter(r => r.satisfaction_score === 3).length

    // by type satisfaction
    const typeMap = {}
    allRated.forEach(r => {
      const t = r.complaint_type || '其他'
      if (!typeMap[t]) typeMap[t] = { scores: [], d5: 0, d4: 0, d3: 0, d2: 0, d1: 0 }
      typeMap[t].scores.push(r.satisfaction_score)
      if (r.satisfaction_score === 5) typeMap[t].d5++
      else if (r.satisfaction_score === 4) typeMap[t].d4++
      else if (r.satisfaction_score === 3) typeMap[t].d3++
      else if (r.satisfaction_score === 2) typeMap[t].d2++
      else if (r.satisfaction_score === 1) typeMap[t].d1++
    })
    byType.value = Object.entries(typeMap).map(([type, data]) => ({
      type,
      count: data.scores.length,
      avgScore: Math.round(data.scores.reduce((a, b) => a + b, 0) / data.scores.length * 10) / 10,
      d5: data.d5, d4: data.d4, d3: data.d3, d2: data.d2, d1: data.d1
    })).sort((a, b) => a.avgScore - b.avgScore)
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
.stat-card { text-align:center; padding:20px 0; border-radius:8px; color:#fff; background:linear-gradient(135deg,#409eff,#66b1ff) }
.stat-card.stat-good { background:linear-gradient(135deg,#67c23a,#85ce61) }
.stat-card.stat-warn { background:linear-gradient(135deg,#e6a23c,#ebb563) }
.stat-card.stat-bad { background:linear-gradient(135deg,#f56c6c,#f89898) }
.stat-num { font-size:32px; font-weight:bold }
.stat-label { font-size:13px; margin-top:4px; opacity:.9 }
.score-bar { display:flex; height:16px; border-radius:8px; overflow:hidden; gap:1px }
.score-seg { min-width:4px }
.score-seg.seg-5 { background:#67c23a }
.score-seg.seg-4 { background:#85ce61 }
.score-seg.seg-3 { background:#e6a23c }
.score-seg.seg-2 { background:#f89898 }
.score-seg.seg-1 { background:#f56c6c }
</style>
