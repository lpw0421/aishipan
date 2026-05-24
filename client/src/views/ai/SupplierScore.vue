<template>
  <div class="page-container">
    <div class="toolbar"><h2>🤖 AI 供应商评分</h2></div>

    <el-row :gutter="16">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span class="card-header">📋 选择供应商</span></template>
          <el-select v-model="selectedCompany" filterable placeholder="搜索供应商名称..." style="width:100%" size="large" @change="onCompanyChange">
            <el-option v-for="c in companies" :key="c" :label="c" :value="c" />
          </el-select>
          <div v-if="selectedCompany && supplierInfo" class="supplier-summary">
            <el-divider />
            <div class="info-row"><span class="info-label">证照总数</span><span class="info-value">{{ supplierInfo.cert_count }}</span></div>
            <div class="info-row"><span class="info-label">有效证照</span><span class="info-value" style="color:#67c23a">{{ supplierInfo.valid_certs }}</span></div>
            <div class="info-row"><span class="info-label">临期证照</span><span class="info-value" style="color:#e6a23c">{{ supplierInfo.expiring_soon_certs }}</span></div>
            <div class="info-row"><span class="info-label">过期证照</span><span class="info-value" style="color:#f56c6c">{{ supplierInfo.expired_certs }}</span></div>
            <div class="info-row"><span class="info-label">产品报告</span><span class="info-value">{{ supplierInfo.report_count }}（合格 {{ supplierInfo.qualified_reports }}）</span></div>
            <el-button type="primary" size="large" style="width:100%;margin-top:16px" @click="handleScore" :loading="scoring">🤖 开始 AI 评分</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="16">
        <el-card shadow="hover">
          <template #header><span class="card-header">📊 评分结果</span></template>
          <div v-if="!scoreResult && !scoring && !scoreFallback" class="empty-hint">请选择供应商后点击"开始 AI 评分"</div>
          <div v-if="scoring" class="empty-hint">🤖 AI 正在分析评分...</div>

          <div v-if="scoreResult" class="score-body">
            <div class="score-hero">
              <el-progress type="dashboard" :percentage="scoreResult.total_score" :color="scoreColor" :width="150">
                <template #default><span class="score-num">{{ scoreResult.total_score }}</span></template>
              </el-progress>
              <div class="score-grade">
                <div class="grade-badge" :style="{background:gradeBg}">{{ scoreResult.level }}</div>
                <div class="grade-label">{{ scoreResult.level_label }}</div>
              </div>
            </div>

            <el-divider />

            <div class="dims">
              <div v-for="d in scoreResult.dimensions" :key="d.name" class="dim-row">
                <div class="dim-top">
                  <span class="dim-name">{{ d.name }}</span>
                  <span class="dim-score">{{ d.score }}<small>/{{ d.max }}</small></span>
                </div>
                <el-progress :percentage="Math.round(d.score/d.max*100)" :stroke-width="10" :color="dimBarColor(d.score/d.max)" />
                <div class="dim-comment">{{ d.comment }}</div>
              </div>
            </div>

            <el-divider />
            <div class="score-summary">{{ scoreResult.summary }}</div>

            <div v-if="scoreResult.risk_tips && scoreResult.risk_tips.length" class="risk-box">
              <strong>⚠️ 风险提示</strong>
              <ul><li v-for="(t,i) in scoreResult.risk_tips" :key="i">{{ t }}</li></ul>
            </div>
          </div>

          <div v-if="scoreFallback" class="empty-hint">{{ scoreFallback }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'

const companies = ref([])
const selectedCompany = ref('')
const supplierInfo = ref(null)
const scoring = ref(false)
const scoreResult = ref(null)
const scoreFallback = ref('')

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

const scoreColor = computed(() => {
  if (!scoreResult.value) return '#409eff'
  const s = scoreResult.value.total_score
  if (s >= 90) return '#67c23a'
  if (s >= 75) return '#409eff'
  if (s >= 60) return '#e6a23c'
  return '#f56c6c'
})

const gradeBg = computed(() => {
  if (!scoreResult.value) return '#909399'
  const lv = scoreResult.value.level
  if (lv === 'A') return '#67c23a'
  if (lv === 'B') return '#409eff'
  if (lv === 'C') return '#e6a23c'
  return '#f56c6c'
})

const dimBarColor = (ratio) => {
  if (ratio >= 0.9) return '#67c23a'
  if (ratio >= 0.7) return '#409eff'
  if (ratio >= 0.5) return '#e6a23c'
  return '#f56c6c'
}

onMounted(async () => {
  // 加载供应商列表（从证照表提取唯 一公司名）
  try {
    const res = await request.get('/certificates', { params: { user_id: userId, category: 'supplier' } })
    companies.value = [...new Set(res.list.map(r => r.company_name).filter(Boolean))].sort()
  } catch {}
})

const onCompanyChange = () => {
  scoreResult.value = null
  scoreFallback.value = ''
  supplierInfo.value = null
}

const handleScore = async () => {
  if (!selectedCompany.value) return
  scoring.value = true; scoreResult.value = null; scoreFallback.value = ''
  try {
    const res = await axios.post('/api/ai/supplier-score', { user_id: userId, company_name: selectedCompany.value })
    if (res.data.method === 'fallback') {
      scoreFallback.value = res.data.message
    } else {
      scoreResult.value = res.data
      supplierInfo.value = res.data.supplier_data
    }
  } catch (e) {
    scoreFallback.value = '评分失败，请重试'
  } finally { scoring.value = false }
}
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.supplier-summary { text-align:left }
.info-row { display:flex; justify-content:space-between; padding:6px 0; font-size:14px }
.info-label { color:#909399 }
.info-value { color:#303133; font-weight:bold }
.empty-hint { text-align:center; color:#c0c4cc; padding:80px 20px; font-size:15px }
.score-body { padding:10px 0 }
.score-hero { display:flex; align-items:center; justify-content:center; gap:30px }
.score-num { font-size:40px; font-weight:bold; color:#303133 }
.score-grade { text-align:center }
.grade-badge { width:64px; height:64px; border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:28px; font-weight:bold; color:#fff; margin:0 auto 6px }
.grade-label { font-size:16px; color:#303133; font-weight:bold }
.dims { padding:8px 0 }
.dim-row { margin-bottom:16px }
.dim-top { display:flex; justify-content:space-between; margin-bottom:6px }
.dim-name { font-size:14px; color:#303133; font-weight:500 }
.dim-score { font-size:16px; font-weight:bold; color:#303133 }
.dim-score small { font-size:12px; color:#909399; font-weight:normal }
.dim-comment { font-size:12px; color:#909399; margin-top:4px }
.score-summary { padding:12px; background:#f0f9eb; border-radius:8px; font-size:13px; line-height:1.6; color:#303133 }
.risk-box { margin-top:12px; padding:12px; background:#fef0f0; border-radius:8px; font-size:13px; color:#303133 }
.risk-box ul { margin:4px 0 0 16px; padding:0 }
.risk-box li { line-height:1.8 }
</style>
