<template>
  <div class="page-container">
    <!-- 顶部操作栏 -->
    <div class="toolbar">
      <h2>标签审核管理</h2>
      <div class="toolbar-right">
        <el-button @click="openRulesDialog">查看审核规则</el-button>
        <el-button type="primary" @click="openUploadDialog">上传新标签</el-button>
      </div>
    </div>

    <!-- 标签列表表格 -->
    <el-card>
      <el-table :data="pagedList" border stripe v-loading="loading">
        <!-- 缩略图列 -->
        <el-table-column label="标签图片" width="100">
          <template #default="{ row }">
            <el-image
              v-if="row.file_url"
              :src="row.file_url"
              style="width:60px; height:60px; border-radius:4px; cursor:pointer"
              fit="cover"
              @click="previewImage(row.file_url)"
            />
            <span v-else style="color:#c0c4cc">无图片</span>
          </template>
        </el-table-column>
        <el-table-column prop="product_name" label="产品名称" min-width="150" />
        <el-table-column prop="category" label="食品分类" width="120" />
        <el-table-column prop="version" label="版本" width="70" align="center">
          <template #default="{ row }">
            <el-tag size="small" type="info">v{{ row.version || 1 }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="上传时间" width="180" />
        <!-- 状态列 -->
        <el-table-column label="审核状态" width="120">
          <template #default="{ row }">
            <el-tag v-if="row.status === 'pending'" type="info">待审核</el-tag>
            <el-tag v-else-if="row.status === 'reviewed'">已审核</el-tag>
            <el-tag v-else-if="row.status === 'pass'" type="success">通过</el-tag>
            <el-tag v-else-if="row.status === 'failed'" type="danger">不通过</el-tag>
            <el-tag v-else type="info">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <!-- 操作列 -->
        <el-table-column label="操作" width="300">
          <template #default="{ row }">
            <el-button
              v-if="row.status === 'pending'"
              type="primary"
              size="small"
              :loading="auditingId === row.id"
              @click="handleAudit(row.id)"
            >开始审核</el-button>
            <el-button
              v-if="row.status === 'pass' || row.status === 'failed'"
              type="success"
              size="small"
              @click="handleDownload(row)"
            >下载报告</el-button>
            <el-button type="warning" size="small" @click="openHistory(row)">历史</el-button>
            <el-popconfirm title="确定删除该标签？" @confirm="handleDelete(row.id)">
              <template #reference>
                <el-button type="danger" size="small">删除</el-button>
              </template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && list.length === 0" description="暂无标签记录" />
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

    <!-- ===== 上传标签弹窗 ===== -->
    <el-dialog v-model="dialogVisible" title="上传新标签" width="520px">
      <el-form :model="form" label-width="100px">
        <el-form-item label="产品名称">
          <el-input v-model="form.product_name" placeholder="如：橙汁饮料" />
        </el-form-item>
        <el-form-item label="食品分类">
          <el-select v-model="form.category" placeholder="请选择食品分类" style="width:100%">
            <el-option v-for="cat in categories" :key="cat" :label="cat" :value="cat" />
          </el-select>
        </el-form-item>
        <el-form-item label="标签图片">
          <!-- 拖拽上传，限制图片格式 -->
          <el-upload
            ref="uploadRef"
            class="label-upload"
            drag
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            accept="image/*"
            list-type="picture"
          >
            <el-icon size="40"><UploadFilled /></el-icon>
            <div class="upload-text">将标签图片拖到此处，或点击选择</div>
            <template #tip>
              <div class="upload-tip">支持 jpg/png 格式，大小不超过 5MB</div>
            </template>
          </el-upload>
        </el-form-item>
      </el-form>

      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="handleUpload" :loading="submitting">上传</el-button>
      </template>
    </el-dialog>

    <!-- 图片预览弹窗 -->
    <el-dialog v-model="previewVisible" title="标签预览" width="600px">
      <img :src="previewUrl" style="width:100%" alt="标签图片" />
    </el-dialog>

    <!-- 审核规则弹窗 -->
    <el-dialog v-model="rulesVisible" title="GB 7718 审核规则" width="700px">
      <el-table :data="rules" border stripe>
        <el-table-column prop="rule_code" label="编号" width="80" />
        <el-table-column prop="rule_name" label="规则名称" width="180" />
        <el-table-column prop="rule_desc" label="规则描述" min-width="300" />
        <el-table-column prop="check_type" label="检测方式" width="100" />
      </el-table>
    </el-dialog>

    <!-- 历史版本侧边栏（使用 Dialog 模拟） -->
    <el-dialog v-model="historyVisible" :title="'历史版本 - ' + historyProduct" width="800px">
      <el-timeline v-if="historyList.length > 0">
        <el-timeline-item
          v-for="item in historyList"
          :key="item.id"
          :timestamp="item.created_at"
          placement="top"
          :color="item.id === historyCurrentId ? '#409eff' : '#c0c4cc'"
        >
          <el-card shadow="hover">
            <div class="history-row">
              <div class="history-info">
                <el-tag size="small" :type="item.id === historyCurrentId ? '' : 'info'">
                  v{{ item.version || 1 }}{{ item.id === historyCurrentId ? ' (当前)' : '' }}
                </el-tag>
                <span style="margin-left:10px">分类：{{ item.category }}</span>
                <el-tag size="small" style="margin-left:10px" :type="statusType(item.status)">
                  {{ statusLabel(item.status) }}
                </el-tag>
              </div>
              <div class="history-actions">
                <el-button
                  v-if="item.file_url"
                  size="small"
                  @click="previewImage(item.file_url)"
                >查看图片</el-button>
                <el-button
                  v-if="item.status === 'pass' || item.status === 'failed'"
                  size="small"
                  type="success"
                  @click="downloadHistoryReport(item.id)"
                >下载报告</el-button>
              </div>
            </div>
          </el-card>
        </el-timeline-item>
      </el-timeline>
      <el-empty v-else description="暂无历史版本" />
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import { UploadFilled } from '@element-plus/icons-vue'
import request from '../utils/request'
import { compressImage } from '../utils/compress'
import axios from 'axios'

// 当前用户
const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

// 食品分类选项
const categories = ['饮料', '糕点', '乳制品', '肉制品', '调味品', '零食', '方便食品', '冷冻食品', '粮油', '其他']

// 列表
const list = ref([])
const loading = ref(false)
const currentPage = ref(1)
const pageSize = ref(10)

// 分页后的列表
const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const fetchList = async () => {
  loading.value = true
  try {
    const res = await request.get('/labels', { params: { user_id: userId } })
    list.value = res.list
  } catch {
    // 拦截器处理
  } finally {
    loading.value = false
  }
}

onMounted(fetchList)

// ===== 上传标签 =====
const dialogVisible = ref(false)
const uploadRef = ref(null)
const selectedFile = ref(null)
const submitting = ref(false)

const form = reactive({
  product_name: '',
  category: ''
})

const openUploadDialog = () => {
  form.product_name = ''
  form.category = ''
  selectedFile.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const handleFileChange = async (file) => {
  selectedFile.value = await compressImage(file.raw)
}

const handleFileRemove = () => {
  selectedFile.value = null
}

const handleUpload = async () => {
  if (!form.product_name || !form.category) {
    ElMessage.warning('请填写产品名称和食品分类')
    return
  }
  if (!selectedFile.value) {
    ElMessage.warning('请上传标签图片')
    return
  }

  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('user_id', userId)
    fd.append('product_name', form.product_name)
    fd.append('category', form.category)
    fd.append('file', selectedFile.value)

    await axios.post('/api/labels', fd)
    ElMessage.success('标签上传成功')
    dialogVisible.value = false
    fetchList()
  } catch {
    ElMessage.error('上传失败，请重试')
  } finally {
    submitting.value = false
  }
}

// ===== 审核 =====
const auditingId = ref(null)

const handleAudit = async (id) => {
  auditingId.value = id
  try {
    const res = await axios.post(`/api/labels/${id}/audit`, { user_id: userId })
    ElMessage.success(res.data.message)
    fetchList()
  } catch {
    ElMessage.error('审核失败，请重试')
  } finally {
    auditingId.value = null
  }
}

// ===== 下载报告 =====
const handleDownload = (row) => {
  window.open(`/api/labels/${row.id}/report?user_id=${userId}`, '_blank')
  ElMessage.success('正在生成审核报告...')
}

// ===== 删除 =====
const handleDelete = async (id) => {
  try {
    await request.delete(`/labels/${id}`, { data: { user_id: userId } })
    ElMessage.success('标签已删除')
    fetchList()
  } catch {
    // 拦截器处理
  }
}

// ===== 审核规则 =====
const rulesVisible = ref(false)
const rules = ref([])

const openRulesDialog = async () => {
  try {
    const res = await request.get('/rules')
    rules.value = res.list
    rulesVisible.value = true
  } catch {
    // 拦截器处理
  }
}

// ===== 图片预览 =====
const previewVisible = ref(false)
const previewUrl = ref('')

const previewImage = (filePath) => {
  previewUrl.value = filePath
  previewVisible.value = true
}

// ===== 历史版本 =====
const historyVisible = ref(false)
const historyList = ref([])
const historyProduct = ref('')
const historyCurrentId = ref(null)

const openHistory = async (row) => {
  try {
    const res = await request.get(`/labels/${row.id}/history`, { params: { user_id: userId } })
    historyList.value = res.list
    historyProduct.value = row.product_name
    historyCurrentId.value = row.id
    historyVisible.value = true
  } catch {
    // 拦截器处理
  }
}

// 历史版本中下载报告
const downloadHistoryReport = (labelId) => {
  window.open(`/api/labels/${labelId}/report?user_id=${userId}`, '_blank')
  ElMessage.success('正在生成审核报告...')
}

const statusType = (status) => {
  const map = { pending: 'info', reviewed: '', pass: 'success', failed: 'danger' }
  return map[status] || 'info'
}

const statusLabel = (status) => {
  const map = { pending: '待审核', reviewed: '已审核', pass: '通过', failed: '不通过' }
  return map[status] || status
}
</script>

<style scoped>
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

.label-upload {
  width: 100%;
}
.label-upload :deep(.el-upload-dragger) {
  width: 100%;
}
.upload-text {
  color: #606266;
  font-size: 14px;
  margin-top: 8px;
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
