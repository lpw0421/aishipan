<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>校准记录</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索证书编号/设备/机构..." clearable style="width:260px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="conclusionFilter" placeholder="校准结论" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="合格" value="合格" />
          <el-option label="不合格" value="不合格" />
          <el-option label="限用" value="限用" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增记录</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
        <el-button @click="handleExport">导出Excel</el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="stat-card" :class="card.cls" @click="conclusionFilter=card.filter;currentPage=1">
          <div class="stat-num" :class="card.numCls">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="证书编号" prop="cert_number" width="140" />
        <el-table-column label="设备编号" prop="device_number" width="120" />
        <el-table-column label="设备名称" prop="device_name" min-width="150" />
        <el-table-column label="校准日期" width="110">
          <template #default="{row}">{{ row.calibration_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="校准机构" prop="agency_name" width="150" />
        <el-table-column label="校准方式" prop="method" width="80" />
        <el-table-column label="结论" width="90">
          <template #default="{row}">
            <el-tag :type="row.conclusion==='不合格'?'danger':row.conclusion==='限用'?'warning':'success'" size="small">{{ row.conclusion }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="下次校准" width="110">
          <template #default="{row}">{{ row.next_calibration_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="校准员" prop="calibrator" width="80" />
        <el-table-column label="附件" width="70">
          <template #default="{row}">
            <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
            <span v-else style="color:#c0c4cc">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="success" link size="small" @click="viewDetail(row)">详情</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无校准记录" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <!-- 详情对话框 -->
    <el-dialog v-model="detailVisible" title="校准证书详情" width="650px">
      <template v-if="detailRow">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="证书编号">{{ detailRow.cert_number }}</el-descriptions-item>
          <el-descriptions-item label="设备">{{ detailRow.device_number }} {{ detailRow.device_name }}</el-descriptions-item>
          <el-descriptions-item label="校准日期">{{ detailRow.calibration_date }}</el-descriptions-item>
          <el-descriptions-item label="校准机构">{{ detailRow.agency_name }}</el-descriptions-item>
          <el-descriptions-item label="机构资质">{{ detailRow.agency_qualification || '-' }}</el-descriptions-item>
          <el-descriptions-item label="校准依据">{{ detailRow.standard || '-' }}</el-descriptions-item>
          <el-descriptions-item label="校准方式">{{ detailRow.method }}</el-descriptions-item>
          <el-descriptions-item label="校准环境">{{ detailRow.environment || '-' }}</el-descriptions-item>
          <el-descriptions-item label="最大允许误差">{{ detailRow.max_error || '-' }}</el-descriptions-item>
          <el-descriptions-item label="校准结论">
            <el-tag :type="detailRow.conclusion==='不合格'?'danger':detailRow.conclusion==='限用'?'warning':'success'" size="small">{{ detailRow.conclusion }}</el-tag>
          </el-descriptions-item>
          <el-descriptions-item label="限用说明" :span="2">{{ detailRow.limit_note || '-' }}</el-descriptions-item>
          <el-descriptions-item label="下次校准">{{ detailRow.next_calibration_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="校准员">{{ detailRow.calibrator || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="testData.length > 0" style="margin-top:16px">
          <h4 style="margin-bottom:8px">测试数据</h4>
          <el-table :data="testData" border size="small">
            <el-table-column label="测试点" prop="point" />
            <el-table-column label="标准值" prop="standard" />
            <el-table-column label="示值" prop="reading" />
            <el-table-column label="偏差" prop="deviation" />
          </el-table>
        </div>
        <div v-if="getFilePaths(detailRow).length>0" style="margin-top:12px">
          <el-button v-for="(p, i) in getFilePaths(detailRow)" :key="i" link type="primary" size="small" @click="window.open(p,'_blank')">📄 {{ p.split('/').pop() }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="650px">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="证书编号"><el-input v-model="form.cert_number" placeholder="如：CAL-2026-001" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="关联设备">
              <el-select v-model="form.device_id" filterable placeholder="选择设备" style="width:100%">
                <el-option v-for="d in devices" :key="d.id" :label="d.device_number + ' ' + d.device_name" :value="d.id" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="校准日期"><el-date-picker v-model="form.calibration_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="下次校准"><el-date-picker v-model="form.next_calibration_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="校准机构"><el-input v-model="form.agency_name" placeholder="机构名称" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="机构资质"><el-input v-model="form.agency_qualification" placeholder="如：CNAS、CMA" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="校准依据"><el-input v-model="form.standard" placeholder="如：JJG XXX-XXXX" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="校准方式">
              <el-select v-model="form.method" style="width:100%">
                <el-option label="外校" value="外校" />
                <el-option label="内校" value="内校" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="校准环境"><el-input v-model="form.environment" placeholder="如：23±2°C, 50%RH" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="最大允许误差"><el-input v-model="form.max_error" placeholder="如：±0.5°C" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="校准结论">
              <el-select v-model="form.conclusion" style="width:100%">
                <el-option label="合格" value="合格" />
                <el-option label="不合格" value="不合格" />
                <el-option label="限用" value="限用" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12"><el-form-item label="校准员"><el-input v-model="form.calibrator" placeholder="校准人员" /></el-form-item></el-col>
        </el-row>
        <el-form-item v-if="form.conclusion === '限用'" label="限用说明"><el-input v-model="form.limit_note" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="测试数据">
          <div v-for="(td, i) in testData" :key="i" style="display:flex;gap:8px;margin-bottom:6px;align-items:center">
            <el-input v-model="td.point" placeholder="测试点" size="small" style="width:100px" />
            <el-input v-model="td.standard" placeholder="标准值" size="small" style="width:100px" />
            <el-input v-model="td.reading" placeholder="示值" size="small" style="width:100px" />
            <el-input v-model="td.deviation" placeholder="偏差" size="small" style="width:100px" />
            <el-button type="danger" :icon="Delete" circle size="small" @click="testData.splice(i,1)" />
          </div>
          <el-button type="primary" link size="small" @click="testData.push({point:'',standard:'',reading:'',deviation:''})">+ 添加测试点</el-button>
        </el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">校准证书扫描件、现场照片</div></template>
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
import { Delete } from '@element-plus/icons-vue'
import request from '../../utils/request'
import axios from 'axios'

const list = ref([])
const devices = ref([])
const loading = ref(false)
const keyword = ref('')
const conclusionFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])
const testData = ref([])

const getFilePaths = (row) => { try { return JSON.parse(row.file_paths || '[]') } catch { return [] } }

const statCards = computed(() => [
  { label: '记录总数', value: list.value.length, cls: '', numCls: '', filter: '' },
  { label: '合格', value: list.value.filter(r=>r.conclusion==='合格').length, cls: 'stat-valid', numCls: '', filter: '合格' },
  { label: '不合格', value: list.value.filter(r=>r.conclusion==='不合格').length, cls: 'stat-danger', numCls: '', filter: '不合格' },
  { label: '限用', value: list.value.filter(r=>r.conclusion==='限用').length, cls: 'stat-warning', numCls: '', filter: '限用' }
])

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => (r.cert_number||'').includes(kw) || (r.device_number||'').includes(kw) || (r.device_name||'').includes(kw) || (r.agency_name||'').includes(kw))
  }
  if (conclusionFilter.value) result = result.filter(r => r.conclusion === conclusionFilter.value)
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
    if (conclusionFilter.value) params.conclusion = conclusionFilter.value
    const res = await request.get('/calibration/records', { params })
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
    await axios.post('/api/calibration/records/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功'); selectedIds.value = []; fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete('/api/calibration/records/' + id, { data: { user_id: user.id } })
    ElMessage.success('已删除'); fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  window.open('/api/calibration/records/export?user_id=' + user.id)
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

// 详情
const detailVisible = ref(false)
const detailRow = ref(null)
const viewDetail = (row) => { detailRow.value = row; detailVisible.value = true }

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增记录')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)
const form = reactive({
  cert_number: '', device_id: null, calibration_date: '', agency_name: '', agency_qualification: '',
  standard: '', method: '外校', environment: '', max_error: '', conclusion: '合格', limit_note: '',
  next_calibration_date: '', calibrator: ''
})

const openAddDialog = () => {
  dialogTitle.value = '新增记录'; editId.value = null
  Object.assign(form, { cert_number: '', device_id: null, calibration_date: '', agency_name: '', agency_qualification: '', standard: '', method: '外校', environment: '', max_error: '', conclusion: '合格', limit_note: '', next_calibration_date: '', calibrator: '' })
  testData.value = []; newFiles.value = []; existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑记录'; editId.value = row.id
  Object.assign(form, {
    cert_number: row.cert_number, device_id: row.device_id, calibration_date: row.calibration_date,
    agency_name: row.agency_name, agency_qualification: row.agency_qualification,
    standard: row.standard, method: row.method, environment: row.environment,
    max_error: row.max_error, conclusion: row.conclusion, limit_note: row.limit_note,
    next_calibration_date: row.next_calibration_date, calibrator: row.calibrator
  })
  try { testData.value = JSON.parse(row.test_data || '[]') } catch { testData.value = [] }
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
    fd.append('test_data', JSON.stringify(testData.value))
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))
    if (editId.value) {
      await axios.put('/api/calibration/records/' + editId.value, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/calibration/records', fd)
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
