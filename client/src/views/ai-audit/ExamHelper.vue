<template>
  <div class="page-container">
    <div class="toolbar"><h2>📝 培训出题助手</h2></div>
    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-title">📚 出题设置</span></template>
          <el-form :model="form" label-position="top">
            <el-form-item label="课程/内容来源"><el-input v-model="form.course_content" type="textarea" :rows="5" placeholder="粘贴课程内容、SOP文本或法规条款，AI将据此生成考题" /></el-form-item>
            <el-form-item label="题型"><el-checkbox-group v-model="form.question_types"><el-checkbox label="single">单选题</el-checkbox><el-checkbox label="multiple">多选题</el-checkbox><el-checkbox label="judge">判断题</el-checkbox></el-checkbox-group></el-form-item>
            <el-form-item label="难度"><el-radio-group v-model="form.difficulty"><el-radio label="basic">基础</el-radio><el-radio label="medium">中级</el-radio><el-radio label="advanced">高级</el-radio></el-radio-group></el-form-item>
            <el-form-item label="题目数量"><el-slider v-model="form.count" :min="3" :max="20" show-input style="width:100%" /></el-form-item>
            <el-button type="primary" size="large" style="width:100%" @click="handleGenerate" :loading="loading">🤖 AI 生成试卷</el-button>
          </el-form>
        </el-card>
      </el-col>
      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><div class="result-header"><span class="card-title">📋 生成试卷</span><span v-if="result" class="exam-meta">共 {{ result.questions.length }} 题 | {{ result.difficulty_label }}</span></div></template>
          <div v-if="!result && !loading && !fallback" class="empty">设置出题参数后点击"AI 生成试卷"</div>
          <div v-if="loading" class="empty">🤖 AI 正在生成考题...</div>
          <div v-if="result" class="exam-body">
            <div class="q-item" v-for="(q, i) in result.questions" :key="i">
              <div class="q-num">{{ i + 1 }}. <span class="q-type-tag">{{ q.type === 'single' ? '单选' : q.type === 'multiple' ? '多选' : '判断' }}</span></div>
              <div class="q-stem">{{ q.stem }}</div>
              <div class="q-options" v-if="q.options">
                <div v-for="(opt, j) in q.options" :key="j" class="q-opt">{{ String.fromCharCode(65+j) }}. {{ opt }}</div>
              </div>
              <div class="q-answer"><strong>答案：</strong>{{ q.answer }} <span v-if="q.explanation" class="q-explain">（{{ q.explanation }}）</span></div>
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
const form = reactive({ course_content: '', question_types: ['single'], difficulty: 'basic', count: 5 })
const handleGenerate = async () => {
  if (!form.course_content || form.question_types.length === 0) return
  loading.value = true; result.value = null; fallback.value = ''
  try {
    const res = await axios.post('/api/ai-tool/exam', { ...form })
    res.data.method === 'fallback' ? fallback.value = res.data.message : result.value = res.data
  } catch { fallback.value = '生成失败，请重试' } finally { loading.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { margin-bottom: 16px; } .toolbar h2 { margin: 0; color: #303133; }
.card-title { font-weight: bold; color: #303133; }
.empty { text-align: center; color: #c0c4cc; padding: 80px 20px; font-size: 15px; white-space: pre-wrap; }
.result-header { display: flex; justify-content: space-between; align-items: center; }
.exam-meta { font-size: 12px; color: #9ca3af; }
.exam-body { max-height: 600px; overflow-y: auto; padding: 10px 0; }
.q-item { padding: 14px; margin-bottom: 10px; background: #f9fafb; border-radius: 10px; }
.q-num { font-weight: 700; color: #1a1a2e; margin-bottom: 6px; }
.q-type-tag { font-size: 11px; background: #e8f0fe; color: #5b8def; padding: 1px 8px; border-radius: 4px; font-weight: normal; }
.q-stem { font-size: 14px; color: #374151; line-height: 1.6; margin-bottom: 8px; }
.q-options { margin-left: 16px; }
.q-opt { font-size: 13px; color: #6b7280; padding: 2px 0; }
.q-answer { font-size: 13px; color: #16a34a; margin-top: 8px; padding: 6px 10px; background: #f0fdf4; border-radius: 6px; }
.q-explain { color: #6b7280; font-weight: normal; }
</style>
