<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>原料库</h2>
      <el-button type="primary" @click="showAdd = true">新增原料</el-button>
    </div>

    <!-- 搜索筛选 -->
    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索原料名称/编号" style="width:220px" clearable @clear="fetchList" @keyup.enter="fetchList" />
      <el-select v-model="filterCategory" placeholder="类别" style="width:140px" clearable @change="fetchList">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="filterRisk" placeholder="风险等级" style="width:120px" clearable @change="fetchList">
        <el-option label="高" value="高" /><el-option label="中" value="中" /><el-option label="低" value="低" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:100px" clearable @change="fetchList">
        <el-option label="启用" value="启用" /><el-option label="停用" value="停用" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <!-- 数据表格 -->
    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="material_number" label="原料编号" width="100" />
        <el-table-column prop="material_name" label="原料名称" min-width="120" />
        <el-table-column prop="category" label="类别" width="100">
          <template #default="{row}"><el-tag size="small">{{ row.category }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="risk_level" label="风险等级" width="100">
          <template #default="{row}">
            <el-tag :type="row.risk_level==='高'?'danger':row.risk_level==='中'?'warning':'success'" size="small">{{ row.risk_level }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="specification" label="规格" width="100" />
        <el-table-column prop="shelf_life" label="保质期(月)" width="100" />
        <el-table-column prop="storage_condition" label="储存条件" width="110" />
        <el-table-column prop="executive_standard" label="执行标准" width="120" />
        <el-table-column prop="allergen_info" label="过敏原" width="100" />
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}"><el-tag :type="row.status==='启用'?'success':'info'" size="small">{{ row.status }}</el-tag></template>
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
    <el-dialog :title="editingId ? '编辑原料' : '新增原料'" v-model="showAdd" width="600px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="原料名称"><el-input v-model="form.material_name" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="类别"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="风险等级"><el-select v-model="form.risk_level" style="width:100%"><el-option label="高" value="高" /><el-option label="中" value="中" /><el-option label="低" value="低" /></el-select></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="规格型号"><el-input v-model="form.specification" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="保质期(月)"><el-input-number v-model="form.shelf_life" :min="0" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="储存条件"><el-select v-model="form.storage_condition" style="width:100%"><el-option label="冷藏 0~4°C" value="冷藏 0~4°C" /><el-option label="冷冻 ≤-18°C" value="冷冻 ≤-18°C" /><el-option label="常温 ≤25°C" value="常温 ≤25°C" /><el-option label="避光" value="避光" /></el-select></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="执行标准"><el-input v-model="form.executive_standard" /></el-form-item>
        <el-form-item label="过敏原信息"><el-input v-model="form.allergen_info" placeholder="如：含大豆、小麦" /></el-form-item>
        <el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="启用">启用</el-radio><el-radio value="停用">停用</el-radio></el-radio-group></el-form-item>
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
const filterCategory = ref('')
const filterRisk = ref('')
const filterStatus = ref('')
const showAdd = ref(false)
const editingId = ref(null)

const categories = ['肉类', '海鲜/水产', '乳制品', '蛋类', '蔬菜', '水果', '粮食', '调料', '添加剂', '包材', '其他']

const form = reactive({
  material_name: '', category: '其他', risk_level: '中', specification: '', shelf_life: 0,
  storage_condition: '', executive_standard: '', allergen_info: '', status: '启用'
})

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterCategory.value) params.category = filterCategory.value
    if (filterRisk.value) params.risk_level = filterRisk.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/raw-materials', { params })
    list.value = data.list
  } finally { loading.value = false }
}

function editRow(row) {
  editingId.value = row.id
  Object.assign(form, {
    material_name: row.material_name, category: row.category, risk_level: row.risk_level,
    specification: row.specification, shelf_life: row.shelf_life, storage_condition: row.storage_condition,
    executive_standard: row.executive_standard, allergen_info: row.allergen_info, status: row.status
  })
  showAdd.value = true
}

async function deleteRow(row) {
  await ElMessageBox.confirm('确定删除该原料吗？', '提示', { type: 'warning' })
  await axios.delete(`/api/raw-materials/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
}

async function save() {
  if (!form.material_name) return ElMessage.warning('请填写原料名称')
  if (editingId.value) {
    await axios.put(`/api/raw-materials/${editingId.value}`, { user_id: user.id, ...form })
    ElMessage.success('更新成功')
  } else {
    await axios.post('/api/raw-materials', { user_id: user.id, ...form })
    ElMessage.success('添加成功')
  }
  showAdd.value = false
  resetForm()
  fetchList()
}

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    material_name: '', category: '其他', risk_level: '中', specification: '', shelf_life: 0,
    storage_condition: '', executive_standard: '', allergen_info: '', status: '启用'
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
