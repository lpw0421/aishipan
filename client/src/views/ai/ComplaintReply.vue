<template>
  <div class="page-container">
    <div class="toolbar"><h2>AI 客诉回复生成</h2></div>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-header">📝 客诉信息</span></template>
          <el-form label-width="80px" size="large">
            <el-form-item label="投诉类型">
              <el-select v-model="form.complaint_type" placeholder="选择投诉类型" style="width:100%">
                <el-option v-for="t in types" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
            <el-form-item label="客户名称"><el-input v-model="form.customer_name" placeholder="如：张先生" /></el-form-item>
            <el-form-item label="关联产品"><el-input v-model="form.product_name" placeholder="如：XX牌牛肉酱 200g" /></el-form-item>
            <el-form-item label="处理措施">
              <el-select v-model="form.handle_measure" placeholder="选择处理措施" style="width:100%">
                <el-option label="换货" value="换货" />
                <el-option label="退款" value="退款" />
                <el-option label="补偿" value="补偿" />
                <el-option label="换货+补偿" value="换货+补偿" />
                <el-option label="退款+补偿" value="退款+补偿" />
                <el-option label="解释说明" value="解释说明" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-form>
          <div class="section-label">问题描述</div>
          <el-input v-model="form.problem_desc" type="textarea" :rows="5" placeholder="描述客户投诉的具体问题..." />
          <div style="margin-top:16px">
            <el-button type="primary" size="large" @click="handleGenerate" :loading="loading" :disabled="!form.problem_desc" style="width:100%">🤖 AI 生成回复话术</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-header">💬 回复话术</span></template>
          <div v-if="!generated && !loading" class="empty-hint">填写客诉信息后，点击"AI 生成"</div>
          <div v-if="loading" class="empty-hint">🤖 AI 正在生成回复...</div>

          <div v-if="generated && replyContent" class="reply-body">
            <div class="reply-meta">
              <el-tag v-if="result.tone" type="primary">{{ toneLabel(result.tone) }}</el-tag>
              <el-tag v-if="result.reply_channel" type="info">{{ result.reply_channel }}</el-tag>
            </div>
            <div class="reply-box">
              <div class="reply-text">{{ replyContent }}</div>
            </div>
            <div class="reply-actions">
              <el-button type="primary" @click="copyReply">📋 复制话术</el-button>
              <el-button type="success" @click="editReply">✏️ 修改后使用</el-button>
            </div>
            <div v-if="result.compensation_suggested" class="info-line">
              <strong>建议补偿：</strong>{{ result.compensation_suggested }}
            </div>
            <div v-if="result.follow_up_action" class="info-line">
              <strong>跟进措施：</strong>{{ result.follow_up_action }}
            </div>
          </div>

          <!-- 编辑模式 -->
          <div v-if="editMode" style="margin-top:12px">
            <el-input v-model="replyContent" type="textarea" :rows="8" />
            <el-button type="primary" @click="editMode = false" style="margin-top:8px">确认修改</el-button>
          </div>

          <div v-if="generated && !replyContent && !loading" class="empty-hint"><p>{{ fallbackMsg }}</p></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, reactive } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'

const types = ['异物', '变质', '过敏', '标签错误', '包装破损', '缺斤少两', '服务态度', '其他']
const form = reactive({ complaint_type: '', customer_name: '', product_name: '', handle_measure: '', problem_desc: '' })
const loading = ref(false)
const generated = ref(false)
const result = ref({})
const replyContent = ref('')
const fallbackMsg = ref('')
const editMode = ref(false)

const toneLabel = (tone) => ({ '正式': '📋 正式', '亲切': '😊 亲切', '严肃': '⚠️ 严肃' }[tone] || tone)

const handleGenerate = async () => {
  if (!form.problem_desc) { ElMessage.warning('请填写问题描述'); return }
  loading.value = true; generated.value = false; result.value = {}; replyContent.value = ''; editMode.value = false
  try {
    const res = await axios.post('/api/ai/complaint-reply', { ...form })
    if (res.data.method === 'fallback') {
      fallbackMsg.value = res.data.message
      replyContent.value = res.data.template_reply || ''
    } else {
      result.value = res.data
      replyContent.value = res.data.reply_content || ''
    }
    generated.value = true
  } catch (e) {
    ElMessage.error('生成失败，请重试')
  } finally { loading.value = false }
}

const copyReply = () => {
  navigator.clipboard.writeText(replyContent.value).then(() => ElMessage.success('已复制到剪贴板'))
}
const editReply = () => { editMode.value = true }
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.section-label { font-weight:bold; color:#606266; margin-bottom:8px; font-size:14px }
.empty-hint { text-align:center; color:#c0c4cc; padding:80px 20px; font-size:15px; line-height:1.8; white-space:pre-line }
.reply-body { padding:8px 0 }
.reply-meta { display:flex; gap:8px; margin-bottom:12px }
.reply-box { padding:20px; background:#f5f7fa; border-radius:8px; border-left:4px solid #409eff }
.reply-text { font-size:15px; line-height:2; color:#303133; white-space:pre-wrap }
.reply-actions { display:flex; gap:10px; margin-top:16px; justify-content:center }
.info-line { margin-top:10px; padding:8px 12px; background:#f5f7fa; border-radius:6px; font-size:13px; color:#303133 }
</style>
