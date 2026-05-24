<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>化学品管理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索名称/CAS号..." clearable style="width:240px;margin-right:10px" @input="currentPage=1" />
        <el-button type="primary" @click="openChemDialog()">添加化学品</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="8"><el-card shadow="hover" class="stat-card"><div class="stat-num">{{ chemList.length }}</div><div class="stat-label">化学品总数</div></el-card></el-col>
      <el-col :span="8"><el-card shadow="hover" class="stat-card stat-valid"><div class="stat-num">{{ chemList.filter(c => c.docStatus === 'complete').length }}</div><div class="stat-label">资质齐全</div></el-card></el-col>
      <el-col :span="8"><el-card shadow="hover" class="stat-card stat-danger"><div class="stat-num">{{ chemList.filter(c => c.docStatus === 'incomplete').length }}</div><div class="stat-label">资质缺失</div></el-card></el-col>
    </el-row>

    <el-card>
      <el-tabs v-model="docTab" @tab-change="currentPage=1">
        <el-tab-pane label="化学品清单" name="list" />
        <el-tab-pane :label="'MSDS管理 ('+allDocs.filter(d=>d.doc_type==='msds').length+')'" name="msds" />
        <el-tab-pane :label="'农药登记证 ('+allDocs.filter(d=>d.doc_type==='pesticide_reg').length+')'" name="pesticide_reg" />
        <el-tab-pane :label="'标签管理 ('+allDocs.filter(d=>d.doc_type==='label').length+')'" name="label" />
      </el-tabs>

      <!-- 化学品清单 Tab -->
      <template v-if="docTab==='list'">
        <el-table :data="pagedChemList" stripe v-loading="loading" @selection-change="onSelectionChange" highlight-current-row @row-click="showChemDocs">
          <el-table-column type="selection" width="45" />
          <el-table-column label="化学品名称" prop="name" min-width="150" />
          <el-table-column label="CAS号" prop="cas_number" width="140" />
          <el-table-column label="剂型" prop="formulation" width="100" />
          <el-table-column label="用途区域" prop="usage_area" width="150" />
          <el-table-column label="存放位置" prop="storage_location" width="120" />
          <el-table-column label="数量" prop="quantity" width="80" />
          <el-table-column label="供应商" prop="supplier" width="120" />
          <el-table-column label="资质状态" width="100">
            <template #default="{row}">
              <el-tag :type="row.docStatus==='complete'?'success':'danger'" size="small">{{ row.docStatus==='complete'?'齐全':'缺失' }}</el-tag>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="140" fixed="right">
            <template #default="{row}">
              <el-button type="primary" link size="small" @click.stop="openChemDialog(row)">编辑</el-button>
              <el-button type="danger" link size="small" @click.stop="handleDeleteChem(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- MSDS/登记证/标签 Tab -->
      <template v-else>
        <div style="display:flex;justify-content:flex-end;margin-bottom:12px">
          <el-button type="primary" size="small" @click="openDocDialog()">添加文档</el-button>
        </div>
        <el-table :data="pagedDocList" stripe v-loading="loading">
          <el-table-column label="化学品" width="150">
            <template #default="{row}">{{ row.chemical_name || '-' }}</template>
          </el-table-column>
          <el-table-column label="文档名称" prop="doc_name" min-width="180" />
          <el-table-column label="编号" prop="doc_number" width="150" />
          <el-table-column v-if="docTab==='msds'" label="GHS分类" prop="ghs_classification" width="120" />
          <el-table-column v-if="docTab==='pesticide_reg'" label="登记证持有人" prop="holder" width="150" />
          <el-table-column v-if="docTab==='pesticide_reg'" label="有效成分" prop="active_ingredient" width="120" />
          <el-table-column v-if="docTab==='label'" label="合规状态" width="100">
            <template #default="{row}">
              <el-tag :type="row.is_compliant===1?'success':row.is_compliant===0?'danger':'info'" size="small">
                {{ row.is_compliant===1?'合规':row.is_compliant===0?'不合规':'未评估' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="到期日期" width="110">
            <template #default="{row}">{{ row.expiry_date || '-' }}</template>
          </el-table-column>
          <el-table-column label="状态" width="80">
            <template #default="{row}">
              <el-tag v-if="!row.expiry_date" type="info" size="small">无期限</el-tag>
              <el-tag v-else :type="getStatus(row.expiry_date)==='expired'?'danger':getStatus(row.expiry_date)==='expiring_soon'?'warning':'success'" size="small">
                {{ getStatus(row.expiry_date)==='expired'?'过期':getStatus(row.expiry_date)==='expiring_soon'?'临期':'正常' }}
              </el-tag>
            </template>
          </el-table-column>
          <el-table-column label="附件" width="70">
            <template #default="{row}">
              <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
              <span v-else style="color:#c0c4cc">无</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{row}">
              <el-button type="primary" link size="small" @click="openDocDialog(row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDeleteDoc(row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <el-empty v-if="!loading && (docTab==='list'?chemList.length===0:filteredDocList.length===0)" description="暂无数据" />
    </el-card>

    <!-- 化学品对话框 -->
    <el-dialog v-model="chemDialogVisible" :title="chemDialogTitle" width="500px">
      <el-form :model="chemForm" label-width="80px">
        <el-form-item label="名称"><el-input v-model="chemForm.name" placeholder="化学品名称" /></el-form-item>
        <el-form-item label="CAS号"><el-input v-model="chemForm.cas_number" placeholder="CAS号" /></el-form-item>
        <el-form-item label="剂型"><el-input v-model="chemForm.formulation" placeholder="如：乳油、可湿性粉剂" /></el-form-item>
        <el-form-item label="用途区域"><el-input v-model="chemForm.usage_area" placeholder="使用区域" /></el-form-item>
        <el-form-item label="存放位置"><el-input v-model="chemForm.storage_location" placeholder="存放位置" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="chemForm.quantity" placeholder="库存数量" /></el-form-item>
        <el-form-item label="供应商"><el-input v-model="chemForm.supplier" placeholder="供应商名称" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="chemDialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleChemSubmit" :loading="chemSubmitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 化学品文档对话框 -->
    <el-dialog v-model="docDialogVisible" :title="docDialogTitle" width="550px">
      <el-form :model="docForm" label-width="100px">
        <el-form-item label="关联化学品">
          <el-select v-model="docForm.chemical_id" style="width:100%" placeholder="选择化学品">
            <el-option v-for="c in chemList" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="文档名称"><el-input v-model="docForm.doc_name" placeholder="文档名称" /></el-form-item>
        <el-form-item label="编号"><el-input v-model="docForm.doc_number" placeholder="文档编号" /></el-form-item>
        <el-form-item label="版本"><el-input v-model="docForm.version" placeholder="版本号" /></el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="docForm.issue_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="生效日期" />
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker v-model="docForm.expiry_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="到期日期" />
        </el-form-item>
        <el-form-item v-if="docTab==='msds'||editDocType==='msds'" label="GHS分类">
          <el-input v-model="docForm.ghs_classification" placeholder="如：急性毒性类别4" />
        </el-form-item>
        <el-form-item v-if="docTab==='pesticide_reg'||editDocType==='pesticide_reg'" label="登记证持有人">
          <el-input v-model="docForm.holder" placeholder="登记证持有人" />
        </el-form-item>
        <el-form-item v-if="docTab==='pesticide_reg'||editDocType==='pesticide_reg'" label="有效成分">
          <el-input v-model="docForm.active_ingredient" placeholder="有效成分" />
        </el-form-item>
        <el-form-item v-if="docTab==='label'||editDocType==='label'" label="合规状态">
          <el-radio-group v-model="docForm.is_compliant">
            <el-radio :value="1">合规</el-radio>
            <el-radio :value="0">不合规</el-radio>
            <el-radio :value="-1">未评估</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="docUploadRef" drag :auto-upload="false" :limit="5" :on-change="handleDocFileChange" :on-remove="handleDocFileRemove" :file-list="docExistingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="docDialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleDocSubmit" :loading="docSubmitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'

const chemList = ref([])
const allDocs = ref([])
const loading = ref(false)
const keyword = ref('')
const docTab = ref('list')
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

const getFilePaths = (row) => {
  try { return JSON.parse(row.file_paths || '[]') } catch { return [] }
}

const filteredChemList = computed(() => {
  let result = chemList.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(c => c.name.includes(kw) || c.cas_number.includes(kw))
  }
  return result
})

const pagedChemList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredChemList.value.slice(start, start + pageSize.value)
})

const filteredDocList = computed(() => {
  return allDocs.value.filter(d => d.doc_type === docTab.value)
})

const pagedDocList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredDocList.value.slice(start, start + pageSize.value)
})

const fetchData = async () => {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const [chemRes, docsRes] = await Promise.all([
      request.get('/pest/chemicals', { params: { user_id: user.id } }),
      request.get('/pest/chemical-docs', { params: { user_id: user.id } })
    ])
    allDocs.value = docsRes.list
    chemList.value = chemRes.list.map(c => {
      const chemDocs = docsRes.list.filter(d => d.chemical_id === c.id)
      const hasMsds = chemDocs.some(d => d.doc_type === 'msds')
      const hasReg = chemDocs.some(d => d.doc_type === 'pesticide_reg')
      const hasLabel = chemDocs.some(d => d.doc_type === 'label')
      return { ...c, docStatus: (hasMsds && hasReg && hasLabel) ? 'complete' : 'incomplete' }
    })
  } catch {} finally { loading.value = false }
}

onMounted(fetchData)

const showChemDocs = (row) => {
  // Clicking a chemical shows its docs in the appropriate tab
}

const onSelectionChange = (rows) => {
  selectedIds.value = rows.map(r => r.id)
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 个化学品？`, '批量删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/pest/chemicals/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    fetchData()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDeleteChem = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除该化学品及其所有文档？', '删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete(`/api/pest/chemicals/${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    fetchData()
  } catch { ElMessage.error('删除失败') }
}

const handleDeleteDoc = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除该文档？', '删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete(`/api/pest/chemical-docs/${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    fetchData()
  } catch { ElMessage.error('删除失败') }
}

const previewFiles = (row) => {
  getFilePaths(row).forEach(p => window.open(p, '_blank'))
}

// 化学品对话框
const chemDialogVisible = ref(false)
const chemDialogTitle = ref('添加化学品')
const editChemId = ref(null)
const chemSubmitting = ref(false)
const chemForm = reactive({ name: '', cas_number: '', formulation: '', usage_area: '', storage_location: '', quantity: '', supplier: '' })

const openChemDialog = (row) => {
  if (row) {
    chemDialogTitle.value = '编辑化学品'
    editChemId.value = row.id
    Object.assign(chemForm, { name: row.name, cas_number: row.cas_number, formulation: row.formulation, usage_area: row.usage_area, storage_location: row.storage_location, quantity: row.quantity, supplier: row.supplier })
  } else {
    chemDialogTitle.value = '添加化学品'
    editChemId.value = null
    Object.assign(chemForm, { name: '', cas_number: '', formulation: '', usage_area: '', storage_location: '', quantity: '', supplier: '' })
  }
  chemDialogVisible.value = true
}

const handleChemSubmit = async () => {
  if (!chemForm.name) { ElMessage.warning('请填写化学品名称'); return }
  chemSubmitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    if (editChemId.value) {
      await axios.put(`/api/pest/chemicals/${editChemId.value}`, { user_id: user.id, ...chemForm })
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/pest/chemicals', { user_id: user.id, ...chemForm })
      ElMessage.success('添加成功')
    }
    chemDialogVisible.value = false
    fetchData()
  } catch { ElMessage.error('操作失败') } finally { chemSubmitting.value = false }
}

// 化学品文档对话框
const docDialogVisible = ref(false)
const docDialogTitle = ref('添加文档')
const editDocId = ref(null)
const editDocType = ref('')
const docUploadRef = ref(null)
const docNewFiles = ref([])
const docExistingFilesList = ref([])
const docSubmitting = ref(false)
const docForm = reactive({
  chemical_id: '', doc_name: '', doc_number: '', version: '', issue_date: '', expiry_date: '',
  ghs_classification: '', holder: '', active_ingredient: '', is_compliant: -1
})

const openDocDialog = (row) => {
  editDocType.value = row ? row.doc_type : docTab.value
  if (row) {
    docDialogTitle.value = '编辑文档'
    editDocId.value = row.id
    Object.assign(docForm, {
      chemical_id: row.chemical_id, doc_name: row.doc_name, doc_number: row.doc_number,
      version: row.version, issue_date: row.issue_date, expiry_date: row.expiry_date,
      ghs_classification: row.ghs_classification || '', holder: row.holder || '',
      active_ingredient: row.active_ingredient || '', is_compliant: row.is_compliant
    })
    docNewFiles.value = []
    const paths = getFilePaths(row)
    docExistingFilesList.value = paths.map((p, i) => ({ name: p.split('/').pop(), url: p, uid: i }))
  } else {
    docDialogTitle.value = '添加文档'
    editDocId.value = null
    Object.assign(docForm, {
      chemical_id: '', doc_name: '', doc_number: '', version: '', issue_date: '', expiry_date: '',
      ghs_classification: '', holder: '', active_ingredient: '', is_compliant: -1
    })
    docNewFiles.value = []
    docExistingFilesList.value = []
  }
  if (docUploadRef.value) docUploadRef.value.clearFiles()
  docDialogVisible.value = true
}

const handleDocFileChange = (file) => { docNewFiles.value.push(file.raw) }
const handleDocFileRemove = (file) => {
  const idx = docExistingFilesList.value.findIndex(f => f.uid === file.uid)
  if (idx >= 0) docExistingFilesList.value.splice(idx, 1)
}

const handleDocSubmit = async () => {
  if (!docForm.chemical_id || !docForm.doc_name) { ElMessage.warning('请选择化学品并填写文档名称'); return }
  docSubmitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    fd.append('chemical_id', docForm.chemical_id)
    fd.append('doc_type', editDocType.value)
    fd.append('doc_name', docForm.doc_name)
    fd.append('doc_number', docForm.doc_number)
    fd.append('version', docForm.version)
    fd.append('issue_date', docForm.issue_date)
    fd.append('expiry_date', docForm.expiry_date)
    fd.append('ghs_classification', docForm.ghs_classification)
    fd.append('holder', docForm.holder)
    fd.append('active_ingredient', docForm.active_ingredient)
    fd.append('is_compliant', docForm.is_compliant)
    fd.append('existing_files', JSON.stringify(docExistingFilesList.value.map(f => f.url)))
    docNewFiles.value.forEach(f => fd.append('files', f))

    if (editDocId.value) {
      await axios.put(`/api/pest/chemical-docs/${editDocId.value}`, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/pest/chemical-docs', fd)
      ElMessage.success('添加成功')
    }
    docDialogVisible.value = false
    fetchData()
  } catch { ElMessage.error('操作失败') } finally { docSubmitting.value = false }
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
.stat-danger .stat-num { color: #f56c6c; }
</style>
