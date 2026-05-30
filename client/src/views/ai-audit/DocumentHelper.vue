<template>
  <div class="page-container">
    <div class="toolbar"><h2>📄 文件编制助手</h2></div>
    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-title">📝 文件信息</span></template>
          <el-form :model="form" label-position="top">
            <el-form-item label="文件类型"><el-select v-model="form.doc_type" style="width:100%"><el-option label="管理手册" value="manual"/><el-option label="程序文件" value="procedure"/><el-option label="作业指导书" value="sop"/><el-option label="记录表单" value="form"/><el-option label="HACCP计划" value="haccp"/></el-select></el-form-item>
            <el-form-item label="企业名称"><el-input v-model="form.company_name" placeholder="如：XX食品有限公司" /></el-form-item>
            <el-form-item label="产品范围"><el-input v-model="form.product_scope" placeholder="如：速冻肉制品、调理食品" /></el-form-item>
            <el-form-item label="适用标准"><el-input v-model="form.standards" placeholder="如：GB 14881、HACCP体系" /></el-form-item>
            <el-form-item label="特殊要求"><el-input v-model="form.requirements" type="textarea" :rows="3" placeholder="其他特殊要求（选填）" /></el-form-item>
            <el-button type="primary" size="large" style="width:100%" @click="handleGenerate" :loading="loading">🤖 AI 生成文档</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-title">📋 生成结果</span></template>
          <div v-if="!result && !loading && !fallback" class="empty">填写文件信息后点击"AI 生成文档"</div>
          <div v-if="loading" class="empty">🤖 AI 正在生成文档初稿...</div>
          <div v-if="result" class="result-body">
            <div class="doc-header">
              <h3>{{ result.title }}</h3>
              <div class="doc-meta">文件编号：{{ result.doc_number }} | 版本：V1.0 | 生成时间：{{ result.generated_at }}</div>
            </div>
            <el-divider />
            <div class="doc-content" v-html="result.content"></div>
            <el-divider />
            <div class="compliance-box" v-if="result.compliance_check">
              <strong>📋 合规检查：</strong><p>{{ result.compliance_check }}</p>
            </div>
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
const form = reactive({ doc_type: 'manual', company_name: '', product_scope: '', standards: '', requirements: '' })
const handleGenerate = async () => {
  if (!form.company_name) return
  loading.value = true; result.value = null; fallback.value = ''
  try {
    const res = await axios.post('/api/ai-report/document', { ...form })
    res.data.method === 'fallback' ? fallback.value = res.data.message : result.value = res.data
  } catch { fallback.value = '生成失败，请重试' } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { margin-bottom: 16px; } .toolbar h2 { margin: 0; color: #303133; }
.card-title { font-weight: bold; color: #303133; }
.empty { text-align: center; color: #c0c4cc; padding: 80px 20px; font-size: 15px; white-space: pre-wrap; }
.result-body { padding: 10px 0; }
.doc-header h3 { margin: 0 0 6px 0; color: #1a1a2e; } .doc-meta { font-size: 12px; color: #9ca3af; }
.doc-content { font-size: 14px; line-height: 1.8; color: #374151; white-space: pre-wrap; max-height: 500px; overflow-y: auto; padding: 12px; background: #fafbfc; border-radius: 8px; }
.compliance-box { padding: 12px; background: #f0fdf4; border-radius: 8px; font-size: 13px; } .compliance-box p { margin: 4px 0 0 0; }
</style>
