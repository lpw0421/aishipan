<template>
  <div class="page-container">
    <div class="toolbar"><h2>AI 客诉根因分析</h2></div>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-header">🔍 输入分析数据</span></template>
          <el-form label-width="80px" size="large">
            <el-form-item label="关联产品"><el-input v-model="form.product_name" placeholder="产品名称+规格" /></el-form-item>
            <el-form-item label="生产批次"><el-input v-model="form.batch_no" placeholder="如：20260524001" /></el-form-item>
            <el-form-item label="生产线"><el-input v-model="form.production_line" placeholder="如：1号线" /></el-form-item>
            <el-form-item label="供应商"><el-input v-model="form.supplier_info" placeholder="主要原料供应商" /></el-form-item>
          </el-form>
          <div class="section-label">客诉问题描述</div>
          <el-input v-model="form.complaint_text" type="textarea" :rows="5" placeholder="描述客户投诉的具体问题，如：产品中发现金属异物，客户已保留物证并要求赔偿..." />
          <div style="margin-top:16px">
            <el-button type="primary" size="large" @click="handleAnalysis" :loading="loading" :disabled="!form.complaint_text" style="width:100%">🤖 AI 根因分析</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-header">📋 分析结果</span></template>
          <div v-if="!analyzed && !loading" class="empty-hint">填写客诉信息后，点击"AI 根因分析"</div>
          <div v-if="loading" class="empty-hint">🤖 AI 正在深度分析根因...</div>

          <div v-if="analyzed && result" class="analysis-body">
            <div v-if="result.possible_causes && result.possible_causes.length" class="causes-section">
              <h4>🎯 可能原因（按概率排序）</h4>
              <div v-for="(c, i) in result.possible_causes" :key="i" class="cause-card">
                <div class="cause-header">
                  <span class="cause-rank">#{{ i + 1 }}</span>
                  <span class="cause-name">{{ c.cause }}</span>
                  <el-tag size="small" :type="parseInt(c.probability) >= 50 ? 'danger' : parseInt(c.probability) >= 25 ? 'warning' : 'info'">概率 {{ c.probability }}</el-tag>
                </div>
                <div class="cause-evidence" v-if="c.evidence">{{ c.evidence }}</div>
                <div class="cause-checks" v-if="c.check_items && c.check_items.length">
                  <div class="check-title">排查项：</div>
                  <div v-for="(chk, j) in c.check_items" :key="j" class="check-item">• {{ chk }}</div>
                </div>
              </div>
            </div>

            <div v-if="result.affected_scope" class="info-block">
              <strong>📦 影响范围：</strong>{{ result.affected_scope }}
            </div>

            <div v-if="result.rectification_plan && result.rectification_plan.length" class="info-block">
              <strong>🔧 整改计划：</strong>
              <div v-for="(rp, i) in result.rectification_plan" :key="i" class="rect-item">
                {{ i + 1 }}. {{ rp.action }} — <el-tag size="small">{{ rp.responsible }}</el-tag> <el-tag size="small" type="info">{{ rp.deadline }}</el-tag>
              </div>
            </div>

            <div v-if="result.prevention_measures && result.prevention_measures.length" class="info-block">
              <strong>🛡 预防措施：</strong>
              <div v-for="(pm, i) in result.prevention_measures" :key="i">• {{ pm }}</div>
            </div>

            <div v-if="result.risk_level_after" class="info-block">
              <strong>🔄 整改后残余风险：</strong>
              <el-tag :type="result.risk_level_after === '无' ? 'success' : result.risk_level_after === '低' ? 'info' : 'warning'">{{ result.risk_level_after }}</el-tag>
            </div>

            <div v-if="result.summary" class="summary-box"><strong>总结：</strong>{{ result.summary }}</div>
          </div>

          <div v-if="analyzed && !result && !loading" class="empty-hint"><p>{{ fallbackMsg }}</p></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const form = reactive({ product_name: '', batch_no: '', production_line: '', supplier_info: '', complaint_text: '' })
const loading = ref(false)
const analyzed = ref(false)
const result = ref(null)
const fallbackMsg = ref('')

const handleAnalysis = async () => {
  if (!form.complaint_text) { ElMessage.warning('请填写客诉问题描述'); return }
  loading.value = true; analyzed.value = false; result.value = null
  try {
    const res = await axios.post('/api/ai/complaint-analysis', { ...form })
    if (res.data.method === 'fallback') {
      fallbackMsg.value = res.data.message
      result.value = null
    } else {
      result.value = res.data
    }
    analyzed.value = true
  } catch (e) {
    ElMessage.error('分析失败，请重试')
  } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.section-label { font-weight:bold; color:#606266; margin-bottom:8px; font-size:14px }
.empty-hint { text-align:center; color:#c0c4cc; padding:80px 20px; font-size:15px; line-height:1.8; white-space:pre-line }
.analysis-body { max-height:600px; overflow-y:auto }
.analysis-body h4 { margin:0 0 12px; color:#303133 }
.causes-section { margin-bottom:16px }
.cause-card { border:1px solid #ebeef5; border-radius:8px; padding:12px 16px; margin-bottom:10px }
.cause-card:first-child { border-left:4px solid #f56c6c }
.cause-header { display:flex; align-items:center; gap:8px; margin-bottom:8px }
.cause-rank { font-size:18px; font-weight:bold; color:#409eff }
.cause-name { font-weight:bold; color:#303133; flex:1 }
.cause-evidence { font-size:12px; color:#909399; margin-bottom:6px }
.check-title { font-size:13px; color:#e6a23c; font-weight:bold }
.check-item { font-size:13px; color:#606266; padding:2px 0 2px 12px }
.info-block { padding:10px 12px; background:#f5f7fa; border-radius:6px; margin-bottom:10px; font-size:13px; color:#303133; line-height:1.8 }
.rect-item { padding:4px 0; font-size:13px }
.summary-box { padding:12px; background:#f0f9eb; border-radius:8px; font-size:13px; color:#303133; line-height:1.6; margin-top:10px }
</style>
