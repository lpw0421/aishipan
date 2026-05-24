<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>校准异常处理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索异常编号/设备..." clearable style="width:240px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="statusFilter" placeholder="处置状态" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="待处理" value="待处理" />
          <el-option label="处理中" value="处理中" />
          <el-option label="待验证" value="待验证" />
          <el-option label="已关闭" value="已关闭" />
        </el-select>
        <el-select v-model="severityFilter" placeholder="严重程度" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="严重" value="严重" />
          <el-option label="一般" value="一般" />
          <el-option label="轻微" value="轻微" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增异常</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
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
        <el-table-column label="异常编号" prop="exception_number" width="150" />
        <el-table-column label="设备编号" prop="device_number" width="120" />
        <el-table-column label="设备名称" prop="device_name" min-width="150" />
        <el-table-column label="异常类型" prop="exception_type" width="120" />
        <el-table-column label="异常描述" prop="description" min-width="160" show-overflow-tooltip />
        <el-table-column label="严重程度" width="100">
          <template #default="{row}">
            <el-tag :type="row.severity==='严重'?'danger':row.severity==='一般'?'warning':'info'" size="small">{{ row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处置措施" prop="measures" min-width="120" show-overflow-tooltip />
        <el-table-column label="处置人" prop="handler" width="80" />
        <el-table-column label="处置状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status==='已关闭'?'success':row.status==='待处理'?'danger':row.status==='处理中'?'warning':'primary'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="70">
          <template #default="{row}">
            <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
            <span v-else style="color:#c0c4cc">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button v-if="row.status==='待处理'" type="warning" link size="small" @click="handleProcess(row)">处理</el-button>
            <el-button v-if="row.status==='处理中'" type="success" link size="small" @click="handleVerify(row)">验证</el-button>
            <el-button v-if="row.status==='待验证'" type="success" link size="small" @click="handleClose(row)">关闭</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无异常记录" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <!-- 主对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="异常编号"><el-input v-model="form.exception_number" placeholder="如：EX-20260524-001" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="关联设备">
              <el-select v-model="form.device_id" filterable placeholder="选择设备" style="width:100%">
                <el-option v-for="d in devices" :key="d.id" :label="d.device_number + ' ' + d.device_name" :value="d.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="异常类型">
              <el-select v-model="form.exception_type" style="width:100%">
                <el-option label="校准不合格" value="校准不合格" />
                <el-option label="设备损坏" value="设备损坏" />
                <el-option label="超期未校" value="超期未校" />
                <el-option label="其他" value="其他" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="严重程度">
              <el-select v-model="form.severity" style="width:100%">
                <el-option label="严重" value="严重" />
                <el-option label="一般" value="一般" />
                <el-option label="轻微" value="轻微" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="异常描述"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="具体问题描述" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="发现日期"><el-date-picker v-model="form.discover_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="影响评估"><el-input v-model="form.impact_assessment" placeholder="对产品/食安的影响" /></el-form-item></el-col>
        </el-row>
        <el-form-item v-if="editId" label="处置措施"><el-input v-model="form.measures" type="textarea" :rows="2" placeholder="停用/维修/更换/降级使用" /></el-form-item>
        <el-row v-if="editId" :gutter="16">
          <el-col :span="12"><el-form-item label="处置人"><el-input v-model="form.handler" placeholder="负责人" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="处置日期"><el-date-picker v-model="form.handle_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item v-if="editId" label="重新校准日期"><el-date-picker v-model="form.recalibration_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">异常照片、评估报告</div></template>
          </el-upload>
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
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const severityFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const getFilePaths = (row) => { try { return JSON.parse(row.file_paths || '[]') } catch { return [] } }

const statCards = computed(() => [
  { label: '异常总数', value: list.value.length, cls: '', numCls: '', filter: '' },
  { label: '待处理', value: list.value.filter(r=>r.status==='待处理').length, cls: 'stat-danger', numCls: '', filter: '待处理' },
  { label: '处理中', value: list.value.filter(r=>r.status==='处理中').length, cls: 'stat-warning', numCls: '', filter: '处理中' },
  { label: '已关闭', value: list.value.filter(r=>r.status==='已关闭').length, cls: 'stat-valid', numCls: '', filter: '已关闭' }
])

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => (r.exception_number||'').includes(kw) || (r.device_number||'').includes(kw) || (r.device_name||'').includes(kw) || (r.description||'').includes(kw))
  }
  if (statusFilter.value) result = result.filter(r => r.status === statusFilter.value)
  if (severityFilter.value) result = result.filter(r => r.severity === severityFilter.value)
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
    const params = { user_id: user.id }
    if (statusFilter.value) params.status = statusFilter.value
    if (severityFilter.value) params.severity = severityFilter.value
    const res = await request.get('/calibration/exceptions', { params })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

const fetchDevices = async () => {
  const user = JSON.parse(localStorage.getItem('user'))
  try { const res = await request.get('/calibration/devices', { params: { user_id: user.id } }); devices.value = res.list } catch {}
}

onMounted(() => { fetchList(); fetchDevices() })

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm('确认删除选中记录？', '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/calibration/exceptions/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功'); selectedIds.value = []; fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete('/api/calibration/exceptions/' + id, { data: { user_id: user.id } })
    ElMessage.success('已删除'); fetchList()
  } catch { ElMessage.error('删除失败') }
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

// 状态流转
const handleProcess = async (row) => {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put('/api/calibration/exceptions/' + row.id, { user_id: user.id, status: '处理中' })
    ElMessage.success('已转为处理中'); fetchList()
  } catch { ElMessage.error('操作失败') }
}

const handleVerify = async (row) => {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put('/api/calibration/exceptions/' + row.id, { user_id: user.id, status: '待验证' })
    ElMessage.success('已转为待验证'); fetchList()
  } catch { ElMessage.error('操作失败') }
}

const handleClose = async (row) => {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put('/api/calibration/exceptions/' + row.id, { user_id: user.id, status: '已关闭' })
    ElMessage.success('已关闭'); fetchList()
  } catch { ElMessage.error('操作失败') }
}

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增异常')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)
const form = reactive({
  exception_number: '', device_id: null, exception_type: '校准不合格', description: '',
  severity: '一般', discover_date: '', impact_assessment: '', measures: '', handler: '',
  handle_date: '', recalibration_date: ''
})

const openAddDialog = () => {
  dialogTitle.value = '新增异常'; editId.value = null
  Object.assign(form, { exception_number: '', device_id: null, exception_type: '校准不合格', description: '', severity: '一般', discover_date: '', impact_assessment: '', measures: '', handler: '', handle_date: '', recalibration_date: '' })
  newFiles.value = []; existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑异常'; editId.value = row.id
  Object.assign(form, {
    exception_number: row.exception_number, device_id: row.device_id, exception_type: row.exception_type,
    description: row.description, severity: row.severity, discover_date: row.discover_date,
    impact_assessment: row.impact_assessment, measures: row.measures, handler: row.handler,
    handle_date: row.handle_date, recalibration_date: row.recalibration_date
  })
  newFiles.value = []
  const paths = getFilePaths(row)
  existingFilesList.value = paths.map((p, i) => ({ name: p.split('/').pop(), url: p, uid: i }))
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const handleFileChange = (file) => { newFiles.value.push(file.raw) }
const handleFileRemove = (file) => {
  const idx = existingFilesList.value.findIndex(f => f.uid === file.uid)
  if (idx >= 0) existingFilesList.value.splice(idx, 1)
}

const handleSubmit = async () => {
  if (!form.device_id) { ElMessage.warning('请选择关联设备'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    Object.keys(form).forEach(k => fd.append(k, form[k] || ''))
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))
    if (editId.value) {
      await axios.put('/api/calibration/exceptions/' + editId.value, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/calibration/exceptions', fd)
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
.upload-tip { color: #909399; font-size: 12px; margin-top: 4px; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
