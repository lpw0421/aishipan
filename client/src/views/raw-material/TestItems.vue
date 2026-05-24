<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>检验项目管理</h2>
      <el-button type="primary" @click="openAdd">新增项目</el-button>
    </div>

    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索项目名称/编号/方法" style="width:260px" clearable @change="fetchList" />
      <el-select v-model="filterStatus" placeholder="方法状态" style="width:150px" clearable @change="fetchList">
        <el-option label="现行有效" value="现行有效" /><el-option label="即将废止" value="即将废止" /><el-option label="已废止" value="已废止" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="item_number" label="项目编号" width="100" />
        <el-table-column prop="item_name" label="检验项目" min-width="120" />
        <el-table-column prop="test_method" label="检验方法" width="120" />
        <el-table-column prop="method_name" label="方法名称" min-width="200" />
        <el-table-column prop="detection_limit" label="检出限" width="100" />
        <el-table-column prop="applicable_scope" label="适用范围" min-width="140" />
        <el-table-column prop="equipment" label="仪器设备" min-width="140" />
        <el-table-column prop="method_status" label="方法状态" width="110">
          <template #default="{row}">
            <el-tag :type="row.method_status==='现行有效'?'success':row.method_status==='即将废止'?'warning':'info'" size="small">{{ row.method_status }}</el-tag>
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
    <el-dialog :title="editingId ? '编辑项目' : '新增项目'" v-model="showForm" width="550px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="检验项目"><el-input v-model="form.item_name" /></el-form-item>
        <el-form-item label="检验方法"><el-input v-model="form.test_method" placeholder="如 GB 5009.3" /></el-form-item>
        <el-form-item label="方法名称"><el-input v-model="form.method_name" /></el-form-item>
        <el-form-item label="检出限"><el-input v-model="form.detection_limit" /></el-form-item>
        <el-form-item label="适用范围"><el-input v-model="form.applicable_scope" placeholder="适用哪些原料/产品" /></el-form-item>
        <el-form-item label="仪器设备"><el-input v-model="form.equipment" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="方法状态"><el-select v-model="form.method_status" style="width:100%"><el-option label="现行有效" value="现行有效" /><el-option label="即将废止" value="即将废止" /><el-option label="已废止" value="已废止" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="替代方法"><el-input v-model="form.replacement_method" placeholder="新标准编号" /></el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
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
const filterStatus = ref('')
const showForm = ref(false)
const editingId = ref(null)

const form = reactive({
  item_name: '', test_method: '', method_name: '', detection_limit: '',
  applicable_scope: '', equipment: '', method_status: '现行有效', replacement_method: ''
})

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterStatus.value) params.method_status = filterStatus.value
    const { data } = await axios.get('/api/test-items', { params })
    list.value = data.list
  } finally { loading.value = false }
}

function openAdd() { editingId.value = null; resetForm(); showForm.value = true }

function editRow(row) {
  editingId.value = row.id
  Object.assign(form, {
    item_name: row.item_name, test_method: row.test_method, method_name: row.method_name,
    detection_limit: row.detection_limit, applicable_scope: row.applicable_scope,
    equipment: row.equipment, method_status: row.method_status, replacement_method: row.replacement_method
  })
  showForm.value = true
}

async function deleteRow(row) {
  await ElMessageBox.confirm('确定删除吗？', '提示', { type: 'warning' })
  await axios.delete(`/api/test-items/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
}

async function save() {
  if (!form.item_name) return ElMessage.warning('请填写检验项目')
  if (editingId.value) {
    await axios.put(`/api/test-items/${editingId.value}`, { user_id: user.id, ...form })
    ElMessage.success('更新成功')
  } else {
    await axios.post('/api/test-items', { user_id: user.id, ...form })
    ElMessage.success('添加成功')
  }
  showForm.value = false
  fetchList()
}

function resetForm() {
  Object.assign(form, {
    item_name: '', test_method: '', method_name: '', detection_limit: '',
    applicable_scope: '', equipment: '', method_status: '现行有效', replacement_method: ''
  })
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
