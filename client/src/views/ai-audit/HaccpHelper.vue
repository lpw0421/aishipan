<template>
  <div class="page-container">
    <div class="toolbar"><h2>🛡️ HACCP 计划助手</h2></div>
    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-title">📋 产品信息</span></template>
          <el-form :model="form" label-position="top">
            <el-form-item label="产品名称"><el-input v-model="form.product_name" placeholder="如：速冻调理鸡肉串" /></el-form-item>
            <el-form-item label="主要配料"><el-input v-model="form.ingredients" type="textarea" :rows="2" placeholder="如：鸡胸肉、淀粉、食盐、香辛料" /></el-form-item>
            <el-form-item label="工艺流程"><el-input v-model="form.process_flow" type="textarea" :rows="5" placeholder="描述从原料到成品的工艺流程，如：&#10;1. 原料验收&#10;2. 冷冻贮存(-18℃)&#10;3. 解冻&#10;4. 切块调味&#10;5. 穿串&#10;6. 速冻(-35℃)&#10;7. 金属探测&#10;8. 包装入库" /></el-form-item>
            <el-form-item label="预期用途与消费群体"><el-input v-model="form.intended_use" placeholder="如：充分加热后食用，面向普通消费者" /></el-form-item>
            <el-form-item label="包装方式"><el-input v-model="form.packaging" placeholder="如：真空包装/气调包装" /></el-form-item>
            <el-button type="primary" size="large" style="width:100%" @click="handleAnalyze" :loading="loading">🤖 AI 危害分析</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-title">📊 分析结果</span></template>
          <div v-if="!result && !loading && !fallback" class="empty">填写产品信息后点击"AI 危害分析"</div>
          <div v-if="loading" class="empty">🤖 AI 正在进行危害分析...</div>
          <div v-if="result" class="result-body">
            <el-tabs type="border-card">
              <el-tab-pane label="危害分析">
                <el-table :data="result.hazards" border stripe size="small" max-height="400">
                  <el-table-column prop="step" label="工序" width="100" />
                  <el-table-column prop="hazard_type" label="危害类型" width="90" />
                  <el-table-column prop="hazard_desc" label="危害描述" min-width="140" show-overflow-tooltip />
                  <el-table-column prop="severity" label="严重性" width="70"><template #default="{row}"><el-tag :type="row.severity==='高'?'danger':row.severity==='中'?'warning':'info'" size="small">{{ row.severity }}</el-tag></template></el-table-column>
                  <el-table-column prop="likelihood" label="可能性" width="70"><template #default="{row}"><el-tag :type="row.likelihood==='高'?'danger':row.likelihood==='中'?'warning':'info'" size="small">{{ row.likelihood }}</el-tag></template></el-table-column>
                  <el-table-column prop="is_ccp" label="CCP" width="65"><template #default="{row}"><span :style="{color:row.is_ccp==='是'?'#dc2626':'#9ca3af',fontWeight:row.is_ccp==='是'?'bold':'normal'}">{{ row.is_ccp }}</span></template></el-table-column>
                </el-table>
              </el-tab-pane>
              <el-tab-pane label="CCP 汇总">
                <div v-if="result.ccps.length === 0" class="empty-sm">未识别到关键控制点</div>
                <div v-for="(ccp, i) in result.ccps" :key="i" class="ccp-card">
                  <div class="ccp-num">CCP-{{ i + 1 }}</div>
                  <div class="ccp-step">{{ ccp.step }}</div>
                  <div class="ccp-detail">
                    <div><strong>显著危害：</strong>{{ ccp.significant_hazard }}</div>
                    <div><strong>关键限值：</strong>{{ ccp.critical_limit }}</div>
                    <div><strong>监控方式：</strong>{{ ccp.monitoring }}</div>
                    <div><strong>纠偏措施：</strong>{{ ccp.corrective_action }}</div>
                    <div><strong>验证方式：</strong>{{ ccp.verification }}</div>
                  </div>
                </div>
              </el-tab-pane>
            </el-tabs>
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
const form = reactive({ product_name: '', ingredients: '', process_flow: '', intended_use: '', packaging: '' })
const handleAnalyze = async () => {
  if (!form.product_name || !form.process_flow) return
  loading.value = true; result.value = null; fallback.value = ''
  try {
    const res = await axios.post('/api/ai-tool/haccp', { ...form })
    res.data.method === 'fallback' ? fallback.value = res.data.message : result.value = res.data
  } catch { fallback.value = '分析失败，请重试' } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { margin-bottom: 16px; } .toolbar h2 { margin: 0; color: #303133; }
.card-title { font-weight: bold; color: #303133; }
.empty { text-align: center; color: #c0c4cc; padding: 80px 20px; font-size: 15px; white-space: pre-wrap; }
.empty-sm { text-align: center; color: #c0c4cc; padding: 40px 20px; }
.result-body { padding: 0; }
.ccp-card { padding: 14px; margin-bottom: 10px; background: #fef2f2; border-radius: 10px; border-left: 5px solid #dc2626; }
.ccp-num { font-weight: 800; color: #dc2626; font-size: 16px; } .ccp-step { font-weight: 600; color: #1a1a2e; font-size: 15px; margin: 4px 0 8px; }
.ccp-detail { font-size: 13px; color: #374151; line-height: 1.8; }
</style>
