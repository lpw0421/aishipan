<template>
  <div class="page-container">
    <div class="toolbar"><h2>🔬 原料验收助手</h2></div>
    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-title">📋 验收信息</span></template>
          <el-form :model="form" label-position="top">
            <el-form-item label="原料名称"><el-input v-model="form.material_name" placeholder="如：冷冻鸡胸肉" /></el-form-item>
            <el-form-item label="供应商"><el-input v-model="form.supplier" placeholder="供应商名称" /></el-form-item>
            <el-form-item label="到货温度(℃)"><el-input-number v-model="form.temperature" :precision="1" style="width:100%" placeholder="如：-18" /></el-form-item>
            <el-form-item label="感官描述"><el-input v-model="form.sensory" type="textarea" :rows="3" placeholder="颜色、气味、外观等" /></el-form-item>
            <el-form-item label="证件检查">
              <el-checkbox-group v-model="form.cert_checks">
                <el-checkbox label="检疫证明" style="margin-right:12px">检疫证明</el-checkbox>
                <el-checkbox label="出厂检验报告" style="margin-right:12px">出厂报告</el-checkbox>
                <el-checkbox label="第三方检测">第三方检测</el-checkbox>
              </el-checkbox-group>
            </el-form-item>
            <el-form-item label="补充说明"><el-input v-model="form.notes" type="textarea" :rows="2" placeholder="其他需要说明的情况（选填）" /></el-form-item>
            <el-button type="primary" size="large" style="width:100%" @click="handleAudit" :loading="loading">🤖 AI 验收判定</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-title">📊 判定结果</span></template>
          <div v-if="!result && !loading && !fallback" class="empty">填写验收信息后点击"AI 验收判定"</div>
          <div v-if="loading" class="empty">🤖 AI 正在分析判定...</div>
          <div v-if="result" class="result-body">
            <div class="verdict" :class="'v-' + result.verdict">
              <span class="v-icon">{{ result.verdict === 'accept' ? '✅' : result.verdict === 'concession' ? '⚠️' : '❌' }}</span>
              <div><div class="v-label">{{ result.verdict === 'accept' ? '合格接收' : result.verdict === 'concession' ? '让步接收' : '拒收' }}</div>
              <div class="v-desc">{{ result.verdict_reason }}</div></div>
            </div>
            <el-divider />
            <div class="risk"><strong>风险评估：</strong><el-progress :percentage="result.risk_score" :color="result.risk_score<=30?'#67c23a':result.risk_score<=60?'#e6a23c':'#f56c6c'" :stroke-width="14"><span class="risk-num">{{ result.risk_score }}/100</span></el-progress></div>
            <div class="sug" v-if="result.suggestions"><strong>处理建议：</strong><p>{{ result.suggestions }}</p></div>
          </div>
          <div v-if="fallback" class="empty">{{ fallback }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import axios from 'axios'
const loading = ref(false); const result = ref(null); const fallback = ref('')
const form = reactive({ material_name: '', supplier: '', temperature: null, sensory: '', cert_checks: [], notes: '' })
const handleAudit = async () => {
  if (!form.material_name || !form.supplier) return
  loading.value = true; result.value = null; fallback.value = ''
  try {
    const res = await axios.post('/api/ai-audit/material', { ...form })
    res.data.method === 'fallback' ? fallback.value = res.data.message : result.value = res.data
  } catch { fallback.value = '判定失败，请重试' } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { margin-bottom: 16px; } .toolbar h2 { margin: 0; color: #303133; }
.card-title { font-weight: bold; color: #303133; }
.empty { text-align: center; color: #c0c4cc; padding: 80px 20px; font-size: 15px; line-height: 1.6; white-space: pre-wrap; }
.result-body { padding: 10px 0; }
.verdict { display: flex; align-items: center; gap: 16px; padding: 20px; border-radius: 12px; }
.v-accept { background: #f0fdf4; } .v-concession { background: #fffbeb; } .v-reject { background: #fef2f2; }
.v-icon { font-size: 48px; } .v-label { font-size: 20px; font-weight: 700; color: #1a1a2e; } .v-desc { font-size: 13px; color: #6b7280; margin-top: 4px; }
.risk { margin: 12px 0; } .risk-num { font-size: 14px; font-weight: 700; }
.sug { padding: 12px; background: #f9fafb; border-radius: 8px; font-size: 13px; line-height: 1.6; color: #374151; } .sug p { margin: 4px 0 0 0; }
</style>
