<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>{{ docTypeLabel }}</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索文件名称/编号/内容..." clearable style="width:260px;margin-right:8px" @input="currentPage=1" />
        <el-select v-if="isExternal" v-model="categoryFilter" placeholder="来源分类" clearable style="width:120px;margin-right:8px" @change="currentPage=1">
          <el-option label="法律法规" value="law" />
          <el-option label="国家标准" value="standard" />
          <el-option label="行业规范" value="industry" />
          <el-option label="企业制度" value="company" />
          <el-option label="客户要求" value="customer" />
          <el-option label="认证标准" value="certification" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="现行有效" value="现行有效" />
          <el-option label="修订中" value="修订中" />
          <el-option label="已作废" value="已作废" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">添加文件</el-button>
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
        <el-table-column label="文件编号" prop="doc_number" width="140" />
        <el-table-column label="文件名称" prop="doc_name" min-width="220" />
        <el-table-column v-if="isExternal" label="来源分类" width="110">
          <template #default="{row}">
            <el-tag :type="categoryType(row.category)" size="small">{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="版本" prop="version" width="80" />
        <el-table-column v-if="!isExternal" label="编制人" prop="author" width="80" />
        <el-table-column v-if="!isExternal" label="审核人" prop="reviewer" width="80" />
        <el-table-column label="生效日期" width="110">
          <template #default="{row}">{{ row.effective_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="下次评审" width="110" v-if="!isExternal">
          <template #default="{row}">{{ row.review_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status==='现行有效'?'success':row.status==='修订中'?'warning':'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
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
      <el-empty v-if="!loading && filteredList.length===0" description="暂无文件" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <!-- 详情弹窗 -->
    <el-dialog v-model="detailVisible" title="文件详情" width="600px">
      <template v-if="detailRow">
        <el-descriptions :column="2" border size="small">
          <el-descriptions-item label="文件编号">{{ detailRow.doc_number }}</el-descriptions-item>
          <el-descriptions-item label="文件名称">{{ detailRow.doc_name }}</el-descriptions-item>
          <el-descriptions-item label="版本">{{ detailRow.version }}</el-descriptions-item>
          <el-descriptions-item label="状态">
            <el-tag :type="detailRow.status==='现行有效'?'success':detailRow.status==='修订中'?'warning':'info'" size="small">{{ detailRow.status }}</el-tag>
          </el-descriptions-item>
          <template v-if="!isExternal">
            <el-descriptions-item label="编制人">{{ detailRow.author || '-' }}</el-descriptions-item>
            <el-descriptions-item label="审核人">{{ detailRow.reviewer || '-' }}</el-descriptions-item>
            <el-descriptions-item label="批准人">{{ detailRow.approver || '-' }}</el-descriptions-item>
            <el-descriptions-item label="适用部门">{{ detailRow.applicable_dept || '-' }}</el-descriptions-item>
            <el-descriptions-item label="关联文件">{{ detailRow.associated_doc || '-' }}</el-descriptions-item>
            <el-descriptions-item label="保存期限">{{ detailRow.retention_period || '-' }}</el-descriptions-item>
          </template>
          <template v-if="isExternal">
            <el-descriptions-item label="来源分类">{{ categoryLabel(detailRow.category) }}</el-descriptions-item>
            <el-descriptions-item label="官方链接">{{ detailRow.url || '-' }}</el-descriptions-item>
          </template>
          <el-descriptions-item label="生效日期">{{ detailRow.effective_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="下次评审">{{ detailRow.review_date || '-' }}</el-descriptions-item>
          <el-descriptions-item label="内容摘要" :span="2">{{ detailRow.content || '-' }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="getFilePaths(detailRow).length>0" style="margin-top:12px">
          <el-button v-for="(p,i) in getFilePaths(detailRow)" :key="i" link type="primary" size="small" @click="window.open(p,'_blank')">📄 {{ p.split('/').pop() }}</el-button>
        </div>
      </template>
    </el-dialog>

    <!-- 编辑弹窗 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="650px">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="文件编号"><el-input v-model="form.doc_number" :placeholder="isExternal?'如：GB 7718-2025':'如：FS-P-001'" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="文件名称"><el-input v-model="form.doc_name" placeholder="文件全称" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="8"><el-form-item label="版本"><el-input v-model="form.version" placeholder="V1.0" /></el-form-item></el-col>
          <el-col v-if="isExternal" :span="8">
            <el-form-item label="来源分类">
              <el-select v-model="form.category" style="width:100%">
                <el-option label="法律法规" value="law" />
                <el-option label="国家标准" value="standard" />
                <el-option label="行业规范" value="industry" />
                <el-option label="企业制度" value="company" />
                <el-option label="客户要求" value="customer" />
                <el-option label="认证标准" value="certification" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="isExternal?8:16">
            <el-form-item label="状态">
              <el-select v-model="form.status" style="width:100%">
                <el-option label="现行有效" value="现行有效" />
                <el-option label="修订中" value="修订中" />
                <el-option label="已作废" value="已作废" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row v-if="!isExternal" :gutter="16">
          <el-col :span="8"><el-form-item label="编制人"><el-input v-model="form.author" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="审核人"><el-input v-model="form.reviewer" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="批准人"><el-input v-model="form.approver" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="生效日期"><el-date-picker v-model="form.effective_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item :label="isExternal?'废止日期':'下次评审'"><el-date-picker v-model="form.review_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row v-if="!isExternal" :gutter="16">
          <el-col :span="12"><el-form-item label="关联文件"><el-input v-model="form.associated_doc" placeholder="归属程序/SOP编号" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="适用部门"><el-input v-model="form.applicable_dept" placeholder="执行部门/岗位" /></el-form-item></el-col>
        </el-row>
        <el-form-item v-if="!isExternal && docType==='form'" label="保存期限"><el-input v-model="form.retention_period" placeholder="如：2年" /></el-form-item>
        <el-form-item v-if="isExternal" label="官方链接"><el-input v-model="form.url" placeholder="原文链接（选填）" /></el-form-item>
        <el-form-item label="内容摘要"><el-input v-model="form.content" type="textarea" :rows="3" placeholder="主要内容摘要" /></el-form-item>
        <el-form-item v-if="editId" label="变更说明"><el-input v-model="form.change_log" type="textarea" :rows="2" placeholder="本次修订内容说明" /></el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">支持 PDF/Word/图片</div></template>
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
import { useRoute } from 'vue-router'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'

const props = defineProps({
  docType: { type: String, default: '' }
})

const route = useRoute()

const docType = computed(() => {
  if (props.docType) return props.docType
  const p = route.path
  if (p.includes('/system/manual')) return 'manual'
  if (p.includes('/system/procedure')) return 'procedure'
  if (p.includes('/system/sop')) return 'sop'
  if (p.includes('/system/form')) return 'form'
  if (p.includes('/system/external')) return 'external'
  return 'procedure'
})

const isExternal = computed(() => docType.value === 'external')

const docTypeLabel = computed(() => ({
  manual: '管理手册', procedure: '程序文件', sop: '作业指导书（SOP）',
  form: '记录表单', external: '外部文件（法规/标准）'
}[docType.value] || '体系文件'))

const categoryLabel = (cat) => ({ law: '法律法规', standard: '国家标准', industry: '行业规范', company: '企业制度', customer: '客户要求', certification: '认证标准' }[cat] || cat)
const categoryType = (cat) => ({ law: 'primary', standard: 'warning', industry: '', company: 'success', customer: 'info', certification: 'danger' }[cat] || 'info')

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const categoryFilter = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const getFilePaths = (row) => { try { return JSON.parse(row.file_paths || '[]') } catch { return [] } }

const statCards = computed(() => [
  { label: '文件总数', value: list.value.length, cls: '', numCls: '', filter: '' },
  { label: '现行有效', value: list.value.filter(r=>r.status==='现行有效').length, cls: 'stat-valid', numCls: '', filter: '现行有效' },
  { label: '修订中', value: list.value.filter(r=>r.status==='修订中').length, cls: 'stat-warning', numCls: '', filter: '修订中' },
  { label: '已作废', value: list.value.filter(r=>r.status==='已作废').length, cls: 'stat-danger', numCls: '', filter: '已作废' }
])

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => (r.doc_name||'').includes(kw) || (r.doc_number||'').includes(kw) || (r.content||'').includes(kw))
  }
  if (categoryFilter.value) result = result.filter(r => r.category === categoryFilter.value)
  if (statusFilter.value) result = result.filter(r => r.status === statusFilter.value)
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
    const params = { user_id: user.id, doc_type: docType.value }
    if (categoryFilter.value) params.category = categoryFilter.value
    if (statusFilter.value) params.status = statusFilter.value
    if (keyword.value) params.keyword = keyword.value
    const res = await request.get('/sys-docs', { params })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm('确认删除选中文件？', '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/sys-docs/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功'); selectedIds.value = []; fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete('/api/sys-docs/' + id, { data: { user_id: user.id } })
    ElMessage.success('已删除'); fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  window.open('/api/sys-docs/export?user_id=' + user.id + '&doc_type=' + docType.value)
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

// 详情
const detailVisible = ref(false)
const detailRow = ref(null)
const viewDetail = (row) => { detailRow.value = row; detailVisible.value = true }

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('添加文件')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)
const form = reactive({
  doc_number: '', doc_name: '', version: 'V1.0', author: '', reviewer: '', approver: '',
  effective_date: '', review_date: '', status: '现行有效', category: 'standard',
  associated_doc: '', applicable_dept: '', retention_period: '', content: '', url: '', change_log: ''
})

const openAddDialog = () => {
  dialogTitle.value = '添加文件'; editId.value = null
  Object.assign(form, { doc_number: '', doc_name: '', version: 'V1.0', author: '', reviewer: '', approver: '', effective_date: '', review_date: '', status: '现行有效', category: 'standard', associated_doc: '', applicable_dept: '', retention_period: '', content: '', url: '', change_log: '' })
  newFiles.value = []; existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑文件'; editId.value = row.id
  Object.assign(form, {
    doc_number: row.doc_number, doc_name: row.doc_name, version: row.version,
    author: row.author, reviewer: row.reviewer, approver: row.approver,
    effective_date: row.effective_date, review_date: row.review_date,
    status: row.status, category: row.category,
    associated_doc: row.associated_doc, applicable_dept: row.applicable_dept,
    retention_period: row.retention_period, content: row.content, url: row.url, change_log: ''
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
  if (!form.doc_name) { ElMessage.warning('请填写文件名称'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    fd.append('doc_type', docType.value)
    Object.keys(form).forEach(k => fd.append(k, form[k] || ''))
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))
    if (editId.value) {
      await axios.put('/api/sys-docs/' + editId.value, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/sys-docs', fd)
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
