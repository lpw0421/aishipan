<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>法规库</h2>
      <div class="toolbar-right">
        <el-input
          v-model="keyword"
          placeholder="搜索法规名称/标准号/内容..."
          clearable
          style="width: 320px; margin-right: 10px"
          @input="currentPage = 1"
        />
        <el-button type="primary" @click="openAddDialog">添加法规</el-button>
      </div>
    </div>

    <el-card>
      <!-- 法规列表 -->
      <el-table :data="pagedList" stripe v-loading="loading" highlight-current-row
        @row-click="showDetail" row-class-name="reg-row">
        <el-table-column label="法规名称" min-width="280">
          <template #default="{ row }">
            <div class="reg-title-cell">
              <span class="reg-title">{{ row.full_title }}</span>
              <span v-if="row.number" class="reg-number">{{ row.number }}</span>
            </div>
          </template>
        </el-table-column>
        <el-table-column label="分类" width="100">
          <template #default="{ row }">
            <el-tag :type="categoryType(row.category)" size="small">{{ categoryLabel(row.category) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="生效日期" width="120">
          <template #default="{ row }">
            {{ row.effective_date || '-' }}
          </template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{ row }">
            <el-tag v-if="row.repeal_date" type="info" size="small">已废止</el-tag>
            <el-tag v-else-if="isUpcoming(row)" type="warning" size="small">即将生效</el-tag>
            <el-tag v-else type="success" size="small">现行有效</el-tag>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && filteredList.length === 0" description="未找到匹配的法规" />
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

    <!-- 法规详情弹窗 -->
    <el-dialog v-model="dialogVisible" :title="detail.full_title" width="650px">
      <div class="detail-info">
        <el-tag :type="categoryType(detail.category)" size="small">{{ categoryLabel(detail.category) }}</el-tag>
        <span v-if="detail.number" class="detail-number">{{ detail.number }}</span>
        <span class="detail-date">生效日期：{{ detail.effective_date || '-' }}</span>
        <span v-if="detail.repeal_date" class="detail-date" style="color:#f56c6c">废止日期：{{ detail.repeal_date }}</span>
        <el-tag v-if="detail.repeal_date" type="info" size="small" style="margin-left:8px">已废止</el-tag>
        <el-tag v-else-if="isUpcoming(detail)" type="warning" size="small" style="margin-left:8px">即将生效</el-tag>
        <el-tag v-else type="success" size="small" style="margin-left:8px">现行有效</el-tag>
      </div>
      <el-divider />
      <div class="detail-content">{{ detail.content }}</div>
      <div v-if="detail.url || detail.file_path" class="detail-actions">
        <el-button v-if="detail.file_path" type="primary" @click="downloadFile(detail.file_path)">
          <el-icon style="margin-right:4px"><Download /></el-icon>下载附件
        </el-button>
        <el-button v-if="detail.url" type="success" @click="openUrl(detail.url)">
          <el-icon style="margin-right:4px"><Link /></el-icon>查看官方原文
        </el-button>
      </div>
      <div v-if="!detail.url && !detail.file_path" class="detail-no-file">
        暂无附件或链接
      </div>
    </el-dialog>

    <!-- 添加法规弹窗 -->
    <el-dialog v-model="addVisible" title="添加法规" width="600px">
      <el-form :model="form" label-width="90px">
        <el-form-item label="法规名称">
          <el-input v-model="form.title" placeholder="简称，如：食品安全法" />
        </el-form-item>
        <el-form-item label="完整名称">
          <el-input v-model="form.full_title" placeholder="全称，如：中华人民共和国食品安全法" />
        </el-form-item>
        <el-form-item label="分类">
          <el-select v-model="form.category" style="width:100%">
            <el-option label="法律" value="law" />
            <el-option label="国家标准" value="standard" />
            <el-option label="行业规范" value="industry" />
            <el-option label="企业制度" value="company" />
          </el-select>
        </el-form-item>
        <el-form-item label="标准号">
          <el-input v-model="form.number" placeholder="如：GB 7718-2025" />
        </el-form-item>
        <el-form-item label="生效日期">
          <el-date-picker v-model="form.effective_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="选择生效日期" />
        </el-form-item>
        <el-form-item label="废止日期">
          <el-date-picker v-model="form.repeal_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="选填，已废止的法规填写" />
        </el-form-item>
        <el-form-item label="主要内容">
          <el-input v-model="form.content" type="textarea" :rows="4" placeholder="法规主要内容摘要" />
        </el-form-item>
        <el-form-item label="官方链接">
          <el-input v-model="form.url" placeholder="官方原文链接（选填）" />
        </el-form-item>
        <el-form-item label="上传附件">
          <el-upload
            ref="uploadRef"
            drag
            :auto-upload="false"
            :limit="1"
            :on-change="handleFileChange"
            :on-remove="handleFileRemove"
            accept=".pdf,.doc,.docx"
            list-type="text"
          >
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
            <template #tip><div class="upload-tip">支持 PDF/Word 格式</div></template>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="addVisible = false">取消</el-button>
        <el-button type="primary" @click="handleAdd" :loading="submitting">确定添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, watch, onMounted } from 'vue'
import { Download, Link } from '@element-plus/icons-vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../utils/request'
import axios from 'axios'

const route = useRoute()

const list = ref([])
const loading = ref(false)
const urlCategory = computed(() => {
  if (route.path.includes('/regulations/industry')) return 'industry'
  if (route.path.includes('/regulations/company')) return 'company'
  return 'national'
})
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const categoryLabel = (cat) => ({ law: '法律', standard: '国家标准', industry: '行业规范', company: '企业制度' }[cat] || cat)
const categoryType = (cat) => ({ law: 'primary', standard: 'warning', industry: '', company: 'success' }[cat] || 'info')

const isUpcoming = (row) => {
  if (!row.effective_date) return false
  return new Date(row.effective_date) > new Date()
}

const filteredList = computed(() => {
  let result = list.value
  if (urlCategory.value === 'national') {
    result = result.filter(r => r.category === 'law' || r.category === 'standard')
  } else {
    result = result.filter(r => r.category === urlCategory.value)
  }
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r =>
      r.title.includes(kw) || r.full_title.includes(kw) || r.content.includes(kw) || r.number.includes(kw)
    )
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
    const res = await request.get('/regulations')
    list.value = res.list
  } catch {} finally {
    loading.value = false
  }
}

onMounted(fetchList)

watch(() => route.path, () => {
  currentPage.value = 1
  fetchList()
})

// 详情弹窗
const dialogVisible = ref(false)
const detail = ref({})

const showDetail = (row) => {
  detail.value = row
  dialogVisible.value = true
}

const openUrl = (url) => {
  window.open(url, '_blank')
}

const downloadFile = (filePath) => {
  window.open(filePath, '_blank')
}

// ===== 添加法规 =====
const addVisible = ref(false)
const uploadRef = ref(null)
const selectedFile = ref(null)
const submitting = ref(false)

const form = reactive({
  title: '',
  full_title: '',
  category: 'standard',
  number: '',
  effective_date: '',
  repeal_date: '',
  content: '',
  url: ''
})

const openAddDialog = () => {
  Object.assign(form, { title: '', full_title: '', category: 'standard', number: '', effective_date: '', repeal_date: '', content: '', url: '' })
  selectedFile.value = null
  if (uploadRef.value) uploadRef.value.clearFiles()
  addVisible.value = true
}

const handleFileChange = (file) => {
  selectedFile.value = file.raw
}

const handleFileRemove = () => {
  selectedFile.value = null
}

const handleAdd = async () => {
  if (!form.title || !form.full_title || !form.category) {
    ElMessage.warning('请填写法规名称和分类')
    return
  }
  submitting.value = true
  try {
    const fd = new FormData()
    fd.append('title', form.title)
    fd.append('full_title', form.full_title)
    fd.append('category', form.category)
    fd.append('number', form.number)
    fd.append('effective_date', form.effective_date)
    fd.append('repeal_date', form.repeal_date)
    fd.append('content', form.content)
    fd.append('url', form.url)
    if (selectedFile.value) {
      fd.append('file', selectedFile.value)
    }
    await axios.post('/api/regulations', fd)
    ElMessage.success('法规添加成功')
    addVisible.value = false
    fetchList()
  } catch {
    ElMessage.error('添加失败')
  } finally {
    submitting.value = false
  }
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
}

.upload-tip {
  color: #909399;
  font-size: 12px;
  margin-top: 4px;
}

.reg-row {
  cursor: pointer;
}
.reg-title-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.reg-title {
  font-size: 14px;
  color: #303133;
}
.reg-number {
  font-size: 12px;
  color: #909399;
}

.detail-info {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.detail-number {
  color: #909399;
  font-size: 13px;
}
.detail-date {
  color: #606266;
  font-size: 13px;
}
.detail-content {
  color: #303133;
  line-height: 1.9;
  font-size: 14px;
  white-space: pre-wrap;
}
.detail-actions {
  margin-top: 16px;
  display: flex;
  gap: 10px;
}
.detail-no-file {
  margin-top: 16px;
  color: #c0c4cc;
  font-size: 13px;
}

.pagination-wrap {
  display: flex;
  justify-content: center;
  margin-top: 16px;
}
</style>
