<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>标准变更管理</h2>
      <el-button type="primary" @click="showAdd = true">发起变更</el-button>
    </div>

    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索变更编号/内容" style="width:240px" clearable @change="fetchList" />
      <el-select v-model="filterType" placeholder="变更类型" style="width:130px" clearable @change="fetchList">
        <el-option label="新增" value="新增" /><el-option label="修订" value="修订" /><el-option label="废止" value="废止" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:120px" clearable @change="fetchList">
        <el-option label="草稿" value="草稿" /><el-option label="审批中" value="审批中" /><el-option label="已发布" value="已发布" /><el-option label="已归档" value="已归档" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="change_number" label="变更编号" width="140" />
        <el-table-column prop="change_type" label="变更类型" width="100">
          <template #default="{row}"><el-tag :type="row.change_type==='新增'?'success':row.change_type==='废止'?'danger':'warning'" size="small">{{ row.change_type }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="change_content" label="变更内容" min-width="250" show-overflow-tooltip />
        <el-table-column prop="impact_assessment" label="影响评估" min-width="200" show-overflow-tooltip />
        <el-table-column prop="approver" label="审批人" width="80" />
        <el-table-column prop="publish_date" label="发布日期" width="110" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status==='已发布'?'success':row.status==='已归档'?'info':row.status==='审批中'?'warning':''" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="editRow(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog :title="editingId ? '编辑变更' : '发起变更'" v-model="showAdd" width="600px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="变更类型"><el-select v-model="form.change_type" style="width:200px"><el-option label="新增" value="新增" /><el-option label="修订" value="修订" /><el-option label="废止" value="废止" /></el-select></el-form-item>
        <el-form-item label="变更内容"><el-input v-model="form.change_content" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="影响评估">
          <el-input v-model="form.impact_assessment" type="textarea" :rows="2" placeholder="评估关联原料、产品、标签、SOP等受影响的方面" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="8"><el-form-item label="审批人"><el-input v-model="form.approver" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="发布日期"><el-date-picker v-model="form.publish_date" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="8"><el-form-item label="状态"><el-select v-model="form.status" style="width:100%"><el-option label="草稿" value="草稿" /><el-option label="审批中" value="审批中" /><el-option label="已发布" value="已发布" /><el-option label="已归档" value="已归档" /></el-select></el-form-item></el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const list = ref([])
const loading = ref(false)
const keyword = ref('')
const filterType = ref('')
const filterStatus = ref('')
const showAdd = ref(false)
const editingId = ref(null)

const form = reactive({
  change_type: '修订', change_content: '', impact_assessment: '',
  approver: '', publish_date: '', status: '草稿'
})

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterType.value) params.change_type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/standard-changes', { params })
    list.value = data.list
  } finally { loading.value = false }
}

function editRow(row) {
  editingId.value = row.id
  Object.assign(form, {
    change_type: row.change_type, change_content: row.change_content,
    impact_assessment: row.impact_assessment, approver: row.approver,
    publish_date: row.publish_date, status: row.status
  })
  showAdd.value = true
}

async function deleteRow(row) {
  await ElMessageBox.confirm('确定删除吗？', '提示', { type: 'warning' })
  await axios.delete(`/api/standard-changes/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
}

async function save() {
  if (!form.change_content) return ElMessage.warning('请填写变更内容')
  if (editingId.value) {
    await axios.put(`/api/standard-changes/${editingId.value}`, { user_id: user.id, ...form })
    ElMessage.success('更新成功')
  } else {
    await axios.post('/api/standard-changes', { user_id: user.id, ...form })
    ElMessage.success('变更已发起')
  }
  showAdd.value = false
  resetForm()
  fetchList()
}

function resetForm() {
  editingId.value = null
  Object.assign(form, { change_type: '修订', change_content: '', impact_assessment: '', approver: '', publish_date: '', status: '草稿' })
}

onMounted(fetchList)
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.filter-card{margin-bottom:16px;display:flex;gap:12px;align-items:center}
.filter-card :deep(.el-card__body){display:flex;gap:12px;align-items:center;flex-wrap:wrap}
</style>
