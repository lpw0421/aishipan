<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>供应商资质管理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索公司名称/文档名称/编号..." clearable style="width:280px;margin-right:10px" @input="currentPage=1" />
        <el-button type="primary" @click="openAddDialog">添加文档</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
        <el-button @click="handleExport">导出Excel</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6"><el-card shadow="hover" class="stat-card" @click="docType='';currentPage=1"><div class="stat-num">{{ list.length }}</div><div class="stat-label">文档总数</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card stat-valid" @click="docType='';currentPage=1"><div class="stat-num">{{ list.filter(r=>getStatus(r.expiry_date)==='valid').length }}</div><div class="stat-label">正常</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card stat-warning" @click="docType='';currentPage=1"><div class="stat-num">{{ list.filter(r=>getStatus(r.expiry_date)==='expiring_soon').length }}</div><div class="stat-label">临期 ≤30天</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card stat-danger" @click="docType='';currentPage=1"><div class="stat-num">{{ list.filter(r=>getStatus(r.expiry_date)==='expired').length }}</div><div class="stat-label">已过期</div></el-card></el-col>
    </el-row>

    <el-card>
      <el-tabs v-model="docType" @tab-change="currentPage=1;fetchList()">
        <el-tab-pane :label="'全部 ('+list.length+')'" name="" />
        <el-tab-pane :label="'合同管理 ('+list.filter(r=>r.doc_type==='contract').length+')'" name="contract" />
        <el-tab-pane :label="'公司证照 ('+list.filter(r=>r.doc_type==='license').length+')'" name="license" />
        <el-tab-pane :label="'资质证书 ('+list.filter(r=>r.doc_type==='cert').length+')'" name="cert" />
        <el-tab-pane :label="'保险 ('+list.filter(r=>r.doc_type==='insurance').length+')'" name="insurance" />
      </el-tabs>

      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange" highlight-current-row>
        <el-table-column type="selection" width="45" />
        <el-table-column label="公司名称" prop="company_name" min-width="150" />
        <el-table-column label="文档名称" prop="doc_name" min-width="180" />
        <el-table-column label="编号" prop="doc_number" width="150" />
        <el-table-column label="生效日期" width="110">
          <template #default="{row}">{{ row.issue_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="到期日期" width="110">
          <template #default="{row}">{{ row.expiry_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{row}">
            <el-tag v-if="getStatus(row.expiry_date)==='expired'" type="danger" size="small">已过期</el-tag>
            <el-tag v-else-if="getStatus(row.expiry_date)==='expiring_soon'" type="warning" size="small">临期</el-tag>
            <el-tag v-else-if="row.expiry_date" type="success" size="small">正常</el-tag>
            <el-tag v-else type="info" size="small">无期限</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="80">
          <template #default="{row}">
            <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
            <span v-else style="color:#c0c4cc">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length===0" description="暂无数据" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <!-- 添加/编辑对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="文档类型">
          <el-select v-model="form.doc_type" style="width:100%">
            <el-option label="合同" value="contract" />
            <el-option label="公司证照" value="license" />
            <el-option label="资质证书" value="cert" />
            <el-option label="保险" value="insurance" />
          </el-select>
        </el-form-item>
        <el-form-item label="公司名称">
          <el-input v-model="form.company_name" placeholder="虫害服务公司名称" />
        </el-form-item>
        <el-form-item label="文档名称">
          <el-input v-model="form.doc_name" placeholder="文档名称" />
        </el-form-item>
        <el-form-item label="编号">
          <el-input v-model="form.doc_number" placeholder="合同编号/证号/保单号" />
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="form.issue_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="选择生效日期" />
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker v-model="form.expiry_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="选择到期日期" />
        </el-form-item>
        <el-form-item v-if="form.doc_type==='contract'" label="服务范围">
          <el-input v-model="form.service_scope" type="textarea" :rows="2" placeholder="合同约定的服务范围" />
        </el-form-item>
        <el-form-item v-if="form.doc_type==='contract'" label="合同金额">
          <el-input v-model="form.amount" placeholder="合同金额" />
        </el-form-item>
        <el-form-item v-if="form.doc_type==='insurance'" label="保额/覆盖">
          <el-input v-model="form.coverage" placeholder="保险覆盖范围及保额" />
        </el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">支持 JPG/PNG/PDF/Word，最多5个</div></template>
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
const docType = ref('')
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const getStatus = (expiryDate) => {
  if (!expiryDate) return 'valid'
  const diff = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'expiring_soon'
  return 'valid'
}

const docTypeLabel = (t) => ({ contract: '合同', license: '公司证照', cert: '资质证书', insurance: '保险' })[t] || t

const getFilePaths = (row) => {
  try { return JSON.parse(row.file_paths || '[]') } catch { return [] }
}

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => r.company_name.includes(kw) || r.doc_name.includes(kw) || r.doc_number.includes(kw))
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
    const params = { user_id: user.id }
    if (docType.value) params.doc_type = docType.value
    const res = await request.get('/pest/supplier-docs', { params })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

const onSelectionChange = (rows) => {
  selectedIds.value = rows.map(r => r.id)
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 条文档？删除后不可恢复`, '批量删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/pest/supplier-docs/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除该文档？', '删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete(`/api/pest/supplier-docs/${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  let url = `/api/pest/supplier-docs/export?user_id=${user.id}`
  if (selectedIds.value.length > 0) url += '&ids=' + selectedIds.value.join(',')
  window.open(url)
}

const previewFiles = (row) => {
  getFilePaths(row).forEach(p => window.open(p, '_blank'))
}

// 添加/编辑
const dialogVisible = ref(false)
const dialogTitle = ref('添加文档')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)

const form = reactive({
  doc_type: 'cert', company_name: '', doc_name: '', doc_number: '',
  issue_date: '', expiry_date: '', service_scope: '', amount: '', coverage: ''
})

const openAddDialog = () => {
  dialogTitle.value = '添加文档'
  editId.value = null
  Object.assign(form, { doc_type: 'cert', company_name: '', doc_name: '', doc_number: '', issue_date: '', expiry_date: '', service_scope: '', amount: '', coverage: '' })
  newFiles.value = []
  existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑文档'
  editId.value = row.id
  Object.assign(form, {
    doc_type: row.doc_type, company_name: row.company_name, doc_name: row.doc_name,
    doc_number: row.doc_number, issue_date: row.issue_date, expiry_date: row.expiry_date,
    service_scope: row.service_scope || '', amount: row.amount || '', coverage: row.coverage || ''
  })
  newFiles.value = []
  const paths = getFilePaths(row)
  existingFilesList.value = paths.map((p, i) => ({ name: p.split('/').pop(), url: p, uid: i }))
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const handleFileChange = (file) => {
  newFiles.value.push(file.raw)
}

const handleFileRemove = (file) => {
  const idx = existingFilesList.value.findIndex(f => f.uid === file.uid)
  if (idx >= 0) {
    existingFilesList.value.splice(idx, 1)
  } else {
    const rawIdx = newFiles.value.findIndex(f => f.name === file.name)
    if (rawIdx >= 0) newFiles.value.splice(rawIdx, 1)
  }
}

const handleSubmit = async () => {
  if (!form.company_name || !form.doc_name) {
    ElMessage.warning('请填写公司名称和文档名称')
    return
  }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    fd.append('doc_type', form.doc_type)
    fd.append('company_name', form.company_name)
    fd.append('doc_name', form.doc_name)
    fd.append('doc_number', form.doc_number)
    fd.append('issue_date', form.issue_date)
    fd.append('expiry_date', form.expiry_date)
    fd.append('service_scope', form.service_scope)
    fd.append('amount', form.amount)
    fd.append('coverage', form.coverage)
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))

    if (editId.value) {
      await axios.put(`/api/pest/supplier-docs/${editId.value}`, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/pest/supplier-docs', fd)
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
.stat-card { cursor: pointer; text-align: center; }
.stat-num { font-size: 28px; font-weight: bold; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-valid .stat-num { color: #67c23a; }
.stat-warning .stat-num { color: #e6a23c; }
.stat-danger .stat-num { color: #f56c6c; }
.upload-tip { color: #909399; font-size: 12px; margin-top: 4px; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
