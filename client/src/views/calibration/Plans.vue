<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>校准计划</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索计划编号/设备..." clearable style="width:240px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="statusFilter" placeholder="计划状态" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="待执行" value="待执行" />
          <el-option label="进行中" value="进行中" />
          <el-option label="已完成" value="已完成" />
          <el-option label="已逾期" value="已逾期" />
          <el-option label="已取消" value="已取消" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增计划</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
        <el-button @click="handleExport">导出Excel</el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="stat-card" :class="card.cls" @click="statusFilter=card.filter;currentPage=1">
          <div class="stat-num" :class="card.numCls">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="计划编号" prop="plan_number" width="140" />
        <el-table-column label="设备编号" prop="device_number" width="120" />
        <el-table-column label="设备名称" prop="device_name" min-width="150" />
        <el-table-column label="计划日期" width="110">
          <template #default="{row}">{{ row.planned_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="实际日期" width="110">
          <template #default="{row}">{{ row.actual_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="校准方式" prop="method" width="80" />
        <el-table-column label="校准结果" prop="result" width="90" />
        <el-table-column label="计划状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.plan_status==='已逾期'?'danger':row.plan_status==='已完成'?'success':row.plan_status==='进行中'?'warning':row.plan_status==='已取消'?'info':'primary'" size="small">{{ row.plan_status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="120" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button v-if="row.plan_status==='待执行'" type="warning" link size="small" @click="startPlan(row)">开始</el-button>
            <el-button v-if="row.plan_status==='进行中'" type="success" link size="small" @click="completePlan(row)">完成</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无校准计划" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="550px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="关联设备">
          <el-select v-model="form.device_id" filterable placeholder="选择设备" style="width:100%">
            <el-option v-for="d in devices" :key="d.id" :label="d.device_number + ' - ' + d.device_name" :value="d.id" />
          </el-select>
        </el-form-item>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="计划编号"><el-input v-model="form.plan_number" placeholder="如：PLAN-2026-001" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="计划校准日期"><el-date-picker v-model="form.planned_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="校准方式">
              <el-select v-model="form.method" style="width:100%">
                <el-option label="外校" value="外校" />
                <el-option label="内校" value="内校" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="校准机构">
              <el-select v-model="form.agency_id" filterable clearable placeholder="选择机构" style="width:100%">
                <el-option v-for="a in agencies" :key="a.id" :label="a.agency_name" :value="a.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
        <el-form-item v-if="editId" label="实际校准日期"><el-date-picker v-model="form.actual_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item v-if="editId" label="校准结果">
          <el-select v-model="form.result" style="width:100%">
            <el-option label="合格" value="合格" />
            <el-option label="不合格" value="不合格" />
            <el-option label="限用" value="限用" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'

const list = ref([])
const devices = ref([])
const agencies = ref([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const statCards = computed(() => [
  { label: '计划总数', value: list.value.length, cls: '', numCls: '', filter: '' },
  { label: '待执行', value: list.value.filter(r=>r.plan_status==='待执行').length, cls: 'stat-warning', numCls: '', filter: '待执行' },
  { label: '进行中', value: list.value.filter(r=>r.plan_status==='进行中').length, cls: '', numCls: '', filter: '进行中' },
  { label: '已逾期', value: list.value.filter(r=>r.plan_status==='已逾期').length, cls: 'stat-danger', numCls: '', filter: '已逾期' }
])

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => (r.plan_number||'').includes(kw) || (r.device_number||'').includes(kw) || (r.device_name||'').includes(kw))
  }
  if (statusFilter.value) result = result.filter(r => r.plan_status === statusFilter.value)
  return result
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

const fetchList = async () => {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const status = statusFilter.value
    const res = await request.get('/calibration/plans', { params: { user_id: user.id, ...(status ? { status } : {}) } })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

const fetchRefs = async () => {
  const user = JSON.parse(localStorage.getItem('user'))
  try {
    const [dRes, aRes] = await Promise.all([
      request.get('/calibration/devices', { params: { user_id: user.id } }),
      request.get('/calibration/agencies', { params: { user_id: user.id } })
    ])
    devices.value = dRes.list
    agencies.value = aRes.list
  } catch {}
}

onMounted(() => { fetchList(); fetchRefs() })

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm('确认删除选中计划？', '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/calibration/plans/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功'); selectedIds.value = []; fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete('/api/calibration/plans/' + id, { data: { user_id: user.id } })
    ElMessage.success('已删除'); fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  let url = '/api/calibration/plans/export?user_id=' + user.id
  if (selectedIds.value.length > 0) url += '&ids=' + selectedIds.value.join(',')
  window.open(url)
}

const startPlan = async (row) => {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put('/api/calibration/plans/' + row.id, { user_id: user.id, plan_status: '进行中' })
    ElMessage.success('已开始'); fetchList()
  } catch { ElMessage.error('操作失败') }
}

const completePlan = async (row) => {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put('/api/calibration/plans/' + row.id, { user_id: user.id, plan_status: '已完成', actual_date: new Date().toISOString().slice(0,10) })
    ElMessage.success('已完成'); fetchList()
  } catch { ElMessage.error('操作失败') }
}

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增计划')
const editId = ref(null)
const submitting = ref(false)
const form = reactive({
  plan_number: '', device_id: null, planned_date: '', agency_id: null, method: '外校', remark: '', actual_date: '', result: '合格'
})

const openAddDialog = () => {
  dialogTitle.value = '新增计划'; editId.value = null
  Object.assign(form, { plan_number: '', device_id: null, planned_date: '', agency_id: null, method: '外校', remark: '', actual_date: '', result: '合格' })
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑计划'; editId.value = row.id
  Object.assign(form, {
    plan_number: row.plan_number, device_id: row.device_id, planned_date: row.planned_date,
    agency_id: row.agency_id, method: row.method, remark: row.remark,
    actual_date: row.actual_date, result: row.result
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.device_id) { ElMessage.warning('请选择关联设备'); return }
  if (!form.planned_date) { ElMessage.warning('请选择计划校准日期'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const data = { user_id: user.id, ...form }
    if (editId.value) {
      await axios.put('/api/calibration/plans/' + editId.value, data)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/calibration/plans', data)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false; fetchList()
  } catch { ElMessage.error('操作失败') } finally { submitting.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.toolbar h2 { margin: 0; color: #303133; }
.toolbar-right { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.stat-card { cursor: pointer; text-align: center; }
.stat-num { font-size: 28px; font-weight: bold; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-valid .stat-num { color: #67c23a; }
.stat-warning .stat-num { color: #e6a23c; }
.stat-danger .stat-num { color: #f56c6c; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
