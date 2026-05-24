<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>原料验收</h2>
      <el-button type="primary" @click="openRegister">到货登记</el-button>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="4" v-for="s in statsCards" :key="s.label">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-value" :style="{color:s.color}">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索 -->
    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索批次号/原料/供应商" style="width:260px" clearable @clear="fetchList" @keyup.enter="fetchList" />
      <el-select v-model="filterStatus" placeholder="验收状态" style="width:130px" clearable @change="fetchList">
        <el-option label="待验收" value="待验收" /><el-option label="已检查" value="已检查" /><el-option label="已完成" value="已完成" />
      </el-select>
      <el-select v-model="filterResult" placeholder="判定结果" style="width:130px" clearable @change="fetchList">
        <el-option label="合格" value="合格" /><el-option label="让步接收" value="让步接收" /><el-option label="拒收" value="拒收" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <!-- 批次列表 -->
    <el-card>
      <el-table :data="list" v-loading="loading" stripe @row-click="openDetail">
        <el-table-column prop="batch_number" label="批次号" width="140" />
        <el-table-column prop="material_name" label="原料名称" min-width="120" />
        <el-table-column prop="supplier" label="供应商" min-width="140" />
        <el-table-column prop="arrival_time" label="到货时间" width="160">
          <template #default="{row}">{{ row.arrival_time?.slice(0,16) }}</template>
        </el-table-column>
        <el-table-column prop="actual_quantity" label="到货数量" width="100" />
        <el-table-column prop="inspector" label="验收人" width="80" />
        <el-table-column prop="status" label="验收状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status==='待验收'?'info':row.status==='已检查'?'warning':'success'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="judge_result" label="判定结果" width="100">
          <template #default="{row}">
            <el-tag v-if="row.judge_result==='合格'" type="success" size="small">合格</el-tag>
            <el-tag v-else-if="row.judge_result==='让步接收'" type="warning" size="small">让步接收</el-tag>
            <el-tag v-else-if="row.judge_result==='拒收'" type="danger" size="small">拒收</el-tag>
            <span v-else class="text-muted">待判定</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{row}">
            <template v-if="row.status === '待验收'">
              <el-button size="small" type="primary" @click.stop="openDetail(row)">开始验收</el-button>
            </template>
            <template v-else>
              <el-button size="small" @click.stop="openDetail(row)">详情</el-button>
              <el-button size="small" type="danger" @click.stop="deleteBatch(row)">删除</el-button>
            </template>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 到货登记对话框 -->
    <el-dialog title="到货登记" v-model="showRegister" width="550px" @close="resetRegister">
      <el-form :model="register" label-width="100px">
        <el-form-item label="原料名称"><el-input v-model="register.material_name" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="register.supplier" /></el-form-item>
        <el-form-item label="采购单号"><el-input v-model="register.po_number" placeholder="PO-xxx" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="计划数量"><el-input-number v-model="register.planned_quantity" :min="0" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="到货数量"><el-input-number v-model="register.actual_quantity" :min="0" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="验收人"><el-input v-model="register.inspector" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showRegister = false">取消</el-button>
        <el-button type="primary" @click="doRegister">确认登记</el-button>
      </template>
    </el-dialog>

    <!-- 验收详情对话框（7步流程） -->
    <el-dialog :title="'验收详情 — ' + currentBatch?.batch_number" v-model="showDetail" width="900px" top="30px">
      <div v-if="currentBatch">
        <el-steps :active="activeStep" finish-status="success" align-center class="mb20">
          <el-step title="基本信息" />
          <el-step title="证件核对" />
          <el-step title="感官检查" />
          <el-step title="温度检测" />
          <el-step title="包装检查" />
          <el-step title="AI风险评估" />
          <el-step title="最终判定" />
        </el-steps>

        <!-- Step 1: 基本信息 -->
        <div v-if="activeStep === 0">
          <el-descriptions :column="2" border>
            <el-descriptions-item label="批次号">{{ currentBatch.batch_number }}</el-descriptions-item>
            <el-descriptions-item label="到货时间">{{ currentBatch.arrival_time?.slice(0,16) }}</el-descriptions-item>
            <el-descriptions-item label="原料名称">{{ currentBatch.material_name }}</el-descriptions-item>
            <el-descriptions-item label="供应商">{{ currentBatch.supplier }}</el-descriptions-item>
            <el-descriptions-item label="采购单号">{{ currentBatch.po_number }}</el-descriptions-item>
            <el-descriptions-item label="计划数量">{{ currentBatch.planned_quantity }} kg</el-descriptions-item>
            <el-descriptions-item label="到货数量">{{ currentBatch.actual_quantity }} kg</el-descriptions-item>
            <el-descriptions-item label="验收人">{{ currentBatch.inspector }}</el-descriptions-item>
          </el-descriptions>
          <div class="step-actions"><el-button type="primary" @click="activeStep = 1">下一步：证件核对</el-button></div>
        </div>

        <!-- Step 2: 证件核对 -->
        <div v-if="activeStep === 1">
          <el-table :data="certItems" stripe><el-table-column prop="name" label="检查项" width="200" /><el-table-column prop="desc" label="说明" /><el-table-column prop="status" label="状态" width="120"><template #default="{row,$index}"><el-select v-model="certItems[$index].status" size="small"><el-option label="通过" value="pass" /><el-option label="不通过" value="fail" /><el-option label="不适用" value="na" /></el-select></template></el-table-column></el-table>
          <div class="step-actions">
            <el-button @click="activeStep = 0">上一步</el-button>
            <el-button type="primary" @click="activeStep = 2">下一步：感官检查</el-button>
          </div>
        </div>

        <!-- Step 3: 感官检查 -->
        <div v-if="activeStep === 2">
          <el-table :data="sensoryItems" stripe><el-table-column prop="name" label="检查项" width="150" /><el-table-column prop="standard" label="标准" /><el-table-column prop="actual" label="实际结果" width="200"><template #default="{row,$index}"><el-input v-model="sensoryItems[$index].actual" size="small" /></template></el-table-column><el-table-column prop="status" label="状态" width="100"><template #default="{row,$index}"><el-select v-model="sensoryItems[$index].status" size="small"><el-option label="通过" value="pass" /><el-option label="异常" value="warn" /><el-option label="不通过" value="fail" /></el-select></template></el-table-column></el-table>
          <div class="step-actions">
            <el-button @click="activeStep = 1">上一步</el-button>
            <el-button type="primary" @click="activeStep = 3">下一步：温度检测</el-button>
          </div>
        </div>

        <!-- Step 4: 温度检测 -->
        <div v-if="activeStep === 3">
          <el-table :data="tempItems" stripe><el-table-column prop="name" label="检查项" width="200" /><el-table-column prop="standard" label="标准要求" /><el-table-column prop="actual" label="实测值" width="160"><template #default="{row,$index}"><el-input v-model="tempItems[$index].actual" size="small" /></template></el-table-column><el-table-column prop="status" label="状态" width="100"><template #default="{row,$index}"><el-select v-model="tempItems[$index].status" size="small"><el-option label="通过" value="pass" /><el-option label="异常" value="warn" /><el-option label="不通过" value="fail" /></el-select></template></el-table-column></el-table>
          <div class="step-actions">
            <el-button @click="activeStep = 2">上一步</el-button>
            <el-button type="primary" @click="activeStep = 4">下一步：包装检查</el-button>
          </div>
        </div>

        <!-- Step 5: 包装检查 -->
        <div v-if="activeStep === 4">
          <el-table :data="packageItems" stripe><el-table-column prop="name" label="检查项" width="150" /><el-table-column prop="standard" label="标准" /><el-table-column prop="actual" label="实际" width="200"><template #default="{row,$index}"><el-input v-model="packageItems[$index].actual" size="small" /></template></el-table-column><el-table-column prop="status" label="状态" width="100"><template #default="{row,$index}"><el-select v-model="packageItems[$index].status" size="small"><el-option label="通过" value="pass" /><el-option label="异常" value="warn" /><el-option label="不通过" value="fail" /></el-select></template></el-table-column></el-table>
          <div class="step-actions">
            <el-button @click="activeStep = 3">上一步</el-button>
            <el-button type="primary" @click="doSaveInspection">保存检查结果，进入AI评估</el-button>
          </div>
        </div>

        <!-- Step 6: AI 风险评估 -->
        <div v-if="activeStep === 5">
          <div v-if="aiRiskLoading" class="center"><el-icon class="is-loading" :size="32"><Loading /></el-icon><p>AI 正在评估风险...</p></div>
          <div v-else-if="aiRisk">
            <el-alert :title="'风险等级：' + aiRisk.risk_level + ' 风险（' + aiRisk.risk_score + '/100）'" :type="aiRisk.risk_level==='高'?'error':aiRisk.risk_level==='中'?'warning':'success'" :closable="false" class="mb20" />
            <el-descriptions :column="2" border class="mb20">
              <el-descriptions-item label="供应商历史合格率">{{ aiRisk.supplier_history_rate }}%</el-descriptions-item>
              <el-descriptions-item label="原料固有风险" v-if="aiRisk.dimension_scores">{{ JSON.parse(typeof aiRisk.dimension_scores === 'string' ? aiRisk.dimension_scores : '{}').materialRisk || '-' }}</el-descriptions-item>
            </el-descriptions>
            <el-card class="mb20"><strong>AI 建议：</strong><p>{{ aiRisk.ai_suggestion }}</p></el-card>
          </div>
          <div v-else><el-empty description="请先保存检查结果" /></div>
          <div class="step-actions">
            <el-button @click="activeStep = 4">上一步</el-button>
            <el-button v-if="!aiRisk" type="primary" @click="doAiRisk" :loading="aiRiskLoading">AI 风险评估</el-button>
            <el-button v-else type="primary" @click="activeStep = 6">下一步：最终判定</el-button>
          </div>
        </div>

        <!-- Step 7: 最终判定 -->
        <div v-if="activeStep === 6">
          <el-form label-width="100px">
            <el-form-item label="最终判定">
              <el-radio-group v-model="judgeResult">
                <el-radio value="合格">✅ 合格 — 所有检查项通过，直接入库</el-radio>
                <el-radio value="让步接收">⚠️ 让步接收 — 1-2项轻微不合格，审批后限条件使用</el-radio>
                <el-radio value="拒收">❌ 拒收 — 证件缺失/温度严重超标/感官明显异常</el-radio>
              </el-radio-group>
            </el-form-item>
            <el-form-item v-if="judgeResult === '让步接收'" label="审批人"><el-input v-model="judgeApprover" style="width:200px" /></el-form-item>
            <el-form-item v-if="judgeResult === '让步接收'" label="使用限制"><el-input v-model="concessionLimit" placeholder="如：48h内使用完毕" style="width:300px" /></el-form-item>
          </el-form>
          <div class="step-actions">
            <el-button @click="activeStep = 5">上一步</el-button>
            <el-button type="primary" @click="doJudge">确认判定</el-button>
          </div>
        </div>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Loading } from '@element-plus/icons-vue'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const list = ref([])
const loading = ref(false)
const keyword = ref('')
const filterStatus = ref('')
const filterResult = ref('')

// 统计
const statsCards = ref([
  { label: '验收批次', value: 0, color: '#409eff' },
  { label: '待验收', value: 0, color: '#e6a23c' },
  { label: '合格', value: 0, color: '#67c23a' },
  { label: '拒收', value: 0, color: '#f56c6c' },
  { label: '今日到货', value: 0, color: '#909399' }
])

// 到货登记
const showRegister = ref(false)
const register = reactive({
  material_name: '', supplier: '', po_number: '', planned_quantity: 0, actual_quantity: 0, inspector: ''
})

// 验收详情
const showDetail = ref(false)
const currentBatch = ref(null)
const activeStep = ref(0)
const judgeResult = ref('')
const judgeApprover = ref('')
const concessionLimit = ref('')
const aiRisk = ref(null)
const aiRiskLoading = ref(false)

// 检查项数据
const certItems = ref([
  { name: '供应商营业执照', desc: '有效期内', status: 'pass' },
  { name: '食品生产/经营许可证', desc: '有效期内', status: 'pass' },
  { name: '产品检验报告（同批次）', desc: '报告编号', status: 'pass' },
  { name: '动物检疫合格证（肉类适用）', desc: '检疫证号', status: 'na' },
  { name: '进口原料报关单（如适用）', desc: '—', status: 'na' }
])

const sensoryItems = ref([
  { name: '色泽', standard: '正常鲜红色', actual: '正常鲜红色', status: 'pass' },
  { name: '气味', standard: '正常肉腥味，无异味', actual: '正常', status: 'pass' },
  { name: '弹性', standard: '指压后凹陷迅速恢复', actual: '恢复较慢', status: 'warn' },
  { name: '粘度', standard: '表面微干或湿润，不粘手', actual: '正常', status: 'pass' },
  { name: '组织状态', standard: '肌肉纤维清晰，脂肪洁白', actual: '正常', status: 'pass' },
  { name: '异物', standard: '无肉眼可见异物', actual: '无', status: 'pass' }
])

const tempItems = ref([
  { name: '到货温度（冷藏）', standard: '0~4°C', actual: '5.2°C', status: 'warn' },
  { name: '到货温度（冷冻）', standard: '≤ -18°C', actual: '—', status: 'na' },
  { name: '到货温度（常温）', standard: '≤ 25°C', actual: '—', status: 'na' },
  { name: '车厢温度', standard: '与产品温度一致', actual: '5.0°C', status: 'warn' }
])

const packageItems = ref([
  { name: '包装完整性', standard: '无破损、无泄漏', actual: '完好', status: 'pass' },
  { name: '标签规范性', standard: '品名/日期/批次齐全', actual: '齐全', status: 'pass' },
  { name: '生产日期', standard: '在保质期内', actual: '2026-05-20，合格', status: 'pass' },
  { name: '保质期', standard: '剩余 > 1/3', actual: '剩余 80%', status: 'pass' }
])

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterStatus.value) params.status = filterStatus.value
    if (filterResult.value) params.judge_result = filterResult.value
    const { data } = await axios.get('/api/raw-material/batches', { params })
    list.value = data.list
  } finally { loading.value = false }
}

async function fetchStats() {
  const { data } = await axios.get('/api/raw-material/batches/stats', { params: { user_id: user.id } })
  statsCards.value = [
    { label: '验收批次', value: data.total, color: '#409eff' },
    { label: '待验收', value: data.pending, color: '#e6a23c' },
    { label: '合格', value: data.qualified, color: '#67c23a' },
    { label: '拒收', value: data.rejected, color: '#f56c6c' },
    { label: '今日到货', value: data.todayCount, color: '#909399' }
  ]
}

function openRegister() { showRegister.value = true }

async function doRegister() {
  if (!register.material_name) return ElMessage.warning('请填写原料名称')
  await axios.post('/api/raw-material/batches', { user_id: user.id, ...register })
  ElMessage.success('到货登记成功')
  showRegister.value = false
  resetRegister()
  fetchList()
  fetchStats()
}

function resetRegister() {
  Object.assign(register, { material_name: '', supplier: '', po_number: '', planned_quantity: 0, actual_quantity: 0, inspector: '' })
}

async function openDetail(row) {
  showDetail.value = true
  activeStep.value = 0
  judgeResult.value = ''
  aiRisk.value = null
  // 加载完整详情
  const { data } = await axios.get(`/api/raw-material/batches/${row.id}`)
  currentBatch.value = data.batch
  if (data.inspection) {
    if (data.inspection.cert_check) certItems.value = JSON.parse(typeof data.inspection.cert_check === 'string' ? data.inspection.cert_check : '{}').items || certItems.value
    if (data.inspection.sensory_check) sensoryItems.value = JSON.parse(typeof data.inspection.sensory_check === 'string' ? data.inspection.sensory_check : '{}').items || sensoryItems.value
    if (data.inspection.temp_check) tempItems.value = JSON.parse(typeof data.inspection.temp_check === 'string' ? data.inspection.temp_check : '{}').items || tempItems.value
    if (data.inspection.packaging_check) packageItems.value = JSON.parse(typeof data.inspection.packaging_check === 'string' ? data.inspection.packaging_check : '{}').items || packageItems.value
    activeStep.value = 5
  }
  if (data.aiRisk) {
    aiRisk.value = data.aiRisk
    activeStep.value = 5
  }
  if (data.batch.judge_result) {
    judgeResult.value = data.batch.judge_result
    activeStep.value = 6
  }
}

async function deleteBatch(row) {
  await ElMessageBox.confirm('确定删除该批次吗？', '提示', { type: 'warning' })
  await axios.delete(`/api/raw-material/batches/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
  fetchStats()
}

async function doSaveInspection() {
  if (!currentBatch.value) return
  await axios.put(`/api/raw-material/batches/${currentBatch.value.id}/inspect`, {
    user_id: user.id,
    cert_check: { items: certItems.value },
    sensory_check: { items: sensoryItems.value },
    temp_check: { items: tempItems.value },
    packaging_check: { items: packageItems.value }
  })
  ElMessage.success('检查结果已保存')
  activeStep.value = 5
}

async function doAiRisk() {
  if (!currentBatch.value) return
  aiRiskLoading.value = true
  try {
    const tempWarnCount = tempItems.value.filter(t => t.status === 'warn' || t.status === 'fail').length
    const sensoryAbnormal = sensoryItems.value.filter(s => s.status === 'warn' || s.status === 'fail').length
    const certFailCount = certItems.value.filter(c => c.status === 'fail').length
    const certScore = 100 - certFailCount * 20
    const tempDeviation = tempWarnCount > 0 ? 1.2 : 0
    const { data } = await axios.post('/api/raw-material/ai-risk', {
      user_id: user.id,
      batch_id: currentBatch.value.id,
      material_id: currentBatch.value.material_id,
      cert_score: certScore,
      temp_deviation: tempDeviation,
      sensory_abnormal: sensoryAbnormal
    })
    aiRisk.value = data
  } finally { aiRiskLoading.value = false }
}

async function doJudge() {
  if (!judgeResult.value) return ElMessage.warning('请选择判定结果')
  if (judgeResult.value === '让步接收' && !judgeApprover.value) return ElMessage.warning('让步接收需要审批人签字')

  await axios.put(`/api/raw-material/batches/${currentBatch.value.id}/judge`, {
    user_id: user.id,
    judge_result: judgeResult.value,
    judge_approver: judgeApprover.value
  })

  // 让步接收：创建让步记录
  if (judgeResult.value === '让步接收' && concessionLimit.value) {
    await axios.post('/api/raw-material/concessions', {
      user_id: user.id,
      batch_id: currentBatch.value.id,
      concession_reason: '部分检查项异常，审批后限条件使用',
      usage_limit: concessionLimit.value,
      approver: judgeApprover.value,
      usage_deadline: new Date(Date.now() + 2*24*60*60*1000).toISOString().slice(0, 10)
    })
  }

  ElMessage.success('判定完成')
  showDetail.value = false
  fetchList()
  fetchStats()
}

onMounted(() => { fetchList(); fetchStats() })
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.stats-row{margin-bottom:16px}
.stat-card{text-align:center;cursor:pointer}
.stat-value{font-size:28px;font-weight:700}
.stat-label{font-size:13px;color:#909399;margin-top:4px}
.filter-card{margin-bottom:16px;display:flex;gap:12px;align-items:center}
.filter-card :deep(.el-card__body){display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.mb20{margin-bottom:20px}
.step-actions{margin-top:24px;display:flex;gap:12px;justify-content:center}
.center{text-align:center;padding:40px 0}
.text-muted{color:#c0c4cc;font-size:13px}
</style>
