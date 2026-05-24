<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>多国出口标签审核</h2>
    </div>

    <el-row :gutter="16">
      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span class="card-header">📤 上传标签</span></template>
          <el-form label-width="100px">
            <el-form-item label="目标市场">
              <el-select v-model="targetMarket" placeholder="选择出口国家/地区" style="width:100%" size="large">
                <el-option v-for="m in markets" :key="m.value" :label="m.label" :value="m.value">
                  <span>{{ m.flag }} {{ m.label }}</span>
                </el-option>
              </el-select>
            </el-form-item>
            <el-form-item label="标签图片">
              <el-upload ref="uploadRef" class="label-upload" drag :auto-upload="false" :limit="1" :on-change="handleFileChange" :on-remove="handleFileRemove" accept="image/*" list-type="picture">
                <el-icon size="40"><UploadFilled /></el-icon>
                <div class="upload-text">拖拽或点击选择标签图片</div>
                <template #tip><div class="upload-tip">支持 jpg/png，建议清晰扫描件</div></template>
              </el-upload>
            </el-form-item>
            <el-form-item><el-button type="primary" size="large" @click="handleAudit" :loading="auditing" :disabled="!targetMarket||!selectedFile" style="width:100%">开始审核</el-button></el-form-item>
          </el-form>
        </el-card>
      </el-col>

      <el-col :span="12">
        <el-card shadow="hover">
          <template #header><span class="card-header">📋 审核结果</span></template>
          <div v-if="!audited && !auditing" class="empty-hint">选择目标市场并上传标签后，点击"开始审核"</div>
          <div v-if="auditing" class="empty-hint">🤖 AI 正在审核中...</div>
          <div v-if="audited && results.length>0">
            <div class="result-summary">
              <el-tag size="large" :type="allPassed?'success':'danger'">{{ allPassed ? '✅ 全部通过' : '❌ 存在不通过项' }}</el-tag>
              <span class="result-count">通过 {{ passCount }}/{{ results.length }}</span>
            </div>
            <div class="result-list">
              <div v-for="(r,i) in results" :key="i" class="result-item" :class="r.passed?'result-pass':'result-fail'">
                <div class="result-header"><span class="result-icon">{{ r.passed?'✅':'❌' }}</span><span class="result-name">{{ r.item }}</span></div>
                <div class="result-detail">{{ r.detail }}</div>
              </div>
            </div>
            <div v-if="summary" class="summary-box">
              <strong>总结：</strong>{{ summary }}
            </div>
          </div>
          <div v-if="audited && results.length===0 && !auditing" class="empty-hint">
            <p>{{ fallbackMsg }}</p>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import { compressImage } from '../../utils/compress'
import axios from 'axios'

const markets = [
  { value:'中国', label:'中国', flag:'🇨🇳' },
  { value:'印度尼西亚', label:'印度尼西亚', flag:'🇮🇩' },
  { value:'日本', label:'日本', flag:'🇯🇵' },
  { value:'美国', label:'美国', flag:'🇺🇸' },
  { value:'马来西亚', label:'马来西亚', flag:'🇲🇾' },
  { value:'加拿大', label:'加拿大', flag:'🇨🇦' },
  { value:'港澳地区', label:'港澳地区', flag:'🇭🇰🇲🇴' }
]

const targetMarket = ref('')
const uploadRef = ref(null)
const selectedFile = ref(null)
const auditing = ref(false)
const audited = ref(false)
const results = ref([])
const summary = ref('')
const fallbackMsg = ref('')
const passCount = computed(() => results.value.filter(r=>r.passed).length)
const allPassed = computed(() => results.value.length>0 && results.value.every(r=>r.passed))

const handleFileChange = async (file) => { selectedFile.value = await compressImage(file.raw) }
const handleFileRemove = () => { selectedFile.value = null }

const handleAudit = async () => {
  if (!targetMarket.value) { ElMessage.warning('请选择目标市场'); return }
  if (!selectedFile.value) { ElMessage.warning('请上传标签图片'); return }
  auditing.value = true; audited.value = false; results.value = []; summary.value = ''
  try {
    const u = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', u.id)
    fd.append('target_market', targetMarket.value)
    fd.append('file', selectedFile.value)
    const res = await axios.post('/api/ai-audit/export', fd)
    if (res.data.auditMethod === 'fallback') {
      fallbackMsg.value = res.data.message
      results.value = []
    } else {
      results.value = res.data.results || []
      summary.value = res.data.summary || ''
    }
    audited.value = true
  } catch (e) {
    ElMessage.error('审核失败，请重试')
  } finally { auditing.value = false }
}
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.label-upload { width:100% }
.label-upload :deep(.el-upload-dragger) { width:100% }
.upload-text { color:#606266; font-size:14px; margin-top:8px }
.upload-tip { color:#909399; font-size:12px; margin-top:4px }
.empty-hint { text-align:center; color:#c0c4cc; padding:60px 20px; font-size:15px; line-height:1.8 }
.result-summary { text-align:center; margin-bottom:12px }
.result-count { margin-left:10px; font-size:13px; color:#909399 }
.result-list { max-height:420px; overflow-y:auto }
.result-item { border:1px solid #ebeef5; border-radius:8px; padding:10px 14px; margin-bottom:8px }
.result-item.result-pass { border-left:4px solid #67c23a }
.result-item.result-fail { border-left:4px solid #f56c6c }
.result-header { display:flex; align-items:center; gap:8px; margin-bottom:4px }
.result-icon { font-size:16px }
.result-name { font-weight:bold; color:#303133 }
.result-detail { font-size:13px; color:#606266; margin-left:28px }
.summary-box { margin-top:12px; padding:12px; background:#f5f7fa; border-radius:8px; font-size:13px; color:#303133; line-height:1.6 }
</style>
