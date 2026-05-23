<template>
  <div class="page-container">
    <!-- ===== Tab 切换：自有资质 / 供应商资质 ===== -->
    <el-tabs v-model="category" @tab-change="onTabChange" class="category-tabs">
      <el-tab-pane label="自有资质" name="own" />
      <el-tab-pane label="供应商资质" name="supplier" />
    </el-tabs>

    <!-- ===== 统计卡片 ===== -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="8">
        <div
          class="stat-card stat-normal"
          :class="{ active: filterStatus === 'valid' }"
          @click="toggleFilter('valid')"
        >
          <div class="stat-number">{{ stats.valid }}</div>
          <div class="stat-label">正常</div>
        </div>
      </el-col>
      <el-col :span="8">
        <div
          class="stat-card stat-warning"
          :class="{ active: filterStatus === 'expiring_soon' }"
          @click="toggleFilter('expiring_soon')"
        >
          <div class="stat-number">{{ stats.expiringSoon }}</div>
          <div class="stat-label">临期 ≤30天</div>
        </div>
      </el-col>
      <el-col :span="8">
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

    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <h2>
        {{ category === 'own' ? '自有资质' : '供应商资质' }}
        <el-tag v-if="filterStatus" size="small" closable @close="filterStatus = ''" style="margin-left:10px">
          已筛选：{{ statusLabel(filterStatus) }}
        </el-tag>
      </h2>
      <div class="toolbar-right">
        <template v-if="selectedRows.length > 0">
          <span style="color:#606266;margin-right:8px">已选 {{ selectedRows.length }} 项</span>
          <el-button type="warning" @click="handleBatchExport">批量导出</el-button>
          <el-popconfirm title="确定要删除选中的证照吗？" @confirm="handleBatchDelete">
            <template #reference>
              <el-button type="danger">批量删除</el-button>
            </template>
          </el-popconfirm>
        </template>
        <el-input
          v-model="keyword"
          placeholder="搜索公司/证照/产品..."
          clearable
          style="width: 240px; margin-right: 10px"
          @input="currentPage = 1; fetchList()"
        />
        <el-button type="success" @click="handleExport">导出 Excel</el-button>
        <el-button type="primary" @click="openAddDialog">添加证照</el-button>
      </div>
    </div>

    <!-- 证照列表表格 -->
    <el-card>
      <el-table :data="pagedList" border stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="40" />
        <el-table-column prop="company_name" label="公司名称" min-width="160" />
        <el-table-column prop="product_name" label="产品名称" min-width="120">
          <template #default="{ row }">
            {{ row.product_name || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="name" label="证照名称" min-width="140" />
        <el-table-column label="到期时间" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.is_permanent" type="info" size="small">长期</el-tag>
            <span v-else>{{ row.expiry_date }}</span>
          </template>
        </el-table-column>
        <el-table-column label="状态" width="130">
          <template #default="{ row }">
            <template v-if="row.is_permanent">
              <el-tag type="success">正常</el-tag>
            </template>
            <template v-else>
              <el-tag v-if="row.status === 'valid'" type="success">正常 · 剩{{ getDaysLeft(row.expiry_date) }}天</el-tag>
              <el-tag v-else-if="row.status === 'expiring_soon'" type="warning">临期 · 剩{{ getDaysLeft(row.expiry_date) }}天</el-tag>
              <el-tag v-else type="danger">已过期 · 超{{ -getDaysLeft(row.expiry_date) }}天</el-tag>
            </template>
          </template>
        </el-table-column>
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
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{ row }">
            <el-button type="primary" size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-popconfirm title="确定要删除该证照吗？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length === 0" description="暂无证照记录" />
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

    <!-- ===== 添加/编辑证照弹窗 ===== -->
    <el-dialog v-model="dialogVisible" :title="dialogMode === 'add' ? '添加证照' : '编辑证照'" width="560px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="资质分类">
          <el-radio-group v-model="form.category">
            <el-radio value="own">自有资质</el-radio>
            <el-radio value="supplier">供应商资质</el-radio>
          </el-radio-group>
        </el-form-item>
        <el-form-item label="公司名称">
          <el-input v-model="form.company_name" :placeholder="form.category === 'own' ? '请输入本公司名称' : '请输入供应商公司名称'" />
        </el-form-item>
        <el-form-item label="产品名称">
          <el-input v-model="form.product_name" placeholder="请输入产品名称" />
        </el-form-item>
        <el-form-item label="证照名称">
          <el-input v-model="form.name" placeholder="如：营业执照、检测报告" />
        </el-form-item>
        <el-form-item label="到期时间">
          <div style="display:flex;align-items:center;gap:8px;width:100%">
            <el-date-picker
              v-model="form.expiry_date"
              type="date"
              placeholder="选择到期日期"
              value-format="YYYY-MM-DD"
              :disabled="form.is_permanent"
              style="flex:1"
            />
            <el-checkbox v-model="form.is_permanent">长期有效</el-checkbox>
          </div>
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
              <div class="upload-tip">支持 jpg/png/gif/pdf/doc/docx，单个 ≤ 10MB</div>
            </template>
          </el-upload>
          <div v-if="dialogMode === 'edit' && existingFiles.length > 0" class="existing-files">
            <div class="existing-title">已有附件：</div>
            <el-tag
              v-for="(fp, idx) in existingFiles"
              :key="idx"
              closable
              @close="removeExistingFile(idx)"
              style="margin-right: 6px; margin-bottom: 4px"
            >
              文件{{ idx + 1 }}
            </el-tag>
          </div>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">
          {{ dialogMode === 'add' ? '确定添加' : '保存修改' }}
        </el-button>
      </template>
    </el-dialog>

    <!-- 附件预览弹窗 -->
    <el-dialog v-model="previewVisible" title="附件预览" width="700px">
      <img v-if="previewType === 'image'" :src="previewUrl" style="width:100%" alt="证照图片" />
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

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

const list = ref([])
const loading = ref(false)
const submitting = ref(false)

const currentPage = ref(1)
const pageSize = ref(10)
const filterStatus = ref('')
const category = ref('own')
const keyword = ref('')
const selectedRows = ref([])

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

const stats = computed(() => {
  const filtered = list.value.filter(r => filterStatus.value ? r.status === filterStatus.value : true)
  return {
    valid: filtered.filter(r => r.status === 'valid').length,
    expiringSoon: filtered.filter(r => r.status === 'expiring_soon').length,
    expired: filtered.filter(r => r.status === 'expired').length
  }
})

const filteredList = computed(() => {
  if (!filterStatus.value) return list.value
  return list.value.filter(r => r.status === filterStatus.value)
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

const getFilePaths = (row) => {
  if (row.file_path && !row.file_paths) return [row.file_path]
  if (!row.file_paths || row.file_paths === '[]') return []
  try {
    return JSON.parse(row.file_paths)
  } catch {
    return []
  }
}

const getFileIcon = (fp) => {
  const ext = fp.split('.').pop().toLowerCase()
  if (['jpg', 'jpeg', 'png', 'gif'].includes(ext)) return '🖼'
  if (ext === 'pdf') return '📄'
  if (['doc', 'docx'].includes(ext)) return '📝'
  return '📎'
}

const fetchList = async () => {
  loading.value = true
  try {
    const params = { user_id: userId, category: category.value }
    if (keyword.value) params.keyword = keyword.value
    const res = await request.get('/certificates', { params })
    list.value = res.list
  } catch {
  } finally {
    loading.value = false
  }
}

const route = useRoute()

onMounted(() => {
  fetchList()
  if (route.query.action === 'add') openAddDialog()
})

const onTabChange = () => {
  filterStatus.value = ''
  keyword.value = ''
  currentPage.value = 1
  fetchList()
}

// ===== 导出 Excel =====
const handleExport = () => {
  window.open(`/api/certificates/export?user_id=${userId}`, '_blank')
}

const onSelectionChange = (rows) => {
  selectedRows.value = rows
}

const handleBatchExport = () => {
  const ids = selectedRows.value.map(r => r.id).join(',')
  window.open(`/api/certificates/export?user_id=${userId}&ids=${ids}`, '_blank')
}

const handleBatchDelete = async () => {
  const ids = selectedRows.value.map(r => r.id)
  try {
    await request.post('/certificates/batch-delete', { user_id: userId, ids })
    ElMessage.success('批量删除成功')
    selectedRows.value = []
    fetchList()
  } catch {
    ElMessage.error('批量删除失败')
  }
}

// ===== 添加/编辑证照 =====
const dialogVisible = ref(false)
const dialogMode = ref('add')
const editingId = ref(null)
const uploadRef = ref(null)
const selectedFiles = ref([])
const existingFiles = ref([])

const form = reactive({
  category: 'own',
  company_name: '',
  product_name: '',
  name: '',
  expiry_date: '',
  is_permanent: false
})

const resetForm = () => {
  form.category = 'own'
  form.company_name = ''
  form.product_name = ''
  form.name = ''
  form.expiry_date = ''
  form.is_permanent = false
  selectedFiles.value = []
  existingFiles.value = []
  if (uploadRef.value) uploadRef.value.clearFiles()
}

const openAddDialog = () => {
  dialogMode.value = 'add'
  editingId.value = null
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogMode.value = 'edit'
  editingId.value = row.id
  form.category = row.category || 'own'
  form.company_name = row.company_name || ''
  form.product_name = row.product_name || ''
  form.name = row.name
  form.expiry_date = row.is_permanent ? '' : row.expiry_date
  form.is_permanent = !!row.is_permanent
  selectedFiles.value = []
  existingFiles.value = getFilePaths(row)
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
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

const removeExistingFile = (idx) => {
  existingFiles.value.splice(idx, 1)
}

const handleSubmit = async () => {
  if (!form.company_name || !form.name) {
    ElMessage.warning('请填写公司名称和证照名称')
    return
  }
  if (!form.is_permanent && !form.expiry_date) {
    ElMessage.warning('请填写到期时间或选择长期有效')
    return
  }

  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('user_id', userId)
    fd.append('category', form.category)
    fd.append('company_name', form.company_name)
    fd.append('product_name', form.product_name)
    fd.append('name', form.name)
    fd.append('expiry_date', form.expiry_date)
    fd.append('is_permanent', form.is_permanent)

    if (dialogMode.value === 'edit') {
      fd.append('existing_files', JSON.stringify(existingFiles.value))
    }

    selectedFiles.value.forEach(file => {
      fd.append('files', file)
    })

    if (dialogMode.value === 'add') {
      await axios.post('/api/certificates', fd)
      ElMessage.success('证照添加成功')
    } else {
      await axios.put(`/api/certificates/${editingId.value}`, fd)
      ElMessage.success('证照更新成功')
    }
    dialogVisible.value = false
    fetchList()
  } catch {
    ElMessage.error('操作失败，请重试')
  } finally {
    submitting.value = false
  }
}

// ===== 删除证照 =====
const handleDelete = async (id) => {
  try {
    await request.delete(`/certificates/${id}`, {
      data: { user_id: userId }
    })
    ElMessage.success('证照已删除')
    fetchList()
  } catch {}
}

// ===== 附件预览 =====
const previewVisible = ref(false)
const previewUrl = ref('')
const previewType = ref('')

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
.category-tabs {
  margin-bottom: 4px;
}
.category-tabs :deep(.el-tabs__header) {
  margin-bottom: 0;
}

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

.file-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.existing-files {
  margin-top: 8px;
}
.existing-title {
  font-size: 12px;
  color: #909399;
  margin-bottom: 4px;
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

@media (max-width: 768px) {
  .stats-row .el-col {
    margin-bottom: 12px;
  }
}
</style>
