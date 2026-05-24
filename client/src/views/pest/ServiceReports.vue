<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>服务报告管理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索编号/供应商/区域..." clearable style="width:240px;margin-right:10px" @input="currentPage=1" />
        <el-button type="primary" @click="openAddDialog">新增报告</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
        <el-button @click="handleExport">导出Excel</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="8"><el-card shadow="hover" class="stat-card"><div class="stat-num">{{ list.length }}</div><div class="stat-label">本月报告</div></el-card></el-col>
      <el-col :span="8"><el-card shadow="hover" class="stat-card stat-valid"><div class="stat-num">{{ list.filter(r=>r.customer_signee).length }}</div><div class="stat-label">已签字</div></el-card></el-col>
      <el-col :span="8"><el-card shadow="hover" class="stat-card stat-warning"><div class="stat-num">{{ list.filter(r=>!r.customer_signee).length }}</div><div class="stat-label">待签字</div></el-card></el-col>
    </el-row>

    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange" highlight-current-row>
        <el-table-column type="selection" width="45" />
        <el-table-column label="报告编号" prop="report_number" width="180" />
        <el-table-column label="服务日期" prop="service_date" width="110" sortable />
        <el-table-column label="供应商" prop="supplier" width="150" />
        <el-table-column label="服务人员" prop="service_staff" width="100" />
        <el-table-column label="服务区域" prop="service_area" width="150" />
        <el-table-column label="服务内容" prop="service_content" min-width="200" />
        <el-table-column label="发现问题" prop="findings" min-width="150" />
        <el-table-column label="使用药剂" prop="chemicals_used" width="150" />
        <el-table-column label="客户签字" width="120">
          <template #default="{row}">
            <el-tag v-if="row.customer_signee" type="success" size="small">{{ row.customer_signee }}</el-tag>
            <el-tag v-else type="warning" size="small">待签字</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="签字日期" prop="sign_date" width="110" />
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

      <el-empty v-if="!loading && filteredList.length===0" description="暂无服务报告" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <!-- 对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="650px">
      <el-form :model="form" label-width="80px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="报告编号"><el-input v-model="form.report_number" placeholder="如：SR-20260524-001" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="服务日期"><el-date-picker v-model="form.service_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="供应商"><el-input v-model="form.supplier" placeholder="虫害公司名称" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="服务人员"><el-input v-model="form.service_staff" placeholder="Pest Technician" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="服务区域"><el-input v-model="form.service_area" placeholder="涉及的楼层/区域" /></el-form-item>
        <el-form-item label="服务内容"><el-input v-model="form.service_content" type="textarea" :rows="2" placeholder="处理类型（灭鼠/灭蟑/灭蝇等）+ 摘要" /></el-form-item>
        <el-form-item label="发现问题"><el-input v-model="form.findings" type="textarea" :rows="2" placeholder="发现的虫害类型、数量、位置" /></el-form-item>
        <el-form-item label="处理措施"><el-input v-model="form.measures" type="textarea" :rows="2" placeholder="采取的具体处理方式" /></el-form-item>
        <el-form-item label="使用药剂"><el-input v-model="form.chemicals_used" placeholder="使用的化学品名称和用量" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="客户签字"><el-input v-model="form.customer_signee" placeholder="客户方确认人姓名" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="签字日期"><el-date-picker v-model="form.sign_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">现场照片、处理前后对比图等</div></template>
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
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const getFilePaths = (row) => {
  try { return JSON.parse(row.file_paths || '[]') } catch { return [] }
}

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => r.report_number.includes(kw) || r.supplier.includes(kw) || r.service_area.includes(kw) || r.service_staff.includes(kw))
  }
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
    const res = await request.get('/pest/service-reports', { params: { user_id: user.id } })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 份报告？`, '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/pest/service-reports/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除该报告？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete(`/api/pest/service-reports/${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  let url = `/api/pest/service-reports/export?user_id=${user.id}`
  if (selectedIds.value.length > 0) url += '&ids=' + selectedIds.value.join(',')
  window.open(url)
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

const dialogVisible = ref(false)
const dialogTitle = ref('新增报告')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)
const form = reactive({
  report_number: '', service_date: '', supplier: '', service_staff: '', service_area: '',
  service_content: '', findings: '', measures: '', chemicals_used: '', customer_signee: '', sign_date: ''
})

const openAddDialog = () => {
  dialogTitle.value = '新增报告'
  editId.value = null
  Object.assign(form, { report_number: '', service_date: '', supplier: '', service_staff: '', service_area: '', service_content: '', findings: '', measures: '', chemicals_used: '', customer_signee: '', sign_date: '' })
  newFiles.value = []
  existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑报告'
  editId.value = row.id
  Object.assign(form, {
    report_number: row.report_number, service_date: row.service_date, supplier: row.supplier,
    service_staff: row.service_staff, service_area: row.service_area, service_content: row.service_content,
    findings: row.findings, measures: row.measures, chemicals_used: row.chemicals_used,
    customer_signee: row.customer_signee, sign_date: row.sign_date
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
  if (!form.report_number) { ElMessage.warning('请填写报告编号'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    Object.keys(form).forEach(k => fd.append(k, form[k]))
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))

    if (editId.value) {
      await axios.put(`/api/pest/service-reports/${editId.value}`, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/pest/service-reports', fd)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch { ElMessage.error('操作失败') } finally { submitting.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.stat-card { text-align: center; }
.stat-num { font-size: 28px; font-weight: bold; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-valid .stat-num { color: #67c23a; }
.stat-warning .stat-num { color: #e6a23c; }
.upload-tip { color: #909399; font-size: 12px; margin-top: 4px; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
