<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>人员管理</h2>
      <el-button type="primary" @click="openAdd">新增人员</el-button>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num">{{ stats.total }}</div>
          <div class="stat-label">人员总数</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num" style="color:#67c23a">{{ stats.active }}</div>
          <div class="stat-label">在职</div>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="stat-card stat-info">
          <div class="stat-num info">{{ stats.deptCount }}</div>
          <div class="stat-label">部门数</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索姓名/编号/职位" style="width:220px" clearable @change="fetchList">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filterDepartment" placeholder="部门" style="width:140px" clearable @change="fetchList">
        <el-option v-for="d in stats.departments" :key="d" :label="d" :value="d" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:100px" clearable @change="fetchList">
        <el-option label="在职" value="在职" /><el-option label="离职" value="离职" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="employee_number" label="人员编号" width="100" />
        <el-table-column prop="name" label="姓名" width="80" />
        <el-table-column prop="department" label="部门" width="100">
          <template #default="{row}"><el-tag size="small" type="info">{{ row.department }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="position" label="职位" width="110" />
        <el-table-column prop="phone" label="电话" width="130" />
        <el-table-column prop="entry_date" label="入职日期" width="110" />
        <el-table-column prop="health_cert_expiry" label="健康证到期" width="120">
          <template #default="{row}">
            <el-tag v-if="row.health_cert_expiry" :type="new Date(row.health_cert_expiry) < new Date() ? 'danger' : 'success'" size="small">
              {{ row.health_cert_expiry }}
            </el-tag>
            <span v-else class="text-muted">未登记</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='在职'?'success':'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="editRow(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无人员信息" />
    </el-card>

    <el-dialog :title="editingId ? '编辑人员' : '新增人员'" v-model="showForm" width="550px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="部门"><el-input v-model="form.department" placeholder="如：品控部" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="职位"><el-input v-model="form.position" placeholder="如：质检员" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="入职日期"><el-date-picker v-model="form.entry_date" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="健康证到期"><el-date-picker v-model="form.health_cert_expiry" type="date" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item v-if="editingId" label="状态"><el-radio-group v-model="form.status"><el-radio value="在职">在职</el-radio><el-radio value="离职">离职</el-radio></el-radio-group></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remarks" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" @click="save" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const list = ref([])
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const filterDepartment = ref('')
const filterStatus = ref('')
const showForm = ref(false)
const editingId = ref(null)

const form = reactive({
  name: '', department: '', position: '', phone: '', entry_date: '',
  health_cert_expiry: '', status: '在职', remarks: ''
})

const stats = reactive({ total: 0, active: 0, departments: [], deptCount: 0 })

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterDepartment.value) params.department = filterDepartment.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/personnel', { params })
    list.value = data.list
  } finally { loading.value = false }
}

async function fetchStats() {
  const { data } = await axios.get('/api/personnel/stats', { params: { user_id: user.id } })
  stats.total = data.total
  stats.active = data.active
  stats.departments = data.departments
  stats.deptCount = data.departments.length
}

function openAdd() { editingId.value = null; resetForm(); showForm.value = true }

function editRow(row) {
  editingId.value = row.id
  Object.assign(form, {
    name: row.name, department: row.department, position: row.position,
    phone: row.phone, entry_date: row.entry_date,
    health_cert_expiry: row.health_cert_expiry, status: row.status, remarks: row.remarks
  })
  showForm.value = true
}

async function deleteRow(row) {
  try { await ElMessageBox.confirm('确定删除该人员吗？', '提示', { type: 'warning' }) } catch { return }
  await axios.delete(`/api/personnel/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
  fetchStats()
}

async function save() {
  if (!form.name) return ElMessage.warning('请填写姓名')
  saving.value = true
  try {
    if (editingId.value) {
      await axios.put(`/api/personnel/${editingId.value}`, { user_id: user.id, ...form })
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/personnel', { user_id: user.id, ...form })
      ElMessage.success('添加成功')
    }
    showForm.value = false
    fetchList()
    fetchStats()
  } finally { saving.value = false }
}

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    name: '', department: '', position: '', phone: '', entry_date: '',
    health_cert_expiry: '', status: '在职', remarks: ''
  })
}

onMounted(() => { fetchList(); fetchStats() })
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.stat-row{margin-bottom:16px}
.stat-card{text-align:center;cursor:pointer}
.stat-num{font-size:28px;font-weight:bold;color:#303133}
.stat-num.info{color:#909399}
.stat-label{font-size:13px;color:#909399;margin-top:4px}
.filter-card{margin-bottom:16px;display:flex;gap:12px;align-items:center}
.filter-card :deep(.el-card__body){display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.text-muted{color:#c0c4cc;font-size:13px}
</style>
