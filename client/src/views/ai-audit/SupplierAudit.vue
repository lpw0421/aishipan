<template>
  <div class="page-container">
    <div class="toolbar"><h2>供应商合规审核</h2></div>

    <!-- 输入区 -->
    <el-row :gutter="16">
      <el-col :span="8">
        <el-card shadow="hover">
          <template #header><span class="card-title">📋 企业信息</span></template>
          <el-form :model="form" label-position="top">
            <el-form-item label="企业名称 *">
              <el-input v-model="form.company_name" placeholder="请输入完整企业名称，如：XX食品有限公司" size="large" clearable @keyup.enter="handleAudit" />
            </el-form-item>
            <el-form-item label="SC 许可证编号（选填）">
              <el-input v-model="form.sc_number" placeholder="SC + 14位数字，如：SC12531011300700" />
            </el-form-item>
            <el-form-item label="统一社会信用代码（选填）">
              <el-input v-model="form.credit_code" placeholder="18位字母数字" />
            </el-form-item>
            <el-form-item label="注册地址（选填）">
              <el-input v-model="form.address" placeholder="企业注册/生产地址" />
            </el-form-item>
            <el-button type="primary" size="large" style="width:100%" @click="handleAudit" :loading="loading">
              🤖 开始合规审核
            </el-button>
          </el-form>

          <!-- 数据库已有数据摘要 -->
          <div v-if="supplierData" class="db-summary">
            <el-divider />
            <div class="summary-title">📊 系统已有数据</div>
            <div class="info-row"><span>证照总数</span><span class="val">{{ supplierData.cert_count }}</span></div>
            <div class="info-row"><span>有效证照</span><span class="val green">{{ supplierData.valid_certs }}</span></div>
            <div class="info-row"><span>临期证照</span><span class="val orange">{{ supplierData.expiring_soon_certs }}</span></div>
            <div class="info-row"><span>过期证照</span><span class="val red">{{ supplierData.expired_certs }}</span></div>
            <div class="info-row"><span>产品报告</span><span class="val">{{ supplierData.report_count }}（合格 {{ supplierData.qualified_reports }}）</span></div>
          </div>
        </el-card>
      </el-col>

      <!-- 结果区 -->
      <el-col :span="16">
        <el-card shadow="hover">
          <template #header>
            <div class="result-header">
              <span class="card-title">📊 合规审核报告</span>
              <span v-if="result" class="report-badge" :class="'level-' + result.level">综合{{ result.level }}</span>
            </div>
          </template>

          <div v-if="!result && !loading && !fallback" class="empty">输入企业名称后点击"开始合规审核"</div>
          <div v-if="loading" class="empty">🤖 AI 正在进行六步合规审核...</div>

          <!-- AI 结果 -->
          <div v-if="result" class="result-body">
            <!-- 综合评分 -->
            <div class="hero">
              <el-progress type="dashboard" :percentage="result.total_score" :color="scoreColor" :width="130">
                <span class="score-num">{{ result.total_score }}</span>
              </el-progress>
              <div class="hero-info">
                <div class="hero-level" :style="{color: scoreColor}">{{ result.level === '高风险' ? '🔴' : result.level === '中风险' ? '🟡' : '🟢' }} {{ result.level }}</div>
                <div class="hero-summary">{{ result.summary }}</div>
              </div>
            </div>

            <!-- 五维评分 -->
            <el-divider />
            <div class="dims-title">五维合规评估</div>
            <div class="dim-card" v-for="dim in result.dimensions" :key="dim.name" :class="'dim-' + dim.level">
              <div class="dim-top">
                <span class="dim-name">{{ dim.name }}</span>
                <span class="dim-score" :style="{color: dimColor(dim.score)}">{{ dim.score }}<small>分</small></span>
                <el-tag :type="dim.level==='高风险'?'danger':dim.level==='中风险'?'warning':'success'" size="small">{{ dim.level }}</el-tag>
              </div>
              <el-progress :percentage="dim.score" :stroke-width="6" :color="dimColor(dim.score)" :show-text="false" />
              <div class="dim-findings" v-if="dim.findings && dim.findings.length">
                <div class="finding" v-for="(f, i) in dim.findings" :key="i">• {{ f }}</div>
              </div>
              <div class="dim-sug" v-if="dim.suggestion">💡 {{ dim.suggestion }}</div>
            </div>

            <!-- 风险提示 -->
            <div v-if="result.risk_tips && result.risk_tips.length" class="risk-box">
              <strong>⚠️ 风险提示</strong>
              <ul><li v-for="(t,i) in result.risk_tips" :key="i">{{ t }}</li></ul>
            </div>

            <!-- 免责声明 -->
            <div class="disclaimer" v-if="result.disclaimer">📌 {{ result.disclaimer }}</div>
          </div>

          <div v-if="fallback" class="empty" style="white-space:pre-wrap">{{ fallback }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive, computed } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const loading = ref(false); const result = ref(null); const fallback = ref(''); const supplierData = ref(null)

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

const form = reactive({ company_name: '', sc_number: '', credit_code: '', address: '' })

const scoreColor = computed(() => {
  if (!result.value) return '#409eff'
  const s = result.value.total_score
  if (s >= 75) return '#67c23a'
  if (s >= 60) return '#e6a23c'
  return '#f56c6c'
})

const dimColor = (score) => {
  if (score >= 75) return '#67c23a'
  if (score >= 60) return '#e6a23c'
  return '#f56c6c'
}

const handleAudit = async () => {
  if (!form.company_name.trim()) { ElMessage.warning('请输入企业名称'); return }
  loading.value = true; result.value = null; fallback.value = ''; supplierData.value = null
  try {
    const res = await axios.post('/api/ai/supplier-score', { user_id: userId, ...form })
    if (res.data.method === 'fallback') {
      fallback.value = res.data.message
      supplierData.value = res.data.supplier_data || null
    } else if (res.data.method === 'error') {
      fallback.value = res.data.message
    } else {
      result.value = res.data
      supplierData.value = res.data.supplier_data || null
    }
  } catch (e) {
    fallback.value = '审核请求失败，请重试'
  } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { margin-bottom: 16px; } .toolbar h2 { margin: 0; color: #303133; }
.card-title { font-weight: bold; color: #303133; }
.result-header { display: flex; justify-content: space-between; align-items: center; }
.report-badge { padding: 4px 16px; border-radius: 16px; font-size: 13px; font-weight: 600; color: white; }
.level-高风险 { background: #dc2626; } .level-中风险 { background: #ea580c; } .level-低风险 { background: #16a34a; }
.empty { text-align: center; color: #c0c4cc; padding: 80px 20px; font-size: 15px; }

/* 数据库摘要 */
.db-summary { font-size: 13px; }
.summary-title { font-weight: 600; color: #374151; margin-bottom: 8px; }
.info-row { display: flex; justify-content: space-between; padding: 4px 0; color: #6b7280; }
.info-row .val { font-weight: 600; color: #1a1a2e; }
.info-row .green { color: #16a34a; } .info-row .orange { color: #ea580c; } .info-row .red { color: #dc2626; }

/* 结果 */
.result-body { padding: 10px 0; }
.hero { display: flex; align-items: center; justify-content: center; gap: 24px; }
.score-num { font-size: 32px; font-weight: 800; color: #1a1a2e; }
.hero-info { text-align: left; }
.hero-level { font-size: 22px; font-weight: 700; }
.hero-summary { font-size: 13px; color: #6b7280; margin-top: 4px; max-width: 300px; }

.dims-title { font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 10px; }
.dim-card { padding: 14px; margin-bottom: 10px; background: #f9fafb; border-radius: 10px; border-left: 4px solid #d1d5db; }
.dim-高风险 { border-left-color: #dc2626; background: #fef2f2; }
.dim-中风险 { border-left-color: #ea580c; background: #fff7ed; }
.dim-低风险 { border-left-color: #16a34a; background: #f0fdf4; }
.dim-top { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
.dim-name { font-weight: 600; font-size: 14px; color: #1a1a2e; flex: 1; }
.dim-score { font-size: 18px; font-weight: 700; } .dim-score small { font-size: 11px; color: #9ca3af; font-weight: normal; }
.dim-findings { margin: 8px 0; } .finding { font-size: 12px; color: #6b7280; padding: 2px 0; }
.dim-sug { font-size: 12px; color: #374151; margin-top: 4px; padding: 6px 10px; background: rgba(255,255,255,0.7); border-radius: 6px; }

.risk-box { margin-top: 12px; padding: 12px; background: #fef2f2; border-radius: 8px; font-size: 13px; }
.risk-box ul { margin: 4px 0 0 16px; padding: 0; } .risk-box li { line-height: 1.8; }
.disclaimer { margin-top: 12px; padding: 10px 14px; background: #f0f5ff; border-radius: 8px; font-size: 12px; color: #6b7280; line-height: 1.6; }
</style>
