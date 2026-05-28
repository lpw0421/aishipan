<template>
  <div class="page-container">
    <div class="toolbar" v-if="!props.sourceType">
      <h2>不合格品管理</h2>
      <el-button type="primary" @click="showAdd = true">记录不合格</el-button>
    </div>
    <div class="toolbar sub-toolbar" v-else>
      <span></span>
      <el-button type="primary" @click="showAdd = true">记录不合格</el-button>
    </div>

    <!-- 搜索 -->
    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索不合格编号/描述/批次" style="width:260px" clearable @change="fetchList" />
      <el-select v-if="!props.sourceType" v-model="filterSource" placeholder="来源类型" style="width:140px" clearable @change="fetchList">
        <el-option label="原料验收" value="原料验收" /><el-option label="生产过程" value="生产过程" /><el-option label="成品检验" value="成品检验" /><el-option label="留样复检" value="留样复检" /><el-option label="客诉" value="客诉" />
      </el-select>
      <el-select v-model="filterSeverity" placeholder="严重等级" style="width:120px" clearable @change="fetchList">
        <el-option label="严重" value="严重" /><el-option label="一般" value="一般" /><el-option label="轻微" value="轻微" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:130px" clearable @change="fetchList">
        <el-option label="待处理" value="待处理" /><el-option label="处理中" value="处理中" /><el-option label="已验证" value="已验证" /><el-option label="已关闭" value="已关闭" />
      </el-select>
      <el-button @click="fetchList">查询</el-button>
    </el-card>

    <!-- 列表 -->
    <el-card>
      <el-table :data="list" v-loading="loading" stripe>
        <el-table-column prop="nc_number" label="不合格编号" width="140" />
        <el-table-column v-if="!props.sourceType" prop="source_type" label="来源" width="100"><template #default="{row}"><el-tag size="small">{{ row.source_type }}</el-tag></template></el-table-column>
        <el-table-column prop="related_batch" label="关联批次" width="130" />
        <el-table-column prop="nc_description" label="不合格描述" min-width="180" show-overflow-tooltip />
        <el-table-column prop="severity" label="严重等级" width="100">
          <template #default="{row}"><el-tag :type="row.severity==='严重'?'danger':row.severity==='一般'?'warning':'success'" size="small">{{ row.severity }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.status==='已关闭'?'info':row.status==='已验证'?'success':row.status==='处理中'?'warning':'danger'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="200" fixed="right">
          <template #default="{row}">
            <el-button size="small" @click="editRow(row)">编辑</el-button>
            <el-button v-if="row.status!=='已关闭'" size="small" type="primary" @click="openAction(row)">处置</el-button>
            <el-button size="small" type="danger" @click="deleteRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog :title="editingId ? '编辑不合格品' : '记录不合格'" v-model="showAdd" width="500px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item v-if="!props.sourceType" label="来源类型"><el-select v-model="form.source_type" style="width:100%"><el-option label="原料验收" value="原料验收" /><el-option label="生产过程" value="生产过程" /><el-option label="成品检验" value="成品检验" /><el-option label="留样复检" value="留样复检" /><el-option label="客诉" value="客诉" /></el-select></el-form-item>
        <el-form-item label="关联批次"><el-input v-model="form.related_batch" /></el-form-item>
        <el-form-item label="不合格描述"><el-input v-model="form.nc_description" type="textarea" :rows="3" /></el-form-item>
        <el-form-item label="严重等级"><el-radio-group v-model="form.severity"><el-radio value="轻微">轻微</el-radio><el-radio value="一般">一般</el-radio><el-radio value="严重">严重</el-radio></el-radio-group></el-form-item>
        <el-form-item v-if="editingId" label="状态"><el-select v-model="form.status" style="width:200px"><el-option label="待处理" value="待处理" /><el-option label="处理中" value="处理中" /><el-option label="已验证" value="已验证" /><el-option label="已关闭" value="已关闭" /></el-select></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="save">保存</el-button>
      </template>
    </el-dialog>

    <!-- 处置对话框 -->
    <el-dialog title="处置措施" v-model="showAction" width="450px">
      <el-form :model="actionForm" label-width="100px">
        <el-form-item label="处置方式"><el-select v-model="actionForm.action_type" style="width:100%"><el-option label="返工" value="返工" /><el-option label="让步接收" value="让步接收" /><el-option label="报废" value="报废" /><el-option label="退货" value="退货" /></el-select></el-form-item>
        <el-form-item label="处置人"><el-input v-model="actionForm.handler" /></el-form-item>
        <el-form-item label="验证结果"><el-input v-model="actionForm.verify_result" placeholder="处置后是否合格" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAction = false">取消</el-button>
        <el-button type="primary" @click="doAction">确认处置</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'

const props = defineProps({
  sourceType: { type: String, default: '' }
})

const user = JSON.parse(localStorage.getItem('user') || '{}')
const list = ref([])
const loading = ref(false)
const keyword = ref('')
const filterSource = ref(props.sourceType || '')
const filterSeverity = ref('')
const filterStatus = ref('')
const showAdd = ref(false)
const showAction = ref(false)
const editingId = ref(null)
const actionNcId = ref(null)

const form = reactive({ source_type: '原料验收', related_batch: '', nc_description: '', severity: '一般', status: '待处理' })
const actionForm = reactive({ action_type: '返工', handler: '', verify_result: '' })

async function fetchList() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterSource.value) params.source_type = filterSource.value
    if (filterSeverity.value) params.severity = filterSeverity.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/non-conforming', { params })
    list.value = data.list
  } finally { loading.value = false }
}

function editRow(row) {
  editingId.value = row.id
  Object.assign(form, { source_type: row.source_type, related_batch: row.related_batch, nc_description: row.nc_description, severity: row.severity, status: row.status })
  showAdd.value = true
}

async function deleteRow(row) {
  await ElMessageBox.confirm('确定删除吗？', '提示', { type: 'warning' })
  await axios.delete(`/api/non-conforming/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
}

function openAction(row) {
  actionNcId.value = row.id
  showAction.value = true
}

async function save() {
  if (!form.nc_description) return ElMessage.warning('请填写不合格描述')
  if (editingId.value) {
    await axios.put(`/api/non-conforming/${editingId.value}`, { user_id: user.id, ...form })
    ElMessage.success('更新成功')
  } else {
    await axios.post('/api/non-conforming', { user_id: user.id, ...form })
    ElMessage.success('记录成功')
  }
  showAdd.value = false
  resetForm()
  fetchList()
}

async function doAction() {
  await axios.post(`/api/non-conforming/${actionNcId.value}/action`, { user_id: user.id, ...actionForm })
  ElMessage.success('处置完成')
  showAction.value = false
  fetchList()
}

function resetForm() {
  editingId.value = null
  Object.assign(form, { source_type: '原料验收', related_batch: '', nc_description: '', severity: '一般', status: '待处理' })
}

onMounted(fetchList)
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.sub-toolbar{margin-top:0;margin-bottom:16px;display:flex;justify-content:space-between;align-items:center}
.filter-card{margin-bottom:16px;display:flex;gap:12px;align-items:center}
.filter-card :deep(.el-card__body){display:flex;gap:12px;align-items:center;flex-wrap:wrap}
</style>
