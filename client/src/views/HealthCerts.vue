<template>
  <div class="page-container">
    <!-- ===== 统计卡片 ===== -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <div class="stat-card stat-total" @click="toggleFilter('')">
          <div class="stat-number">{{ stats.total }}</div>
          <div class="stat-label">总人数</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div
          class="stat-card stat-normal"
          :class="{ active: filterStatus === 'valid' }"
          @click="toggleFilter('valid')"
        >
          <div class="stat-number">{{ stats.valid }}</div>
          <div class="stat-label">正常</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div
          class="stat-card stat-warning"
          :class="{ active: filterStatus === 'expiring_soon' }"
          @click="toggleFilter('expiring_soon')"
        >
          <div class="stat-number">{{ stats.expiringSoon }}</div>
          <div class="stat-label">临期 ≤30天</div>
        </div>
      </el-col>
      <el-col :span="6">
        <div
          class="stat-card stat-danger"
          :class="{ active: filterStatus === 'expired' }"
          @click="toggleFilter('expired')"
        >
          <div class="stat-number">{{ stats.expired }}</div>
          <div class="stat-label">已过期</div>
        </div>
      </el-col>
    </el-row>

    <!-- 搜索栏 -->
    <div class="toolbar">
      <h2>
        员工健康证管理
        <el-tag v-if="filterStatus" size="small" closable @close="filterStatus = ''" style="margin-left:10px">
          已筛选：{{ statusLabel(filterStatus) }}
        </el-tag>
      </h2>
      <div class="toolbar-right">
        <template v-if="selectedRows.length > 0">
          <span style="color:#606266;margin-right:8px">已选 {{ selectedRows.length }} 项</span>
          <el-button type="warning" @click="handleBatchExport">批量导出</el-button>
          <el-popconfirm title="确定要删除选中的健康证吗？" @confirm="handleBatchDelete">
            <template #reference>
              <el-button type="danger">批量删除</el-button>
            </template>
          </el-popconfirm>
        </template>
        <el-input
          v-model="keyword"
          placeholder="搜索姓名/部门..."
          clearable
          style="width: 220px; margin-right: 10px"
          @input="currentPage = 1; fetchList()"
        />
        <el-button type="success" @click="handleExport">导出 Excel</el-button>
        <el-button type="primary" @click="openAddDialog">添加健康证</el-button>
      </div>
    </div>

    <!-- 列表表格 -->
    <el-card>
      <el-table :data="pagedList" border stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="employee_name" label="员工姓名" min-width="120" />
        <el-table-column prop="department" label="部门" width="120">
          <template #default="{ row }">
            {{ row.department || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="expiry_date" label="到期日期" width="130" />
        <!-- 状态列 -->
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'valid'" type="success">正常 · 剩{{ getDaysLeft(row.expiry_date) }}天</el-tag>
            <el-tag v-else-if="row.status === 'expiring_soon'" type="warning">临期 · 剩{{ getDaysLeft(row.expiry_date) }}天</el-tag>
            <el-tag v-else type="danger">已过期 · 超{{ -getDaysLeft(row.expiry_date) }}天</el-tag>
          </template>
        </el-table-column>
        <!-- 附件列 -->
        <el-table-column label="附件" width="100">
          <template #default="{ row }">
            <div v-if="getFilePaths(row).length > 0" class="file-list">
              <el-button
                v-for="(fp, idx) in getFilePaths(row)"
                :key="idx"
                type="primary"
                link
                size="small"
                @click="handlePreview(fp)"
              >
                {{ getFileIcon(fp) }} 文件{{ idx + 1 }}
              </el-button>
            </div>
            <span v-else style="color:#c0c4cc">无</span>
          </template>
        </el-table-column>
        <!-- 操作列 -->
        <el-table-column label="操作" width="150">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-popconfirm title="确定要删除该记录吗？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无健康证记录" />
      <div v-if="filteredList.length > 10" class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :pager-count="5"
          layout="prev, pager, next, total"
          :total="filteredList.length"
          background
        />
      </div>
    </el-card>

    <!-- ===== 新增/编辑弹窗 ===== -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="员工姓名">
          <el-input v-model="form.employee_name" placeholder="请输入员工姓名" />
        </el-form-item>
        <el-form-item label="部门">
          <el-input v-model="form.department" placeholder="请输入部门" />
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker
            v-model="form.expiry_date"
            type="date"
            placeholder="选择到期日期"
            value-format="YYYY-MM-DD"
            style="width:100%"
          />
        </el-form-item>
        <el-form-item label="上传附件">
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :limit="5"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            :on-exceed="handleExceed"
            accept="image/jpeg,image/png,image/gif,.pdf,.doc,.docx"
            list-type="text"
            multiple
          >
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip>
              <div class="upload-tip">支持 jpg/png/gif/pdf/doc/docx，单个 ≤ 10MB，最多5个</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 附件预览弹窗 -->
    <el-dialog v-model="previewVisible" title="附件预览" width="700px">
      <img v-if="previewType === 'image'" :src="previewUrl" style="width:100%" alt="附件图片" />
      <iframe v-else-if="previewType === 'pdf'" :src="previewUrl" style="width:100%;height:70vh" frameborder="0" />
      <div v-else>
        <p>此文件类型不支持在线预览</p>
        <el-button type="primary" @click="downloadFile(previewUrl)">下载查看</el-button>
      </div>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../utils/request'
import axios from 'axios'

// 当前用户
const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

// 列表 & 搜索
const list = ref([])
const loading = ref(false)
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const filterStatus = ref('')

const toggleFilter = (status) => {
  filterStatus.value = filterStatus.value === status ? '' : status
  currentPage.value = 1
}

const statusLabel = (status) => {
  return { valid: '正常', expiring_soon: '临期 ≤30天', expired: '已过期' }[status] || status
}

const getDaysLeft = (expiryDate) => {
  const diff = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
  return diff
}

// 统计数据
const stats = computed(() => {
  const filtered = list.value.filter(r => filterStatus.value ? r.status === filterStatus.value : true)
  return {
    total: filtered.length,
    valid: filtered.filter(r => r.status === 'valid').length,
    expiringSoon: filtered.filter(r => r.status === 'expiring_soon').length,
    expired: filtered.filter(r => r.status === 'expired').length
  }
})

const filteredList = computed(() => {
  if (!filterStatus.value) return list.value
  return list.value.filter(r => r.status === filterStatus.value)
})

// 分页后的列表
const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

// 获取列表
const fetchList = async () => {
  loading.value = true
  try {
    const params = { user_id: userId }
    if (keyword.value) params.keyword = keyword.value
    const res = await request.get('/health-certs', { params })
    list.value = res.list
  } catch {
    // 错误已在拦截器处理
  } finally {
    loading.value = false
  }
}

const route = useRoute()

onMounted(() => {
  fetchList()
  if (route.query.action === 'add') openAddDialog()
})

// ===== 新增/编辑弹窗 =====
const dialogVisible = ref(false)
const dialogMode = ref('add')  // 'add' | 'edit'
const editingId = ref(null)
const uploadRef = ref(null)
const selectedFiles = ref([])
const submitting = ref(false)

const dialogTitle = computed(() => dialogMode.value === 'add' ? '添加健康证' : '编辑健康证')

const form = reactive({
  employee_name: '',
  department: '',
  expiry_date: ''
})

const selectedRows = ref([])

// 打开新增弹窗
const openAddDialog = () => {
  dialogMode.value = 'add'
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

// 打开编辑弹窗（预填数据）
const openEditDialog = (row) => {
  dialogMode.value = 'edit'
  editingId.value = row.id
  form.employee_name = row.employee_name
  form.department = row.department || ''
  form.expiry_date = row.expiry_date
  selectedFiles.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  form.employee_name = ''
  form.department = ''
  form.expiry_date = ''
  selectedFiles.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
}

const handleFileChange = (file) => {
  selectedFiles.value.push(file.raw)
}

const handleFileRemove = (file) => {
  const idx = selectedFiles.value.indexOf(file.raw)
  if (idx > -1) selectedFiles.value.splice(idx, 1)
}

const handleExceed = () => {
  ElMessage.warning('最多上传5个文件，请先移除已有文件')
}

// 提交（新增或编辑）
const handleSubmit = async () => {
  if (!form.employee_name || !form.expiry_date) {
    ElMessage.warning('请填写员工姓名和到期日期')
    return
  }

  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('user_id', userId)
    fd.append('employee_name', form.employee_name)
    fd.append('department', form.department || '')
    fd.append('expiry_date', form.expiry_date)
    selectedFiles.value.forEach(file => {
      fd.append('files', file)
    })

    if (dialogMode.value === 'add') {
      await axios.post('/api/health-certs', fd)
      ElMessage.success('健康证添加成功')
    } else {
      await axios.put(`/api/health-certs/${editingId.value}`, fd)
      ElMessage.success('健康证更新成功')
    }

    dialogVisible.value = false
    fetchList()
  } catch {
    ElMessage.error('操作失败，请重试')
  } finally {
    submitting.value = false
  }
}

// ===== 删除 =====
const handleDelete = async (id) => {
  try {
    await request.delete(`/health-certs/${id}`, { data: { user_id: userId } })
    ElMessage.success('已删除')
    fetchList()
  } catch {
    // 错误已在拦截器处理
  }
}

// ===== 批量操作 =====
const onSelectionChange = (rows) => {
  selectedRows.value = rows
}

const handleExport = () => {
  window.open(`/api/health-certs/export?user_id=${userId}`, '_blank')
}

const handleBatchExport = () => {
  const ids = selectedRows.value.map(r => r.id).join(',')
  window.open(`/api/health-certs/export?user_id=${userId}&ids=${ids}`, '_blank')
}

const handleBatchDelete = async () => {
  const ids = selectedRows.value.map(r => r.id)
  try {
    await request.post('/health-certs/batch-delete', { user_id: userId, ids })
    ElMessage.success('批量删除成功')
    selectedRows.value = []
    fetchList()
  } catch {
    ElMessage.error('批量删除失败')
  }
}

// ===== 附件预览 =====
const previewVisible = ref(false)
const previewUrl = ref('')
const previewType = ref('')

const getFilePaths = (row) => {
  if (row.file_path && (!row.file_paths || row.file_paths === '[]')) return [row.file_path]
  if (!row.file_paths || row.file_paths === '[]') return []
  try { return JSON.parse(row.file_paths) } catch { return [] }
}

const getFileIcon = (fp) => {
  const ext = fp.split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼'
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  return '📎'
}

const handlePreview = (filePath) => {
  previewUrl.value = filePath
  const ext = filePath.split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) {
    previewType.value = 'image'
  } else if (ext === 'pdf') {
    previewType.value = 'pdf'
  } else {
    previewType.value = 'other'
  }
  if (previewType.value === 'image' || previewType.value === 'pdf') {
    previewVisible.value = true
  } else {
    downloadFile(filePath)
  }
}

const downloadFile = (filePath) => {
  window.open(filePath, '_blank')
}
</script>

<style scoped>
/* ===== 统计卡片 ===== */
.stats-row {
  margin-bottom: 16px;
}
.stat-card {
  text-align: center;
  padding: 20px 0;
  border-radius: 8px;
  cursor: pointer;
  transition: transform 0.2s, box-shadow 0.2s;
  color: #fff;
}
.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}
.stat-card.active {
  transform: scale(1.05);
  box-shadow: 0 4px 16px rgba(0, 0, 0, 0.25);
}
.stat-total {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}
.stat-normal {
  background: linear-gradient(135deg, #67c23a, #85ce61);
}
.stat-warning {
  background: linear-gradient(135deg, #e6a23c, #ebb563);
}
.stat-danger {
  background: linear-gradient(135deg, #f56c6c, #f89898);
}
.stat-number {
  font-size: 36px;
  font-weight: bold;
}
.stat-label {
  font-size: 14px;
  margin-top: 4px;
  opacity: 0.9;
}

/* ===== 工具栏 ===== */
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar h2 {
  margin: 0;
  color: #303133;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.upload-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}
.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
