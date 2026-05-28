<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>三方管理</h2>
      <el-button type="primary" @click="openAdd">新增三方</el-button>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num">{{ stats.total }}</div>
          <div class="stat-label">三方总数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num" style="color:#67c23a">{{ stats.active }}</div>
          <div class="stat-label">合作中</div>
        </el-card>
      </el-col>
      <el-col :span="6" v-for="t in stats.typeCount" :key="t.vendor_type">
        <el-card shadow="hover" class="stat-card">
          <div class="stat-num info">{{ t.cnt }}</div>
          <div class="stat-label">{{ t.vendor_type }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索名称/联系人/服务范围" style="width:240px" clearable @change="fetchList">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filterType" placeholder="类型" style="width:130px" clearable @change="fetchList">
        <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:100px" clearable @change="fetchList">
        <el-option label="合作中" value="合作中" /><el-option label="已终止" value="已终止" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="vendor_number" label="编号" width="90" />
        <el-table-column prop="vendor_name" label="名称" min-width="150" />
        <el-table-column prop="vendor_type" label="类型" width="100">
          <template #default="{row}">
            <el-tag size="small" :type="typeTag(row.vendor_type)">{{ row.vendor_type }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="contact_person" label="联系人" width="80" />
        <el-table-column prop="phone" label="电话" width="120" />
        <el-table-column prop="service_scope" label="服务范围" min-width="140" show-overflow-tooltip />
        <el-table-column prop="qualification_expiry" label="资质到期" width="110">
          <template #default="{row}">
            <el-tag v-if="row.qualification_expiry" :type="new Date(row.qualification_expiry) < new Date() ? 'danger' : 'success'" size="small">
              {{ row.qualification_expiry }}
            </el-tag>
            <span v-else class="text-muted">未登记</span>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='合作中'?'success':'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="editRow(row)">编辑</el-button>
            <el-button size="small" type="danger" @click="deleteRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length === 0" description="暂无三方信息" />
    </el-card>

    <el-dialog :title="editingId ? '编辑三方' : '新增三方'" v-model="showForm" width="580px" @close="resetForm">
      <el-form :model="form" label-width="90px">
        <el-form-item label="名称" required><el-input v-model="form.vendor_name" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="类型"><el-select v-model="form.vendor_type" style="width:100%">
              <el-option v-for="t in typeOptions" :key="t" :label="t" :value="t" />
            </el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="状态" v-if="editingId"><el-select v-model="form.status" style="width:100%">
              <el-option label="合作中" value="合作中" /><el-option label="已终止" value="已终止" />
            </el-select></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="联系人"><el-input v-model="form.contact_person" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="地址"><el-input v-model="form.address" /></el-form-item>
        <el-form-item label="资质到期"><el-date-picker v-model="form.qualification_expiry" type="date" style="width:100%" /></el-form-item>
        <el-form-item label="服务范围"><el-input v-model="form.service_scope" type="textarea" :rows="2" /></el-form-item>
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
const filterType = ref('')
const filterStatus = ref('')
const showForm = ref(false)
const editingId = ref(null)

const typeOptions = ['检测机构', '校准机构', '虫害公司', '其他']

const form = reactive({
  vendor_name: '', vendor_type: '检测机构', contact_person: '', phone: '',
  address: '', qualification_expiry: '', service_scope: '', status: '合作中', remarks: ''
})

const stats = reactive({ total: 0, active: 0, typeCount: [] })

function typeTag(type) {
  const map = { '检测机构': '', '校准机构': 'warning', '虫害公司': 'danger', '其他': 'info' }
  return map[type] || 'info'
}

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterType.value) params.vendor_type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/third-party', { params })
    list.value = data.list
  } finally { loading.value = false }
}

async function fetchStats() {
  const { data } = await axios.get('/api/third-party/stats', { params: { user_id: user.id } })
  stats.total = data.total
  stats.active = data.active
  stats.typeCount = data.typeCount
}

function openAdd() { editingId.value = null; resetForm(); showForm.value = true }

function editRow(row) {
  editingId.value = row.id
  Object.assign(form, {
    vendor_name: row.vendor_name, vendor_type: row.vendor_type,
    contact_person: row.contact_person, phone: row.phone, address: row.address,
    qualification_expiry: row.qualification_expiry, service_scope: row.service_scope,
    status: row.status, remarks: row.remarks
  })
  showForm.value = true
}

async function deleteRow(row) {
  try { await ElMessageBox.confirm('确定删除该三方吗？', '提示', { type: 'warning' }) } catch { return }
  await axios.delete(`/api/third-party/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
  fetchStats()
}

async function save() {
  if (!form.vendor_name) return ElMessage.warning('请填写名称')
  saving.value = true
  try {
    if (editingId.value) {
      await axios.put(`/api/third-party/${editingId.value}`, { user_id: user.id, ...form })
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/third-party', { user_id: user.id, ...form })
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
    vendor_name: '', vendor_type: '检测机构', contact_person: '', phone: '',
    address: '', qualification_expiry: '', service_scope: '', status: '合作中', remarks: ''
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
