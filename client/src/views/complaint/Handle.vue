<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>客诉处理</h2>
      <div>
        <el-button @click="$router.push('/complaint/list')">← 返回列表</el-button>
      </div>
    </div>

    <div v-if="!id" class="empty-hint">请从客诉列表选择一条记录</div>

    <div v-else v-loading="loading">
      <el-row :gutter="16">
        <!-- 左侧：客诉信息 -->
        <el-col :span="14">
          <el-card shadow="hover">
            <template #header>
              <div style="display:flex;justify-content:space-between;align-items:center">
                <span class="card-header">📋 客诉详情 — {{ record.complaint_number }}</span>
                <el-tag :type="statusTag(record.status)" size="large">{{ record.status }}</el-tag>
              </div>
            </template>

            <el-descriptions :column="2" border size="small">
              <el-descriptions-item label="投诉人">{{ record.customer_name }}</el-descriptions-item>
              <el-descriptions-item label="联系方式">{{ record.customer_phone || '-' }}</el-descriptions-item>
              <el-descriptions-item label="投诉类型">
                <el-tag :type="typeTag(record.complaint_type)" size="small">{{ record.complaint_type }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="紧急程度">
                <el-tag :type="record.urgency==='紧急'?'danger':record.urgency==='一般'?'warning':'info'" size="small">{{ record.urgency }}</el-tag>
              </el-descriptions-item>
              <el-descriptions-item label="投诉渠道">{{ record.complaint_channel }}</el-descriptions-item>
              <el-descriptions-item label="投诉日期">{{ record.complaint_date }}</el-descriptions-item>
              <el-descriptions-item label="关联产品">{{ record.product_name || '-' }}</el-descriptions-item>
              <el-descriptions-item label="生产批次">{{ record.batch_no || '-' }}</el-descriptions-item>
              <el-descriptions-item label="处理人">{{ record.handler || '未分配' }}</el-descriptions-item>
              <el-descriptions-item label="满意度">{{ record.satisfaction_score ? record.satisfaction_score+'星' : '未评价' }}</el-descriptions-item>
            </el-descriptions>

            <el-divider />

            <div class="section-title">问题描述</div>
            <div class="problem-desc">{{ record.problem_desc }}</div>

            <div v-if="record.investigation_record" style="margin-top:12px">
              <div class="section-title">调查记录</div>
              <div class="problem-desc">{{ record.investigation_record }}</div>
            </div>

            <div v-if="record.handle_measure" style="margin-top:12px">
              <div class="section-title">处理措施</div>
              <div class="problem-desc">{{ record.handle_measure }}</div>
            </div>

            <!-- AI 回复 -->
            <div v-if="record.ai_reply" style="margin-top:12px">
              <div class="section-title">💬 AI 回复话术</div>
              <div class="ai-reply-box">{{ record.ai_reply }}</div>
            </div>
          </el-card>
        </el-col>

        <!-- 右侧：处理操作 -->
        <el-col :span="10">
          <el-card shadow="hover">
            <template #header><span class="card-header">⚙️ 处理操作</span></template>

            <!-- 状态流转 -->
            <div class="action-section">
              <div class="action-label">状态流转</div>
              <div class="status-flow">
                <el-steps :active="flowStep" finish-status="success" align-center>
                  <el-step title="待处理" />
                  <el-step title="处理中" />
                  <el-step title="待回复" />
                  <el-step title="已关闭" />
                </el-steps>
              </div>
              <div style="margin-top:12px;display:flex;gap:8px;flex-wrap:wrap">
                <el-button v-if="record.status==='待处理'" type="primary" @click="changeStatus('处理中')">开始处理</el-button>
                <el-button v-if="record.status==='处理中'" type="warning" @click="changeStatus('待回复')">提交回复</el-button>
                <el-button v-if="record.status==='待回复'" type="success" @click="openCloseDialog">关闭客诉</el-button>
              </div>
            </div>

            <el-divider />

            <!-- 分配处理人 -->
            <div class="action-section">
              <div class="action-label">分配处理人</div>
              <div style="display:flex;gap:8px">
                <el-input v-model="editHandler" placeholder="处理人姓名" size="small" style="flex:1" />
                <el-button type="primary" size="small" @click="updateField('handler', editHandler)">确认</el-button>
              </div>
            </div>

            <el-divider />

            <!-- 填写调查记录 -->
            <div class="action-section">
              <div class="action-label">调查记录</div>
              <el-input v-model="editInvestigation" type="textarea" :rows="3" size="small" placeholder="调查过程和发现..." />
              <el-button type="primary" size="small" style="margin-top:8px" @click="updateField('investigation_record', editInvestigation)">保存调查记录</el-button>
            </div>

            <el-divider />

            <!-- 处理措施 -->
            <div class="action-section">
              <div class="action-label">处理措施</div>
              <el-select v-model="editMeasure" style="width:100%" size="small">
                <el-option label="换货" value="换货" />
                <el-option label="退款" value="退款" />
                <el-option label="补偿" value="补偿" />
                <el-option label="换货+补偿" value="换货+补偿" />
                <el-option label="退款+补偿" value="退款+补偿" />
                <el-option label="解释说明" value="解释说明" />
                <el-option label="其他" value="其他" />
              </el-select>
              <el-button type="primary" size="small" style="margin-top:8px" @click="updateField('handle_measure', editMeasure)">确认措施</el-button>
            </div>

            <el-divider />

            <!-- 满意度 -->
            <div class="action-section">
              <div class="action-label">客户满意度</div>
              <el-rate v-model="editSatisfaction" :max="5" show-text :texts="['非常不满意','不满意','一般','满意','非常满意']" />
              <el-button type="primary" size="small" style="margin-top:8px" @click="updateField('satisfaction_score', editSatisfaction)">提交评分</el-button>
            </div>

            <!-- 处理记录 -->
            <el-divider />
            <div class="action-section">
              <div class="action-label">📝 处理记录 ({{ actions.length }})</div>
              <el-timeline v-if="actions.length>0" style="margin-top:8px">
                <el-timeline-item v-for="a in actions" :key="a.id" :timestamp="a.action_date" placement="top">
                  <div>{{ a.action_content }}</div>
                  <div style="font-size:12px;color:#909399">{{ a.handler }} · {{ a.action_result }}</div>
                </el-timeline-item>
              </el-timeline>
              <div v-else style="color:#c0c4cc;font-size:13px">暂无处理记录</div>
            </div>
          </el-card>
        </el-col>
      </el-row>
    </div>

    <!-- 关闭客诉弹窗 -->
    <el-dialog v-model="closeVisible" title="关闭客诉" width="400px">
      <el-form label-width="80px">
        <el-form-item label="关闭说明">
          <el-input v-model="closeNote" type="textarea" :rows="3" placeholder="关闭原因和总结..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="closeVisible=false">取消</el-button>
        <el-button type="success" @click="handleClose">确认关闭</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const route = useRoute()
const id = ref(route.query.id || null)
const record = ref({})
const actions = ref([])
const loading = ref(false)
const editHandler = ref('')
const editInvestigation = ref('')
const editMeasure = ref('')
const editSatisfaction = ref(0)
const closeVisible = ref(false)
const closeNote = ref('')

const flowStep = computed(() => {
  const map = { '待处理': 0, '处理中': 1, '待回复': 2, '已关闭': 3 }
  return map[record.value.status] || 0
})

const typeTag = (type) => ({ '异物':'danger', '变质':'danger', '过敏':'danger', '标签错误':'warning', '包装破损':'warning' }[type] || 'info')
const statusTag = (s) => ({ '待处理':'danger', '处理中':'warning', '待回复':'info', '已关闭':'success' }[s] || 'info')

const fetchRecord = async () => {
  if (!id.value) return
  loading.value = true
  try {
    const res = await request.get(`/complaints/${id.value}`)
    record.value = res.record || {}
    actions.value = res.actions || []
    editHandler.value = record.value.handler || ''
    editInvestigation.value = record.value.investigation_record || ''
    editMeasure.value = record.value.handle_measure || ''
    editSatisfaction.value = record.value.satisfaction_score || 0
  } catch {} finally { loading.value = false }
}

onMounted(fetchRecord)

const changeStatus = async (status) => {
  try {
    await request.put(`/complaints/${id.value}`, {
      user_id: JSON.parse(localStorage.getItem('user')).id,
      status,
      action_log: '状态变更为：' + status
    })
    ElMessage.success('状态已更新')
    fetchRecord()
  } catch { ElMessage.error('操作失败') }
}

const updateField = async (field, value) => {
  try {
    await request.put(`/complaints/${id.value}`, {
      user_id: JSON.parse(localStorage.getItem('user')).id,
      [field]: value,
      action_log: '更新了' + { handler: '处理人', investigation_record: '调查记录', handle_measure: '处理措施', satisfaction_score: '满意度评分' }[field]
    })
    ElMessage.success('已更新')
    fetchRecord()
  } catch { ElMessage.error('更新失败') }
}

const openCloseDialog = () => { closeNote.value = ''; closeVisible.value = true }
const handleClose = async () => {
  try {
    await request.put(`/complaints/${id.value}`, {
      user_id: JSON.parse(localStorage.getItem('user')).id,
      status: '已关闭',
      close_date: new Date().toISOString().slice(0, 10),
      action_log: '关闭客诉：' + (closeNote.value || '处理完成')
    })
    ElMessage.success('客诉已关闭')
    closeVisible.value = false
    fetchRecord()
  } catch { ElMessage.error('操作失败') }
}

watch(() => route.query.id, (val) => {
  id.value = val
  if (val) fetchRecord()
})
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.empty-hint { text-align:center; color:#c0c4cc; padding:80px 20px; font-size:15px }
.section-title { font-weight:bold; color:#303133; margin-bottom:8px }
.problem-desc { padding:12px; background:#f5f7fa; border-radius:8px; font-size:14px; line-height:1.8; color:#303133; white-space:pre-wrap }
.ai-reply-box { padding:12px; background:#ecf5ff; border-radius:8px; border-left:4px solid #409eff; font-size:14px; line-height:1.8; color:#303133; white-space:pre-wrap }
.action-section { padding:4px 0 }
.action-label { font-weight:bold; color:#606266; margin-bottom:8px; font-size:14px }
</style>
