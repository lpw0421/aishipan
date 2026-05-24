<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>计量设备台账</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索编号/名称/位置..." clearable style="width:240px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="typeFilter" placeholder="设备类型" clearable style="width:130px;margin-right:8px" @change="currentPage=1">
          <el-option v-for="t in deviceTypes" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="校准状态" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="正常" value="正常" />
          <el-option label="待校准" value="待校准" />
          <el-option label="已过期" value="已过期" />
          <el-option label="停用" value="停用" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增设备</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
        <el-button @click="handleExport">导出Excel</el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="stat-card" :class="card.cls" @click="statusFilter=card.filter">
          <div class="stat-num" :class="card.numCls">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="设备编号" prop="device_number" width="140" />
        <el-table-column label="设备名称" prop="device_name" min-width="160" />
        <el-table-column label="类型" prop="device_type" width="110" />
        <el-table-column label="品牌/型号" prop="brand_model" width="140" />
        <el-table-column label="存放位置" prop="location" width="130" />
        <el-table-column label="责任人" prop="responsible_person" width="80" />
        <el-table-column label="上次校准" width="110">
          <template #default="{row}">{{ row.last_calibration_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="下次校准" width="110">
          <template #default="{row}">{{ row.next_calibration_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="校准状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.calibration_status==='已过期'?'danger':row.calibration_status==='待校准'?'warning':row.calibration_status==='停用'?'info':'success'" size="small">{{ row.calibration_status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="设备状态" width="90">
          <template #default="{row}">{{ row.device_status }}</template>
        </el-table-column>
        <el-table-column label="附件" width="70">
          <template #default="{row}">
            <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
            <span v-else style="color:#c0c4cc">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无设备" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <!-- 对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="650px">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="设备编号"><el-input v-model="form.device_number" placeholder="如：ME-2026-001" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="设备名称"><el-input v-model="form.device_name" placeholder="如：数显温度计" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="设备类型">
              <el-select v-model="form.device_type" style="width:100%">
                <el-option v-for="t in deviceTypes" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12"><el-form-item label="品牌/型号"><el-input v-model="form.brand_model" placeholder="制造商和型号" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="精度要求"><el-input v-model="form.accuracy" placeholder="如：±0.5°C" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="测量范围"><el-input v-model="form.measure_range" placeholder="如：-50~300°C" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="存放位置"><el-input v-model="form.location" placeholder="具体位置" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="责任人"><el-input v-model="form.responsible_person" placeholder="负责员工" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="启用日期"><el-date-picker v-model="form.start_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="校准周期">
              <el-select v-model="form.calibration_cycle" style="width:100%">
                <el-option label="6个月" value="6" />
                <el-option label="12个月" value="12" />
                <el-option label="24个月" value="24" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="上次校准"><el-date-picker v-model="form.last_calibration_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="下次校准"><el-date-picker v-model="form.next_calibration_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="校准状态">
              <el-select v-model="form.calibration_status" style="width:100%">
                <el-option label="正常" value="正常" />
                <el-option label="待校准" value="待校准" />
                <el-option label="已过期" value="已过期" />
                <el-option label="停用" value="停用" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="设备状态">
              <el-select v-model="form.device_status" style="width:100%">
                <el-option label="在用" value="在用" />
                <el-option label="维修中" value="维修中" />
                <el-option label="报废" value="报废" />
                <el-option label="备用" value="备用" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">设备照片、购买凭证、说明书</div></template>
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
const loading = ref(false)
const keyword = ref('')
const typeFilter = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const deviceTypes = ['温度测量', '称重设备', '理化分析', '时间测量', '压力测量', '气体检测', '体积/液位', '其他']

const getFilePaths = (row) => { try { return JSON.parse(row.file_paths || '[]') } catch { return [] } }

const statCards = computed(() => [
  { label: '设备总数', value: list.value.length, cls: '', numCls: '', filter: '' },
  { label: '校准有效', value: list.value.filter(r=>r.calibration_status==='正常').length, cls: 'stat-valid', numCls: '', filter: '正常' },
  { label: '待校准', value: list.value.filter(r=>r.calibration_status==='待校准').length, cls: 'stat-warning', numCls: '', filter: '待校准' },
  { label: '已过期/停用', value: list.value.filter(r=>r.calibration_status==='已过期'||r.calibration_status==='停用').length, cls: 'stat-danger', numCls: '', filter: '已过期' }
])

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => r.device_number.includes(kw) || r.device_name.includes(kw) || r.location.includes(kw))
  }
  if (typeFilter.value) result = result.filter(r => r.device_type === typeFilter.value)
  if (statusFilter.value) result = result.filter(r => r.calibration_status === statusFilter.value)
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
    const res = await request.get('/calibration/devices', { params: { user_id: user.id } })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm('确认删除选中设备？', '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/calibration/devices/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功'); selectedIds.value = []; fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete('/api/calibration/devices/' + id, { data: { user_id: user.id } })
    ElMessage.success('已删除'); fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  let url = '/api/calibration/devices/export?user_id=' + user.id
  if (selectedIds.value.length > 0) url += '&ids=' + selectedIds.value.join(',')
  window.open(url)
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增设备')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)
const form = reactive({
  device_number: '', device_name: '', device_type: '温度测量', brand_model: '', accuracy: '', measure_range: '',
  location: '', responsible_person: '', start_date: '', calibration_cycle: '12',
  last_calibration_date: '', next_calibration_date: '', calibration_status: '正常', device_status: '在用'
})

const openAddDialog = () => {
  dialogTitle.value = '新增设备'; editId.value = null
  Object.assign(form, { device_number: '', device_name: '', device_type: '温度测量', brand_model: '', accuracy: '', measure_range: '', location: '', responsible_person: '', start_date: '', calibration_cycle: '12', last_calibration_date: '', next_calibration_date: '', calibration_status: '正常', device_status: '在用' })
  newFiles.value = []; existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑设备'; editId.value = row.id
  Object.assign(form, {
    device_number: row.device_number, device_name: row.device_name, device_type: row.device_type,
    brand_model: row.brand_model, accuracy: row.accuracy, measure_range: row.measure_range,
    location: row.location, responsible_person: row.responsible_person, start_date: row.start_date,
    calibration_cycle: row.calibration_cycle, last_calibration_date: row.last_calibration_date,
    next_calibration_date: row.next_calibration_date, calibration_status: row.calibration_status,
    device_status: row.device_status
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
  if (!form.device_name) { ElMessage.warning('请填写设备名称'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    Object.keys(form).forEach(k => fd.append(k, form[k]))
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))
    if (editId.value) {
      await axios.put('/api/calibration/devices/' + editId.value, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/calibration/devices', fd)
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
