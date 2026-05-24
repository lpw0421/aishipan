<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>产品检测报告</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索产品名称/报告编号/机构..." clearable style="width:260px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="typeFilter" placeholder="报告类型" clearable style="width:130px;margin-right:8px" @change="currentPage=1">
          <el-option v-for="t in reportTypes" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="conclusionFilter" placeholder="检测结论" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="合格" value="合格" />
          <el-option label="不合格" value="不合格" />
          <el-option label="部分不合格" value="部分不合格" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增报告</el-button>
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
      <el-tabs v-model="typeFilter" @tab-change="currentPage=1">
        <el-tab-pane :label="'全部 ('+list.length+')'" name="" />
        <el-tab-pane v-for="t in reportTypes" :key="t" :label="t+' ('+list.filter(r=>r.report_type===t).length+')'" :name="t" />
      </el-tabs>

      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="产品名称" prop="product_name" min-width="140" />
        <el-table-column label="产品批次" prop="product_batch" width="120" />
        <el-table-column label="报告编号" prop="report_number" width="140" />
        <el-table-column label="报告类型" prop="report_type" width="110" />
        <el-table-column label="检测机构" prop="agency_name" min-width="150" />
        <el-table-column label="检测日期" width="110">
          <template #default="{row}">{{ row.test_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="有效期至" width="110">
          <template #default="{row}">{{ row.expiry_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="结论" width="100">
          <template #default="{row}">
            <el-tag :type="row.conclusion==='不合格'?'danger':row.conclusion==='部分不合格'?'warning':'success'" size="small">{{ row.conclusion }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="不合格项" prop="unqualified_items" min-width="120" show-overflow-tooltip />
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
      <el-empty v-if="!loading && filteredList.length===0" description="暂无产品报告" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="580px">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="产品名称"><el-input v-model="form.product_name" placeholder="如：牛肉酱" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="产品批次"><el-input v-model="form.product_batch" placeholder="选填" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="报告编号"><el-input v-model="form.report_number" placeholder="检测机构出具编号" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="报告类型">
              <el-select v-model="form.report_type" style="width:100%">
                <el-option v-for="t in reportTypes" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="检测机构"><el-input v-model="form.agency_name" placeholder="第三方检测公司" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="检测日期"><el-date-picker v-model="form.test_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="有效期至"><el-date-picker v-model="form.expiry_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12">
            <el-form-item label="检测结论">
              <el-select v-model="form.conclusion" style="width:100%">
                <el-option label="合格" value="合格" />
                <el-option label="不合格" value="不合格" />
                <el-option label="部分不合格" value="部分不合格" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item v-if="form.conclusion !== '合格'" label="不合格项"><el-input v-model="form.unqualified_items" type="textarea" :rows="2" placeholder="列出具体不合格项目" /></el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">检测报告 PDF、现场照片</div></template>
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
const conclusionFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const reportTypes = ['微生物检测', '理化指标', '农残检测', '重金属检测', '全项检测']

const getFilePaths = (row) => { try { return JSON.parse(row.file_paths || '[]') } catch { return [] } }

const statCards = computed(() => [
  { label: '报告总数', value: list.value.length, cls: '', numCls: '', filter: '' },
  { label: '合格', value: list.value.filter(r=>r.conclusion==='合格').length, cls: 'stat-valid', numCls: '', filter: '合格' },
  { label: '不合格', value: list.value.filter(r=>r.conclusion==='不合格'||r.conclusion==='部分不合格').length, cls: 'stat-danger', numCls: '', filter: '不合格' },
  { label: '本月新增', value: list.value.filter(r=>{ const d=new Date(r.created_at); const now=new Date(); return d.getMonth()===now.getMonth()&&d.getFullYear()===now.getFullYear() }).length, cls: '', numCls: '', filter: '' }
])

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => (r.product_name||'').includes(kw) || (r.report_number||'').includes(kw) || (r.agency_name||'').includes(kw))
  }
  if (typeFilter.value) result = result.filter(r => r.report_type === typeFilter.value)
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
    if (typeFilter.value) params.report_type = typeFilter.value
    if (conclusionFilter.value) params.conclusion = conclusionFilter.value
    if (keyword.value) params.keyword = keyword.value
    const res = await request.get('/product-reports', { params })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm('确认删除选中报告？', '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/product-reports/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功'); selectedIds.value = []; fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete('/api/product-reports/' + id, { data: { user_id: user.id } })
    ElMessage.success('已删除'); fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  window.open('/api/product-reports/export?user_id=' + user.id)
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增报告')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)
const form = reactive({
  product_name: '', product_batch: '', report_number: '', report_type: '微生物检测',
  agency_name: '', test_date: '', expiry_date: '', conclusion: '合格', unqualified_items: ''
})

const openAddDialog = () => {
  dialogTitle.value = '新增报告'; editId.value = null
  Object.assign(form, { product_name: '', product_batch: '', report_number: '', report_type: '微生物检测', agency_name: '', test_date: '', expiry_date: '', conclusion: '合格', unqualified_items: '' })
  newFiles.value = []; existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑报告'; editId.value = row.id
  Object.assign(form, {
    product_name: row.product_name, product_batch: row.product_batch, report_number: row.report_number,
    report_type: row.report_type, agency_name: row.agency_name, test_date: row.test_date,
    expiry_date: row.expiry_date, conclusion: row.conclusion, unqualified_items: row.unqualified_items
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
  if (!form.product_name) { ElMessage.warning('请填写产品名称'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    Object.keys(form).forEach(k => fd.append(k, form[k] || ''))
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))
    if (editId.value) {
      await axios.put('/api/product-reports/' + editId.value, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/product-reports', fd)
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
