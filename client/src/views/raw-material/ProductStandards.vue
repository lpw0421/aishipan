<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>产品标准管理</h2>
      <el-button type="primary" @click="openAdd">新增标准</el-button>
    </div>

    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索标准名称/编号" style="width:220px" clearable @change="fetchList" />
      <el-select v-model="filterType" placeholder="标准类型" style="width:130px" clearable @change="fetchList">
        <el-option label="国标/行标" value="国标/行标" /><el-option label="企标" value="企标" /><el-option label="客户标准" value="客户标准" /><el-option label="内控标准" value="内控标准" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:130px" clearable @change="fetchList">
        <el-option label="现行有效" value="现行有效" /><el-option label="修订中" value="修订中" /><el-option label="已废止" value="已废止" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <el-card>
      <el-table :data="list" v-loading="loading" stripe @row-click="openDetail">
        <el-table-column prop="standard_number" label="标准编号" width="100" />
        <el-table-column prop="standard_name" label="标准名称" min-width="150" />
        <el-table-column prop="standard_type" label="标准类型" width="110"><template #default="{row}"><el-tag size="small">{{ row.standard_type }}</el-tag></template></el-table-column>
        <el-table-column prop="standard_code" label="标准号" width="140" />
        <el-table-column prop="applicable_products" label="适用产品" min-width="120" />
        <el-table-column prop="effective_date" label="生效日期" width="110" />
        <el-table-column prop="expiry_date" label="有效期至" width="110" />
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}"><el-tag :type="row.status==='现行有效'?'success':row.status==='修订中'?'warning':'info'" size="small">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click.stop="openEdit(row)">编辑</el-button>
            <el-button size="small" type="danger" @click.stop="deleteRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑标准对话框 -->
    <el-dialog :title="editingId ? '编辑标准' : '新增标准'" v-model="showForm" width="550px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="标准名称"><el-input v-model="form.standard_name" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="标准类型"><el-select v-model="form.standard_type" style="width:100%"><el-option label="国标/行标" value="国标/行标" /><el-option label="企标" value="企标" /><el-option label="客户标准" value="客户标准" /><el-option label="内控标准" value="内控标准" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="标准号"><el-input v-model="form.standard_code" placeholder="如 GB/T 20981" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="适用产品"><el-input v-model="form.applicable_products" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="生效日期"><el-date-picker v-model="form.effective_date" type="date" style="width:100%" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="有效期至"><el-date-picker v-model="form.expiry_date" type="date" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="状态"><el-select v-model="form.status" style="width:200px"><el-option label="现行有效" value="现行有效" /><el-option label="修订中" value="修订中" /><el-option label="已废止" value="已废止" /></el-select></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showForm = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 标准详情 + 指标管理对话框 -->
    <el-dialog title="标准详情" v-model="showDetail" width="800px" top="30px">
      <div v-if="currentStandard">
        <el-descriptions :column="2" border>
          <el-descriptions-item label="标准编号">{{ currentStandard.standard_number }}</el-descriptions-item>
          <el-descriptions-item label="标准名称">{{ currentStandard.standard_name }}</el-descriptions-item>
          <el-descriptions-item label="标准类型">{{ currentStandard.standard_type }}</el-descriptions-item>
          <el-descriptions-item label="标准号">{{ currentStandard.standard_code }}</el-descriptions-item>
          <el-descriptions-item label="适用产品">{{ currentStandard.applicable_products }}</el-descriptions-item>
          <el-descriptions-item label="状态">{{ currentStandard.status }}</el-descriptions-item>
        </el-descriptions>

        <div class="sub-header mt20">
          <h4>指标明细</h4>
          <el-button size="small" type="primary" @click="showAddIndicator = true">添加指标</el-button>
        </div>
        <el-table :data="indicators" stripe>
          <el-table-column prop="indicator_category" label="指标类别" width="80"><template #default="{row}"><el-tag size="small">{{ row.indicator_category }}</el-tag></template></el-table-column>
          <el-table-column prop="indicator_name" label="指标名称" width="140" />
          <el-table-column prop="requirement" label="要求" />
          <el-table-column prop="test_method" label="检验方法" width="120" />
          <el-table-column prop="internal_control" label="内控标准" width="120" />
          <el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" type="danger" @click="deleteIndicator(row)">删除</el-button></template></el-table-column>
        </el-table>
      </div>
    </el-dialog>

    <!-- 添加指标对话框 -->
    <el-dialog title="添加指标" v-model="showAddIndicator" width="500px" append-to-body>
      <el-form :model="indicatorForm" label-width="100px">
        <el-form-item label="指标类别"><el-select v-model="indicatorForm.indicator_category" style="width:100%"><el-option label="感官" value="感官" /><el-option label="理化" value="理化" /><el-option label="微生物" value="微生物" /><el-option label="净含量" value="净含量" /></el-select></el-form-item>
        <el-form-item label="指标名称"><el-input v-model="indicatorForm.indicator_name" /></el-form-item>
        <el-form-item label="要求"><el-input v-model="indicatorForm.requirement" /></el-form-item>
        <el-form-item label="检验方法"><el-input v-model="indicatorForm.test_method" placeholder="如 GB 5009.3" /></el-form-item>
        <el-form-item label="内控标准"><el-input v-model="indicatorForm.internal_control" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddIndicator = false">取消</el-button>
        <el-button type="primary" @click="saveIndicator">保存</el-button>
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
const showForm = ref(false)
const showDetail = ref(false)
const showAddIndicator = ref(false)
const editingId = ref(null)
const currentStandard = ref(null)
const indicators = ref([])

const form = reactive({
  standard_name: '', standard_type: '企标', standard_code: '', applicable_products: '',
  effective_date: '', expiry_date: '', status: '现行有效'
})

const indicatorForm = reactive({
  indicator_category: '感官', indicator_name: '', requirement: '', test_method: '', internal_control: ''
})

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterType.value) params.standard_type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/product-standards', { params })
    list.value = data.list
  } finally { loading.value = false }
}

function openAdd() { editingId.value = null; resetForm(); showForm.value = true }
function openEdit(row) {
  editingId.value = row.id
  Object.assign(form, { standard_name: row.standard_name, standard_type: row.standard_type, standard_code: row.standard_code, applicable_products: row.applicable_products, effective_date: row.effective_date, expiry_date: row.expiry_date, status: row.status })
  showForm.value = true
}

async function deleteRow(row) {
  await ElMessageBox.confirm('确定删除该标准吗？', '提示', { type: 'warning' })
  await axios.delete(`/api/product-standards/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
}

async function save() {
  if (!form.standard_name) return ElMessage.warning('请填写标准名称')
  const payload = { user_id: user.id, ...form }
  if (editingId.value) {
    await axios.put(`/api/product-standards/${editingId.value}`, payload)
    ElMessage.success('更新成功')
  } else {
    await axios.post('/api/product-standards', payload)
    ElMessage.success('添加成功')
  }
  showForm.value = false
  fetchList()
}

async function openDetail(row) {
  currentStandard.value = row
  const { data } = await axios.get(`/api/product-standards/${row.id}/indicators`)
  indicators.value = data.list
  showDetail.value = true
}

async function saveIndicator() {
  if (!indicatorForm.indicator_name) return ElMessage.warning('请填写指标名称')
  await axios.post(`/api/product-standards/${currentStandard.value.id}/indicators`, {
    user_id: user.id, ...indicatorForm
  })
  ElMessage.success('指标添加成功')
  showAddIndicator.value = false
  Object.assign(indicatorForm, { indicator_category: '感官', indicator_name: '', requirement: '', test_method: '', internal_control: '' })
  openDetail(currentStandard.value)
}

async function deleteIndicator(row) {
  await axios.delete(`/api/product-standards/indicators/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  openDetail(currentStandard.value)
}

function resetForm() {
  Object.assign(form, { standard_name: '', standard_type: '企标', standard_code: '', applicable_products: '', effective_date: '', expiry_date: '', status: '现行有效' })
}

onMounted(fetchList)
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.filter-card{margin-bottom:16px;display:flex;gap:12px;align-items:center}
.filter-card :deep(.el-card__body){display:flex;gap:12px;align-items:center;flex-wrap:wrap}
.mt20{margin-top:20px}
.sub-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.sub-header h4{margin:0;color:#303133}
</style>
