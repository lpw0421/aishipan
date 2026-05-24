<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>投诉与整改追踪</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索区域/问题/投诉人..." clearable style="width:240px;margin-right:10px" @input="currentPage=1" />
        <el-select v-model="statusFilter" placeholder="状态筛选" clearable style="width:130px;margin-right:10px" @change="currentPage=1">
          <el-option label="待处理" value="待处理" />
          <el-option label="处理中" value="处理中" />
          <el-option label="待复查" value="待复查" />
          <el-option label="已关闭" value="已关闭" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增投诉</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
        <el-button @click="handleExport">导出Excel</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6"><el-card shadow="hover" class="stat-card" :class="{'active-card':statusFilter==='待处理'}" @click="statusFilter=statusFilter==='待处理'?'':'待处理'"><div class="stat-num stat-pending">{{ list.filter(r=>r.status==='待处理').length }}</div><div class="stat-label">待处理</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card" :class="{'active-card':statusFilter==='处理中'}" @click="statusFilter=statusFilter==='处理中'?'':'处理中'"><div class="stat-num stat-processing">{{ list.filter(r=>r.status==='处理中').length }}</div><div class="stat-label">处理中</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card" :class="{'active-card':statusFilter==='待复查'}" @click="statusFilter=statusFilter==='待复查'?'':'待复查'"><div class="stat-num stat-review">{{ list.filter(r=>r.status==='待复查').length }}</div><div class="stat-label">待复查</div></el-card></el-col>
      <el-col :span="6"><el-card shadow="hover" class="stat-card" :class="{'active-card':statusFilter==='已关闭'}" @click="statusFilter=statusFilter==='已关闭'?'':'已关闭'"><div class="stat-num stat-closed">{{ list.filter(r=>r.status==='已关闭').length }}</div><div class="stat-label">已关闭</div></el-card></el-col>
    </el-row>

    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange" @row-click="showDetail">
        <el-table-column type="selection" width="45" />
        <el-table-column label="投诉编号" prop="complaint_number" width="160" />
        <el-table-column label="投诉日期" prop="complaint_date" width="110" />
        <el-table-column label="区域" prop="area" width="120" />
        <el-table-column label="问题描述" prop="description" min-width="200" show-overflow-tooltip />
        <el-table-column label="严重等级" width="100">
          <template #default="{row}">
            <el-tag :type="severityType(row.severity)" size="small">{{ row.severity }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="处理人" prop="handler" width="100" />
        <el-table-column label="处理时限" prop="deadline" width="140" />
        <el-table-column label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="statusType(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click.stop="openEditDialog(row)">编辑</el-button>
            <el-button v-if="row.status==='待处理'" type="warning" link size="small" @click.stop="assignComplaint(row)">派单</el-button>
            <el-button v-if="row.status==='处理中'" type="success" link size="small" @click.stop="reviewComplaint(row)">复查</el-button>
            <el-button v-if="row.status==='待复查'" type="success" link size="small" @click.stop="closeComplaint(row)">关闭</el-button>
            <el-button type="danger" link size="small" @click.stop="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length===0" description="暂无投诉记录" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <!-- 投诉详情弹窗 -->
    <el-dialog v-model="detailVisible" title="投诉详情" width="600px">
      <div class="detail-section">
        <div class="detail-header">
          <el-tag :type="severityType(detail.severity)" size="small">{{ detail.severity }}</el-tag>
          <el-tag :type="statusType(detail.status)" size="small" style="margin-left:8px">{{ detail.status }}</el-tag>
          <span style="margin-left:12px;color:#909399">{{ detail.complaint_number }}</span>
        </div>
        <el-divider />
        <div class="detail-row"><label>投诉日期</label><span>{{ detail.complaint_date || '-' }}</span></div>
        <div class="detail-row"><label>投诉人</label><span>{{ detail.reporter || '-' }}</span></div>
        <div class="detail-row"><label>区域</label><span>{{ detail.area || '-' }}</span></div>
        <div class="detail-row"><label>问题描述</label><span>{{ detail.description || '-' }}</span></div>
        <div class="detail-row"><label>处理人</label><span>{{ detail.handler || '未指派' }}</span></div>
        <div class="detail-row"><label>处理时限</label><span>{{ detail.deadline || '-' }}</span></div>
        <div class="detail-row"><label>处理措施</label><span>{{ detail.measures || '-' }}</span></div>
        <div class="detail-row"><label>复查结果</label><span>{{ detail.review_result || '-' }}</span></div>
        <div class="detail-row"><label>关闭日期</label><span>{{ detail.close_date || '-' }}</span></div>
      </div>
    </el-dialog>

    <!-- 对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <el-form :model="form" label-width="80px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="投诉编号"><el-input v-model="form.complaint_number" placeholder="如：TS-20260524-001" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="投诉日期"><el-date-picker v-model="form.complaint_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="投诉人"><el-input v-model="form.reporter" placeholder="发现问题的员工/客户" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="发现区域"><el-input v-model="form.area" placeholder="具体位置" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="问题描述"><el-input v-model="form.description" type="textarea" :rows="2" placeholder="虫害类型、数量、现场情况" /></el-form-item>
        <el-form-item label="严重等级">
          <el-radio-group v-model="form.severity">
            <el-radio value="严重">🔴 严重（立即处理）</el-radio>
            <el-radio value="一般">🟡 一般（24h内）</el-radio>
            <el-radio value="轻微">🟢 轻微（48h内）</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="处理人"><el-input v-model="form.handler" placeholder="指派的Pest Technician" /></el-form-item>
        <el-form-item label="处理时限"><el-input v-model="form.deadline" placeholder="处理截止时间" /></el-form-item>
        <el-form-item label="处理措施"><el-input v-model="form.measures" type="textarea" :rows="2" placeholder="实际采取的处理方式" /></el-form-item>
        <el-form-item label="复查结果"><el-input v-model="form.review_result" placeholder="复查是否合格" /></el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">处理前/后对比照片</div></template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 派单对话框 -->
    <el-dialog v-model="assignVisible" title="派单" width="400px">
      <el-form label-width="80px">
        <el-form-item label="处理人"><el-input v-model="assignHandler" placeholder="指派处理人员" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="assignVisible=false">取消</el-button>
        <el-button type="primary" @click="handleAssign" :loading="assignSubmitting">确定派单</el-button>
      </template>
    </el-dialog>

    <!-- 复查对话框 -->
    <el-dialog v-model="reviewVisible" title="复查" width="400px">
      <el-form label-width="80px">
        <el-form-item label="复查结果">
          <el-radio-group v-model="reviewResult">
            <el-radio value="合格">合格</el-radio>
            <el-radio value="不合格">不合格</el-radio>
          </el-radio-group>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="reviewVisible=false">取消</el-button>
        <el-button type="primary" @click="handleReview" :loading="reviewSubmitting">确定</el-button>
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
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const severityType = (s) => ({ '严重': 'danger', '一般': 'warning', '轻微': '' })[s] || 'info'
const statusType = (s) => ({ '待处理': 'danger', '处理中': 'warning', '待复查': '', '已关闭': 'success' })[s] || 'info'

const getFilePaths = (row) => {
  try { return JSON.parse(row.file_paths || '[]') } catch { return [] }
}

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => r.area.includes(kw) || r.description.includes(kw) || r.reporter.includes(kw) || r.complaint_number.includes(kw))
  }
  if (statusFilter.value) {
    result = result.filter(r => r.status === statusFilter.value)
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
    const res = await request.get('/pest/complaints', { params: { user_id: user.id } })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 条投诉？`, '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/pest/complaints/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除该投诉？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete(`/api/pest/complaints/${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    fetchList()
  } catch { ElMessage.error('删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  let url = `/api/pest/complaints/export?user_id=${user.id}`
  if (selectedIds.value.length > 0) url += '&ids=' + selectedIds.value.join(',')
  window.open(url)
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

// 详情弹窗
const detailVisible = ref(false)
const detail = ref({})
const showDetail = (row) => { detail.value = row; detailVisible.value = true }

// 添加/编辑对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增投诉')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)
const form = reactive({
  complaint_number: '', complaint_date: '', reporter: '', area: '', description: '',
  severity: '一般', handler: '', deadline: '', measures: '', review_result: ''
})

const openAddDialog = () => {
  dialogTitle.value = '新增投诉'
  editId.value = null
  Object.assign(form, { complaint_number: '', complaint_date: '', reporter: '', area: '', description: '', severity: '一般', handler: '', deadline: '', measures: '', review_result: '' })
  newFiles.value = []
  existingFilesList.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑投诉'
  editId.value = row.id
  Object.assign(form, {
    complaint_number: row.complaint_number, complaint_date: row.complaint_date,
    reporter: row.reporter, area: row.area, description: row.description,
    severity: row.severity, handler: row.handler, deadline: row.deadline,
    measures: row.measures, review_result: row.review_result
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
  if (!form.complaint_number) { ElMessage.warning('请填写投诉编号'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    Object.keys(form).forEach(k => fd.append(k, form[k]))
    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))

    if (editId.value) {
      await axios.put(`/api/pest/complaints/${editId.value}`, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/pest/complaints', fd)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch { ElMessage.error('操作失败') } finally { submitting.value = false }
}

// 派单
const assignVisible = ref(false)
const assignId = ref(null)
const assignHandler = ref('')
const assignSubmitting = ref(false)

const assignComplaint = (row) => {
  assignId.value = row.id
  assignHandler.value = row.handler || ''
  assignVisible.value = true
}

const handleAssign = async () => {
  assignSubmitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put(`/api/pest/complaints/${assignId.value}/assign`, { user_id: user.id, handler: assignHandler.value })
    ElMessage.success('已派单')
    assignVisible.value = false
    fetchList()
  } catch { ElMessage.error('派单失败') } finally { assignSubmitting.value = false }
}

// 复查
const reviewVisible = ref(false)
const reviewId = ref(null)
const reviewResult = ref('合格')
const reviewSubmitting = ref(false)

const reviewComplaint = (row) => {
  reviewId.value = row.id
  reviewResult.value = '合格'
  reviewVisible.value = true
}

const handleReview = async () => {
  reviewSubmitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put(`/api/pest/complaints/${reviewId.value}/review`, { user_id: user.id, review_result: reviewResult.value })
    ElMessage.success(reviewResult.value === '合格' ? '复查合格，已关闭' : '复查不合格，退回处理')
    reviewVisible.value = false
    fetchList()
  } catch { ElMessage.error('复查失败') } finally { reviewSubmitting.value = false }
}

// 关闭
const closeComplaint = async (row) => {
  try { await ElMessageBox.confirm('确认关闭该投诉？', '关闭投诉', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.put(`/api/pest/complaints/${row.id}/close`, { user_id: user.id })
    ElMessage.success('投诉已关闭')
    fetchList()
  } catch { ElMessage.error('关闭失败') }
}
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
.toolbar-right { display: flex; align-items: center; }
.stat-card { cursor: pointer; text-align: center; }
.stat-card.active-card { border: 2px solid #409eff; }
.stat-num { font-size: 28px; font-weight: bold; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-pending { color: #f56c6c; }
.stat-processing { color: #e6a23c; }
.stat-review { color: #409eff; }
.stat-closed { color: #67c23a; }
.detail-section .detail-header { display: flex; align-items: center; }
.detail-row { display: flex; margin: 10px 0; }
.detail-row label { width: 80px; color: #909399; flex-shrink: 0; }
.detail-row span { color: #303133; }
.upload-tip { color: #909399; font-size: 12px; margin-top: 4px; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
