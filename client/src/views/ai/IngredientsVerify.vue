<template>
  <div class="page-container">
    <div class="toolbar"><h2>AI 配料表校验</h2></div>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-header">📝 输入配料表</span></template>
          <el-input v-model="ingredientText" type="textarea" :rows="10" placeholder="请粘贴完整的配料表文字，例如：&#10;水、牛肉、大豆油、白砂糖、食盐、香辛料、山梨酸钾、食用香精" />
          <div style="margin-top:16px">
            <el-button type="primary" size="large" @click="handleVerify" :loading="verifying" :disabled="!ingredientText.trim()" style="width:100%">🤖 AI 校验配料表</el-button>
          </div>
          <div class="check-dims">
            <div class="dim-title">校验维度：</div>
            <el-tag size="small" style="margin:2px">添加量排序</el-tag>
            <el-tag size="small" style="margin:2px">配料名称规范</el-tag>
            <el-tag size="small" style="margin:2px">过敏原提示</el-tag>
            <el-tag size="small" style="margin:2px">添加剂标识</el-tag>
            <el-tag size="small" style="margin:2px">复配添加剂</el-tag>
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-header">📋 校验结果</span></template>
          <div v-if="!verified && !verifying" class="empty-hint">粘贴配料表后，点击"AI 校验"开始检查</div>
          <div v-if="verifying" class="empty-hint">🤖 AI 正在深度校验配料表...</div>
          <div v-if="verified && results.length>0">
            <div class="result-summary">
              <el-tag size="large" :type="allPassed?'success':someFailed?'danger':'warning'">{{ statusText }}</el-tag>
              <span class="result-count">通过 {{ passCount }}/{{ results.length }}</span>
            </div>
            <div class="result-list">
              <div v-for="(r,i) in results" :key="i" class="result-item" :class="r.passed===true?'result-pass':r.passed===false?'result-fail':'result-warn'">
                <div class="result-header">
                  <span class="result-icon">{{ r.passed===true?'✅':r.passed===false?'❌':'⚠️' }}</span>
                  <span class="result-name">{{ r.dimension }}</span>
                </div>
                <div class="result-detail">{{ r.detail }}</div>
                <div v-if="r.suggestion" class="result-suggestion">💡 {{ r.suggestion }}</div>
              </div>
            </div>
            <div v-if="allergens.length>0" class="info-box">
              <strong>⚠️ 识别到的过敏原：</strong>
              <el-tag v-for="a in allergens" :key="a" type="warning" size="small" style="margin:2px">{{ a }}</el-tag>
            </div>
            <div v-if="additives.length>0" class="info-box">
              <strong>🧪 识别到的添加剂：</strong>
              <el-tag v-for="a in additives" :key="a" type="info" size="small" style="margin:2px">{{ a }}</el-tag>
            </div>
            <div v-if="summary" class="summary-box"><strong>总结：</strong>{{ summary }}</div>
          </div>
          <div v-if="verified && results.length===0 && !verifying" class="empty-hint"><p>{{ fallbackMsg }}</p></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const ingredientText = ref('')
const verifying = ref(false)
const verified = ref(false)
const results = ref([])
const allergens = ref([])
const additives = ref([])
const summary = ref('')
const fallbackMsg = ref('')

const passCount = computed(() => results.value.filter(r => r.passed === true).length)
const someFailed = computed(() => results.value.some(r => r.passed === false))
const allPassed = computed(() => results.value.length > 0 && results.value.every(r => r.passed === true))
const statusText = computed(() => allPassed.value ? '✅ 全部通过' : someFailed.value ? '❌ 存在不通过项' : '⚠️ 部分需人工确认')

const handleVerify = async () => {
  if (!ingredientText.value.trim()) { ElMessage.warning('请输入配料表文字'); return }
  verifying.value = true; verified.value = false; results.value = []; allergens.value = []; additives.value = []; summary.value = ''
  try {
    const res = await axios.post('/api/ai-audit/ingredients', { ingredient_text: ingredientText.value.trim() })
    if (res.data.method === 'fallback') {
      fallbackMsg.value = res.data.message
      results.value = []
    } else {
      results.value = res.data.results || []
      allergens.value = res.data.allergens || []
      additives.value = res.data.additives || []
      summary.value = res.data.summary || ''
    }
    verified.value = true
  } catch (e) {
    ElMessage.error('校验失败，请重试')
  } finally { verifying.value = false }
}
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.check-dims { margin-top:12px; padding:10px; background:#f5f7fa; border-radius:8px }
.dim-title { font-size:13px; color:#909399; margin-bottom:4px }
.empty-hint { text-align:center; color:#c0c4cc; padding:80px 20px; font-size:15px; line-height:1.8 }
.result-summary { text-align:center; margin-bottom:12px }
.result-count { margin-left:10px; font-size:13px; color:#909399 }
.result-list { max-height:380px; overflow-y:auto }
.result-item { border:1px solid #ebeef5; border-radius:8px; padding:10px 14px; margin-bottom:8px }
.result-item.result-pass { border-left:4px solid #67c23a }
.result-item.result-fail { border-left:4px solid #f56c6c }
.result-item.result-warn { border-left:4px solid #e6a23c }
.result-header { display:flex; align-items:center; gap:8px; margin-bottom:4px }
.result-icon { font-size:16px }
.result-name { font-weight:bold; color:#303133 }
.result-detail { font-size:13px; color:#606266; margin-left:28px }
.result-suggestion { font-size:13px; color:#e6a23c; margin-left:28px; margin-top:4px }
.info-box { margin-top:10px; padding:10px; background:#f5f7fa; border-radius:8px; font-size:13px; color:#303133; line-height:2 }
.summary-box { margin-top:10px; padding:12px; background:#f0f9eb; border-radius:8px; font-size:13px; color:#303133; line-height:1.6 }
</style>
