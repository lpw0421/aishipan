<template>
  <div class="page-container">
    <div class="toolbar"><h2>AI 客诉分类定级</h2></div>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-header">📝 输入客诉内容</span></template>
          <el-input v-model="complaintText" type="textarea" :rows="12" placeholder="请粘贴客户的投诉内容，例如：&#10;客户张先生来电反映，购买的XX产品打开后发现里面有金属异物，差点吃进去，要求我们给个说法并赔偿。" />
          <div style="margin-top:16px">
            <el-button type="primary" size="large" @click="handleClassify" :loading="loading" :disabled="!complaintText.trim()" style="width:100%">🤖 AI 分类定级</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-header">📋 分类结果</span></template>
          <div v-if="!classified && !loading" class="empty-hint">粘贴客诉内容后，点击"AI 分类定级"</div>
          <div v-if="loading" class="empty-hint">🤖 AI 正在分析客诉...</div>

          <div v-if="classified && result">
            <div class="top-cards">
              <div class="top-card" :class="'urgency-' + result.urgency">
                <div class="top-card-label">紧急程度</div>
                <div class="top-card-value">{{ urgencyIcon(result.urgency) }} {{ result.urgency }}</div>
              </div>
              <div class="top-card" :class="'risk-' + result.risk_level">
                <div class="top-card-label">风险等级</div>
                <div class="top-card-value">{{ result.risk_level }}</div>
              </div>
              <div class="top-card type-card">
                <div class="top-card-label">投诉类型</div>
                <div class="top-card-value">{{ result.complaint_type }}</div>
                <div class="top-card-sub">置信度：{{ result.type_confidence }}</div>
              </div>
            </div>

            <el-divider />

            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">定级原因</span>
                <span class="info-text">{{ result.urgency_reason }}</span>
              </div>
              <div class="info-item">
                <span class="info-label">建议处理部门</span>
                <el-tag type="primary">{{ result.suggested_handler }}</el-tag>
              </div>
              <div class="info-item">
                <span class="info-label">响应时效</span>
                <el-tag :type="result.sla_response === '2h' ? 'danger' : result.sla_response === '24h' ? 'warning' : 'info'">{{ result.sla_response }}</el-tag>
              </div>
              <div class="info-item">
                <span class="info-label">处理时效</span>
                <span class="info-text">{{ result.sla_resolve }}</span>
              </div>
            </div>

            <div v-if="result.keywords && result.keywords.length" class="keyword-box">
              <strong>识别的关键词：</strong>
              <el-tag v-for="kw in result.keywords" :key="kw" size="small" style="margin:2px">{{ kw }}</el-tag>
            </div>

            <div v-if="result.similar_cases" class="info-box">
              <strong>🔍 相似案例参考：</strong>{{ result.similar_cases }}
            </div>
          </div>

          <div v-if="classified && !result && !loading" class="empty-hint"><p>{{ fallbackMsg }}</p></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const complaintText = ref('')
const loading = ref(false)
const classified = ref(false)
const result = ref(null)
const fallbackMsg = ref('')

const urgencyIcon = (level) => {
  return { '紧急': '🔴', '一般': '🟡', '轻微': '🟢' }[level] || '⚪'
}

const handleClassify = async () => {
  if (!complaintText.value.trim()) { ElMessage.warning('请输入客诉内容'); return }
  loading.value = true; classified.value = false; result.value = null
  try {
    const res = await axios.post('/api/ai/complaint-classify', { complaint_text: complaintText.value.trim() })
    if (res.data.method === 'fallback') {
      fallbackMsg.value = res.data.message
      result.value = null
    } else {
      result.value = res.data
    }
    classified.value = true
  } catch (e) {
    ElMessage.error('分类失败，请重试')
  } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.empty-hint { text-align:center; color:#c0c4cc; padding:80px 20px; font-size:15px; line-height:1.8; white-space:pre-line }
.top-cards { display:flex; gap:16px; justify-content:center }
.top-card { flex:1; text-align:center; padding:16px 12px; border-radius:12px; color:#fff }
.top-card.urgency-紧急 { background:linear-gradient(135deg,#f56c6c,#f89898) }
.top-card.urgency-一般 { background:linear-gradient(135deg,#e6a23c,#ebb563) }
.top-card.urgency-轻微 { background:linear-gradient(135deg,#67c23a,#85ce61) }
.top-card.risk-高 { background:linear-gradient(135deg,#f56c6c,#f89898) }
.top-card.risk-中 { background:linear-gradient(135deg,#e6a23c,#ebb563) }
.top-card.risk-低 { background:linear-gradient(135deg,#67c23a,#85ce61) }
.top-card.type-card { background:linear-gradient(135deg,#409eff,#66b1ff) }
.top-card-label { font-size:13px; opacity:.9 }
.top-card-value { font-size:20px; font-weight:bold; margin-top:6px }
.top-card-sub { font-size:12px; opacity:.8; margin-top:4px }
.info-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px }
.info-item { display:flex; flex-direction:column; gap:4px }
.info-label { font-size:13px; color:#909399 }
.info-text { font-size:14px; color:#303133 }
.keyword-box { margin-top:12px; padding:10px; background:#f5f7fa; border-radius:8px; font-size:13px; color:#303133; line-height:2 }
.info-box { margin-top:10px; padding:10px; background:#f0f9eb; border-radius:8px; font-size:13px; color:#303133; line-height:1.6 }
</style>
