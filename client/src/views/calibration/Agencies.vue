<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>校准机构管理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索机构名称/联系人..." clearable style="width:240px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="statusFilter" placeholder="合作状态" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="合作中" value="合作中" />
          <el-option label="暂停" value="暂停" />
          <el-option label="终止" value="终止" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增机构</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
      </div>
    </div>

    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="stat-card" :class="card.cls" @click="statusFilter=card.filter;currentPage=1">
          <div class="stat-num" :class="card.numCls">{{ card.value }}</div>
          <div class="stat-label">{{ card.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="机构名称" prop="agency_name" min-width="180" />
        <el-table-column label="资质类型" prop="qualification" width="120" />
        <el-table-column label="资质证书编号" prop="cert_number" width="150" />
        <el-table-column label="资质有效期" width="110">
          <template #default="{row}">{{ row.cert_expiry || '-' }}</template>
        </el-table-column>
        <el-table-column label="服务范围" prop="service_scope" min-width="150" />
        <el-table-column label="联系人" prop="contact_person" width="80" />
        <el-table-column label="联系电话" prop="contact_phone" width="120" />
        <el-table-column label="地址" prop="address" min-width="150" show-overflow-tooltip />
        <el-table-column label="合作状态" width="100">
          <template #default="{row}">
            <el-tag :type="row.cooperation_status==='合作中'?'success':row.cooperation_status==='暂停'?'warning':'info'" size="small">{{ row.cooperation_status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="评分" width="80">
          <template #default="{row}">
            <span v-if="row.rating">{{ '★'.repeat(row.rating) }}{{ '☆'.repeat(5-row.rating) }}</span>
            <span v-else style="color:#c0c4cc">未评</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无校准机构" />
      <div v-if="filteredList.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background />
      </div>
    </el-card>

    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="550px">
      <el-form :model="form" label-width="100px">
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="机构名称"><el-input v-model="form.agency_name" placeholder="校准服务商名称" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="资质类型"><el-input v-model="form.qualification" placeholder="如：CNAS、CMA" /></el-form-item></el-col>
        </el-row>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="资质证书编号"><el-input v-model="form.cert_number" placeholder="资质证书编号" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="资质有效期"><el-date-picker v-model="form.cert_expiry" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="服务范围"><el-input v-model="form.service_scope" placeholder="如：温度测量、称重设备、理化分析" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12"><el-form-item label="联系人"><el-input v-model="form.contact_person" placeholder="对接人姓名" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="联系电话"><el-input v-model="form.contact_phone" placeholder="联系方式" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="地址"><el-input v-model="form.address" placeholder="机构地址" /></el-form-item>
        <el-row :gutter="16">
          <el-col :span="12">
            <el-form-item label="合作状态">
              <el-select v-model="form.cooperation_status" style="width:100%">
                <el-option label="合作中" value="合作中" />
                <el-option label="暂停" value="暂停" />
                <el-option label="终止" value="终止" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="评分">
              <el-rate v-model="form.rating" :max="5" />
            </el-form-item>
          </el-col>
        </el-row>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const statusFilter = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const statCards = computed(() => [
  { label: '机构总数', value: list.value.length, cls: '', numCls: '', filter: '' },
  { label: '合作中', value: list.value.filter(r=>r.cooperation_status==='合作中').length, cls: 'stat-valid', numCls: '', filter: '合作中' },
  { label: '暂停', value: list.value.filter(r=>r.cooperation_status==='暂停').length, cls: 'stat-warning', numCls: '', filter: '暂停' },
  { label: '已终止', value: list.value.filter(r=>r.cooperation_status==='终止').length, cls: 'stat-danger', numCls: '', filter: '终止' }
])

const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => (r.agency_name||'').includes(kw) || (r.contact_person||'').includes(kw) || (r.service_scope||'').includes(kw))
  }
  if (statusFilter.value) result = result.filter(r => r.cooperation_status === statusFilter.value)
  return result
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

const fetchList = async () => {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const params = { user_id: user.id }
    if (statusFilter.value) params.status = statusFilter.value
    const res = await request.get('/calibration/agencies', { params })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try { await ElMessageBox.confirm('确认删除选中机构？', '批量删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/calibration/agencies/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功'); selectedIds.value = []; fetchList()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDelete = async (id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete('/api/calibration/agencies/' + id, { data: { user_id: user.id } })
    ElMessage.success('已删除'); fetchList()
  } catch { ElMessage.error('删除失败') }
}

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('新增机构')
const editId = ref(null)
const submitting = ref(false)
const form = reactive({
  agency_name: '', qualification: '', cert_number: '', cert_expiry: '', service_scope: '',
  contact_person: '', contact_phone: '', address: '', cooperation_status: '合作中', rating: 0
})

const openAddDialog = () => {
  dialogTitle.value = '新增机构'; editId.value = null
  Object.assign(form, { agency_name: '', qualification: '', cert_number: '', cert_expiry: '', service_scope: '', contact_person: '', contact_phone: '', address: '', cooperation_status: '合作中', rating: 0 })
  dialogVisible.value = true
}

const openEditDialog = (row) => {
  dialogTitle.value = '编辑机构'; editId.value = row.id
  Object.assign(form, {
    agency_name: row.agency_name, qualification: row.qualification, cert_number: row.cert_number,
    cert_expiry: row.cert_expiry, service_scope: row.service_scope, contact_person: row.contact_person,
    contact_phone: row.contact_phone, address: row.address, cooperation_status: row.cooperation_status,
    rating: row.rating || 0
  })
  dialogVisible.value = true
}

const handleSubmit = async () => {
  if (!form.agency_name) { ElMessage.warning('请填写机构名称'); return }
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const data = { user_id: user.id, ...form }
    if (editId.value) {
      await axios.put('/api/calibration/agencies/' + editId.value, data)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/calibration/agencies', data)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false; fetchList()
  } catch { ElMessage.error('操作失败') } finally { submitting.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; }
.toolbar h2 { margin: 0; color: #303133; }
.toolbar-right { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; }
.stat-card { cursor: pointer; text-align: center; }
.stat-num { font-size: 28px; font-weight: bold; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-valid .stat-num { color: #67c23a; }
.stat-warning .stat-num { color: #e6a23c; }
.stat-danger .stat-num { color: #f56c6c; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
