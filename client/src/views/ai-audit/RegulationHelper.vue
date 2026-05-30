<template>
  <div class="page-container">
    <div class="toolbar"><h2>📖 法规速查助手</h2></div>
    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-title">🔍 智能查询</span></template>
          <el-form label-position="top">
            <el-form-item label="输入你的问题">
              <el-input v-model="question" type="textarea" :rows="4" placeholder="用自然语言描述你想了解的法规问题，如：&#10;· 食品标签必须标注哪些内容？&#10;· 冷冻肉制品的贮存温度要求是什么？&#10;· 食品添加剂的标识有哪些规定？" />
            </el-form-item>
            <el-button type="primary" size="large" style="width:100%" @click="handleSearch" :loading="loading">🤖 AI 法规查询</el-button>
          </el-form>
        </el-card>
        <el-card shadow="hover" style="margin-top:12px">
          <template #header><span class="card-title">📚 快捷查询</span></template>
          <div class="quick-tags">
            <el-tag v-for="q in quickQuestions" :key="q" type="info" effect="plain" class="q-tag" @click="question=q;handleSearch()">{{ q }}</el-tag>
          </div>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-title">📋 查询结果</span></template>
          <div v-if="!result && !loading && !fallback" class="empty">输入问题后点击"AI 法规查询"</div>
          <div v-if="loading" class="empty">🤖 AI 正在检索法规...</div>
          <div v-if="result" class="result-body">
            <div class="reg-item" v-for="(item, i) in result.regulations" :key="i">
              <div class="reg-title">{{ item.standard }}</div>
              <div class="reg-clause"><strong>条款：</strong>{{ item.clause }}</div>
              <div class="reg-interp"><strong>解读：</strong>{{ item.interpretation }}</div>
            </div>
            <el-divider v-if="result.suggestion" />
            <div class="sug-box" v-if="result.suggestion"><strong>💡 整改建议：</strong><p>{{ result.suggestion }}</p></div>
          </div>
          <div v-if="fallback" class="empty">{{ fallback }}</div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'
const loading = ref(false); const result = ref(null); const fallback = ref(''); const question = ref('')
const quickQuestions = ['食品标签必须标注哪些内容？', '冷冻肉制品贮存温度要求', '食品添加剂标识规定', '过敏原标识要求', '营养成分表格式规范']
const handleSearch = async () => {
  if (!question.value) return
  loading.value = true; result.value = null; fallback.value = ''
  try {
    const res = await axios.post('/api/ai-tool/regulation', { question: question.value })
    res.data.method === 'fallback' ? fallback.value = res.data.message : result.value = res.data
  } catch { fallback.value = '查询失败，请重试' } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { margin-bottom: 16px; } .toolbar h2 { margin: 0; color: #303133; }
.card-title { font-weight: bold; color: #303133; }
.empty { text-align: center; color: #c0c4cc; padding: 80px 20px; font-size: 15px; white-space: pre-wrap; }
.quick-tags { display: flex; flex-wrap: wrap; gap: 8px; } .q-tag { cursor: pointer; }
.result-body { padding: 10px 0; }
.reg-item { padding: 14px; margin-bottom: 10px; background: #f9fafb; border-radius: 10px; border-left: 4px solid #5b8def; }
.reg-title { font-weight: 700; color: #1a1a2e; font-size: 15px; margin-bottom: 6px; }
.reg-clause { font-size: 13px; color: #6b7280; margin-bottom: 4px; }
.reg-interp { font-size: 13px; color: #374151; line-height: 1.6; }
.sug-box { padding: 12px; background: #fef3c7; border-radius: 8px; font-size: 13px; } .sug-box p { margin: 4px 0 0 0; }
</style>
