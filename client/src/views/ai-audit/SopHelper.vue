<template>
  <div class="page-container">
    <div class="toolbar"><h2>📋 SOP 撰写助手</h2></div>
    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-title">⚙️ 操作参数</span></template>
          <el-form :model="form" label-position="top">
            <el-form-item label="操作类型"><el-select v-model="form.op_type" style="width:100%"><el-option label="收货检验" value="receiving"/><el-option label="清洗消毒" value="cleaning"/><el-option label="温度监控" value="temperature"/><el-option label="虫害检查" value="pest"/><el-option label="设备操作" value="equipment"/><el-option label="产品追溯" value="traceability"/><el-option label="不合格品处理" value="nonconforming"/><el-option label="留样管理" value="sampling"/></el-select></el-form-item>
            <el-form-item label="操作岗位"><el-input v-model="form.position" placeholder="如：质检员、操作工" /></el-form-item>
            <el-form-item label="关键参数"><el-input v-model="form.params" type="textarea" :rows="3" placeholder="温度要求、时间要求、频率等，如：&#10;· 消毒液浓度：200ppm&#10;· 浸泡时间：≥5分钟&#10;· 频率：每班一次" /></el-form-item>
            <el-form-item label="关联文件"><el-input v-model="form.related_docs" placeholder="如：SSOP-01 清洗消毒程序" /></el-form-item>
            <el-form-item label="适用标准"><el-input v-model="form.standards" placeholder="如：GB 14881-2013" /></el-form-item>
            <el-button type="primary" size="large" style="width:100%" @click="handleGenerate" :loading="loading">🤖 AI 生成 SOP</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-title">📄 生成结果</span></template>
          <div v-if="!result && !loading && !fallback" class="empty">填写操作参数后点击"AI 生成 SOP"</div>
          <div v-if="loading" class="empty">🤖 AI 正在生成 SOP 初稿...</div>
          <div v-if="result" class="result-body">
            <div class="sop-header"><h3>{{ result.title }}</h3><div class="sop-meta">文件编号：{{ result.doc_number }} | 版本：V1.0</div></div>
            <el-divider />
            <div class="sop-section"><strong>1. 目的</strong><p>{{ result.purpose }}</p></div>
            <div class="sop-section"><strong>2. 范围</strong><p>{{ result.scope }}</p></div>
            <div class="sop-section"><strong>3. 职责</strong><p>{{ result.responsibility }}</p></div>
            <div class="sop-section"><strong>4. 操作步骤</strong><div class="sop-steps" v-html="result.steps"></div></div>
            <div class="sop-section"><strong>5. 注意事项</strong><p>{{ result.precautions }}</p></div>
            <div class="ref-box" v-if="result.references"><strong>📎 关联法规/标准：</strong>{{ result.references }}</div>
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
const form = reactive({ op_type: 'receiving', position: '', params: '', related_docs: '', standards: '' })
const handleGenerate = async () => {
  if (!form.op_type) return
  loading.value = true; result.value = null; fallback.value = ''
  try {
    const res = await axios.post('/api/ai-report/sop', { ...form })
    res.data.method === 'fallback' ? fallback.value = res.data.message : result.value = res.data
  } catch { fallback.value = '生成失败，请重试' } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { margin-bottom: 16px; } .toolbar h2 { margin: 0; color: #303133; }
.card-title { font-weight: bold; color: #303133; }
.empty { text-align: center; color: #c0c4cc; padding: 80px 20px; font-size: 15px; white-space: pre-wrap; }
.result-body { padding: 10px 0; }
.sop-header h3 { margin: 0 0 4px 0; color: #1a1a2e; } .sop-meta { font-size: 12px; color: #9ca3af; }
.sop-section { margin-bottom: 14px; font-size: 14px; line-height: 1.8; color: #374151; }
.sop-section p { margin: 4px 0 0 12px; }
.sop-steps { margin: 4px 0 0 12px; white-space: pre-wrap; }
.ref-box { padding: 10px; background: #f0f5ff; border-radius: 8px; font-size: 13px; color: #374151; margin-top: 12px; }
</style>
