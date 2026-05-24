<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>留样管理</h2>
      <el-button type="primary" @click="showAdd = true">新增留样</el-button>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6" v-for="s in statsCards" :key="s.label">
        <el-card class="stat-card" shadow="hover">
          <div class="stat-value" :style="{color:s.color}">{{ s.value }}</div>
          <div class="stat-label">{{ s.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索 -->
    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索样品编号/原料/产品" style="width:240px" clearable @change="fetchList" />
      <el-select v-model="filterType" placeholder="留样类型" style="width:140px" clearable @change="fetchList">
        <el-option label="原料留样" value="原料留样" /><el-option label="成品留样" value="成品留样" /><el-option label="半成品留样" value="半成品留样" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:120px" clearable @change="fetchList">
        <el-option label="留样中" value="留样中" /><el-option label="已到期" value="已到期" /><el-option label="已处置" value="已处置" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <!-- 留样列表 -->
    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="sample_number" label="样品编号" width="140" />
        <el-table-column prop="sample_type" label="留样类型" width="100"><template #default="{row}"><el-tag size="small">{{ row.sample_type }}</el-tag></template></el-table-column>
        <el-table-column prop="material_product_name" label="原料/产品名称" min-width="130" />
        <el-table-column prop="related_batch" label="关联批次" width="130" />
        <el-table-column prop="sample_quantity" label="留样数量" width="90" />
        <el-table-column prop="storage_location" label="存放位置" width="110" />
        <el-table-column prop="storage_condition" label="留样条件" width="90" />
        <el-table-column prop="sample_date" label="留样日期" width="110" />
        <el-table-column prop="expiry_date" label="到期时间" width="110" />
        <el-table-column prop="status" label="状态" width="90">
          <template #default="{row}">
            <el-tag v-if="row.status==='留样中'" type="success" size="small">留样中</el-tag>
            <el-tag v-else-if="row.status==='已到期'" type="warning" size="small">已到期</el-tag>
            <el-tag v-else type="info" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="editRow(row)">编辑</el-button>
            <el-button v-if="row.status!=='已处置'" size="small" type="primary" @click.stop="openDispose(row)">处置</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增对话框 -->
    <el-dialog title="新增留样" v-model="showAdd" width="550px" @close="resetForm">
      <el-form :model="form" label-width="110px">
        <el-form-item label="原料/产品名称"><el-input v-model="form.material_product_name" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="留样类型"><el-select v-model="form.sample_type" style="width:100%"><el-option label="原料留样" value="原料留样" /><el-option label="成品留样" value="成品留样" /><el-option label="半成品留样" value="半成品留样" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="关联批次"><el-input v-model="form.related_batch" /></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="留样数量"><el-input v-model="form.sample_quantity" placeholder="如 200g" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="留样日期"><el-date-picker v-model="form.sample_date" type="date" style="width:100%" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="存放位置"><el-input v-model="form.storage_location" placeholder="留样柜编号 + 层号" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="留样条件"><el-select v-model="form.storage_condition" style="width:100%"><el-option label="常温" value="常温" /><el-option label="冷藏" value="冷藏" /><el-option label="冷冻" value="冷冻" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="留样期限(天)"><el-input-number v-model="form.retention_days" :min="1" style="width:100%" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="留样人"><el-input v-model="form.sampler" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 处置对话框 -->
    <el-dialog title="留样处置" v-model="showDispose" width="450px">
      <el-form :model="disposeForm" label-width="100px">
        <el-form-item label="处置方式"><el-select v-model="disposeForm.disposal_method" style="width:100%"><el-option label="销毁" value="销毁" /><el-option label="复检" value="复检" /><el-option label="留存备查" value="留存备查" /></el-select></el-form-item>
        <el-form-item label="处置人"><el-input v-model="disposeForm.disposer" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="disposeForm.remark" type="textarea" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDispose = false">取消</el-button>
        <el-button type="primary" @click="doDispose">确认处置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const list = ref([])
const loading = ref(false)
const keyword = ref('')
const filterType = ref('')
const filterStatus = ref('')
const showAdd = ref(false)
const showDispose = ref(false)
const currentId = ref(null)

const statsCards = ref([
  { label: '留样总数', value: 0, color: '#409eff' },
  { label: '留样中', value: 0, color: '#67c23a' },
  { label: '已到期/已处置', value: 0, color: '#909399' },
  { label: '即将到期(7天)', value: 0, color: '#e6a23c' }
])

const form = reactive({
  sample_type: '原料留样', related_batch: '', material_product_name: '', sample_quantity: '',
  sample_date: '', storage_location: '', storage_condition: '', retention_days: 180, sampler: ''
})

const disposeForm = reactive({ disposal_method: '销毁', disposer: '', remark: '' })

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterType.value) params.sample_type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/samples', { params })
    list.value = data.list
  } finally { loading.value = false }
}

async function fetchStats() {
  const { data } = await axios.get('/api/samples/stats', { params: { user_id: user.id } })
  statsCards.value = [
    { label: '留样总数', value: data.total, color: '#409eff' },
    { label: '留样中', value: data.keeping, color: '#67c23a' },
    { label: '已到期/已处置', value: data.expired, color: '#909399' },
    { label: '即将到期(7天)', value: data.soonExpire, color: '#e6a23c' }
  ]
}

function editRow(row) {
  currentId.value = row.id
  Object.assign(form, {
    sample_type: row.sample_type, related_batch: row.related_batch, material_product_name: row.material_product_name,
    sample_quantity: row.sample_quantity, sample_date: row.sample_date, storage_location: row.storage_location,
    storage_condition: row.storage_condition, retention_days: row.retention_days, sampler: row.sampler
  })
  showAdd.value = true
}

function openDispose(row) {
  currentId.value = row.id
  showDispose.value = true
}

async function save() {
  if (!form.material_product_name) return ElMessage.warning('请填写原料/产品名称')
  if (currentId.value) {
    await axios.put(`/api/samples/${currentId.value}`, { user_id: user.id, ...form })
    ElMessage.success('更新成功')
  } else {
    await axios.post('/api/samples', { user_id: user.id, ...form })
    ElMessage.success('留样添加成功')
  }
  showAdd.value = false
  resetForm()
  fetchList()
  fetchStats()
}

async function doDispose() {
  await axios.post(`/api/samples/${currentId.value}/dispose`, { user_id: user.id, ...disposeForm })
  ElMessage.success('处置完成')
  showDispose.value = false
  fetchList()
  fetchStats()
}

function resetForm() {
  currentId.value = null
  Object.assign(form, {
    sample_type: '原料留样', related_batch: '', material_product_name: '', sample_quantity: '',
    sample_date: '', storage_location: '', storage_condition: '', retention_days: 180, sampler: ''
  })
}

onMounted(() => { fetchList(); fetchStats() })
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.stats-row{margin-bottom:16px}
.stat-card{text-align:center}
.stat-value{font-size:28px;font-weight:700}
.stat-label{font-size:13px;color:#909399;margin-top:4px}
.filter-card{margin-bottom:16px;display:flex;gap:12px;align-items:center}
.filter-card :deep(.el-card__body){display:flex;gap:12px;align-items:center;flex-wrap:wrap}
</style>
