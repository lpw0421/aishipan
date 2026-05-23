<template>
  <div class="page-container">
    <!-- ===== 统计概览 ===== -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="12">
        <div class="stat-card stat-total">
          <div class="stat-number">{{ stats.total }}</div>
          <div class="stat-label">总人数</div>
        </div>
      </el-col>
      <el-col :span="12">
        <div class="stat-card stat-warning">
          <div class="stat-number" style="color: #f56c6c">{{ stats.expiringSoon }}</div>
          <div class="stat-label">即将过期</div>
        </div>
      </el-col>
    </el-row>

    <!-- 搜索栏 -->
    <div class="toolbar">
      <h2>员工健康证管理</h2>
      <div class="toolbar-right">
        <el-input
          v-model="keyword"
          placeholder="搜索员工姓名..."
          clearable
          style="width: 220px; margin-right: 10px"
          @input="currentPage = 1; fetchList()"
        />
        <el-button type="primary" @click="openAddDialog">添加健康证</el-button>
      </div>
    </div>

    <!-- 列表表格 -->
    <el-card>
      <el-table :data="pagedList" border stripe v-loading="loading">
        <el-table-column prop="employee_name" label="员工姓名" min-width="120" />
        <el-table-column prop="id_number" label="身份证号" width="200">
          <template #default="{ row }">
            {{ row.id_number || '-' }}
          </template>
        </el-table-column>
        <el-table-column prop="issue_date" label="发证日期" width="130" />
        <el-table-column prop="expiry_date" label="到期日期" width="130" />
        <!-- 状态列 -->
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'valid'" type="success">正常</el-tag>
            <el-tag v-else-if="row.status === 'expiring_soon'" type="warning">临期</el-tag>
            <el-tag v-else type="danger">已过期</el-tag>
          </template>
        </el-table-column>
        <!-- 附件列 -->
        <el-table-column label="附件" width="80">
          <template #default="{ row }">
            <el-button v-if="row.file_path" type="primary" link @click="previewImage(row.file_path)">查看</el-button>
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

      <el-empty v-if="!loading && list.length === 0" description="暂无健康证记录" />
      <div v-if="list.length > 10" class="pagination-wrap">
        <el-pagination
          v-model:current-page="currentPage"
          :page-size="pageSize"
          :pager-count="5"
          layout="prev, pager, next, total"
          :total="list.length"
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
        <el-form-item label="身份证号">
          <el-input v-model="form.id_number" placeholder="选填" />
        </el-form-item>
        <el-form-item label="发证日期">
          <el-date-picker
            v-model="form.issue_date"
            type="date"
            placeholder="选择发证日期"
            value-format="YYYY-MM-DD"
            style="width:100%"
          />
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
        <el-form-item label="健康证图片">
          <el-upload
            ref="uploadRef"
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            accept="image/*"
            list-type="picture"
          >
            <el-button type="primary">选择图片</el-button>
            <template #tip>
              <div class="upload-tip">支持 jpg/png 格式</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览弹窗 -->
    <el-dialog v-model="previewVisible" title="证照预览" width="600px">
      <img :src="previewUrl" style="width:100%" alt="健康证图片" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../utils/request'
import { compressImage } from '../utils/compress'
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

// 统计数据
const stats = computed(() => {
  const total = list.value.length
  const expiringSoon = list.value.filter(r => r.status === 'expiring_soon').length
  return { total, expiringSoon }
})

// 分页后的列表
const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
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
const selectedFile = ref(null)
const submitting = ref(false)

const dialogTitle = computed(() => dialogMode.value === 'add' ? '添加健康证' : '编辑健康证')

const form = reactive({
  employee_name: '',
  id_number: '',
  issue_date: '',
  expiry_date: ''
})

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
  form.id_number = row.id_number || ''
  form.issue_date = row.issue_date
  form.expiry_date = row.expiry_date
  selectedFile.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

// 重置表单
const resetForm = () => {
  form.employee_name = ''
  form.id_number = ''
  form.issue_date = ''
  form.expiry_date = ''
  selectedFile.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
}

const handleFileChange = async (file) => {
  selectedFile.value = await compressImage(file.raw)
}

const handleFileRemove = () => {
  selectedFile.value = null
}

// 提交（新增或编辑）
const handleSubmit = async () => {
  if (!form.employee_name || !form.issue_date || !form.expiry_date) {
    ElMessage.warning('请填写员工姓名、发证日期和到期日期')
    return
  }

  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('user_id', userId)
    fd.append('employee_name', form.employee_name)
    fd.append('id_number', form.id_number || '')
    fd.append('issue_date', form.issue_date)
    fd.append('expiry_date', form.expiry_date)
    if (selectedFile.value) {
      fd.append('file', selectedFile.value)
    }

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

// ===== 图片预览 =====
const previewVisible = ref(false)
const previewUrl = ref('')

const previewImage = (filePath) => {
  previewUrl.value = filePath  // 通过 Vite 代理访问 /uploads
  previewVisible.value = true
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
  color: #fff;
}
.stat-total {
  background: linear-gradient(135deg, #409eff, #66b1ff);
}
.stat-warning {
  background: linear-gradient(135deg, #e6a23c, #ebb563);
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
