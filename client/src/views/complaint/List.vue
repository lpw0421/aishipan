<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>客诉列表</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索编号/客户/产品..." clearable style="width:220px" @input="fetchList" />
        <el-select v-model="filterType" placeholder="投诉类型" clearable style="width:120px" @change="fetchList">
          <el-option v-for="t in types" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="filterUrgency" placeholder="紧急程度" clearable style="width:110px" @change="fetchList">
          <el-option label="🔴 紧急" value="紧急" />
          <el-option label="🟡 一般" value="一般" />
          <el-option label="🟢 轻微" value="轻微" />
        </el-select>
        <el-select v-model="filterStatus" placeholder="处理状态" clearable style="width:110px" @change="fetchList">
          <el-option label="待处理" value="待处理" />
          <el-option label="处理中" value="处理中" />
          <el-option label="待回复" value="待回复" />
          <el-option label="已关闭" value="已关闭" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增客诉</el-button>
      </div>
    </div>

    <el-card>
      <el-table :data="pagedList" border stripe v-loading="loading" @row-click="(row) => $router.push('/complaint/handle?id='+row.id)" style="cursor:pointer">
        <el-table-column prop="complaint_number" label="客诉编号" width="170" />
        <el-table-column prop="customer_name" label="投诉人" width="80" />
        <el-table-column prop="complaint_type" label="投诉类型" width="100">
          <template #default="{row}"><el-tag :type="typeTag(row.complaint_type)" size="small">{{ row.complaint_type }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="product_name" label="关联产品" width="130">
          <template #default="{row}">{{ row.product_name || '-' }}</template>
        </el-table-column>
        <el-table-column label="紧急程度" width="100">
          <template #default="{row}">
            <el-tag :type="row.urgency==='紧急'?'danger':row.urgency==='一般'?'warning':'info'" size="small">{{ row.urgency }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="问题描述" min-width="180">
          <template #default="{row}">{{ row.problem_desc?.slice(0, 40) }}{{ row.problem_desc?.length > 40 ? '...' : '' }}</template>
        </el-table-column>
        <el-table-column prop="complaint_date" label="投诉日期" width="110" />
        <el-table-column prop="handler" label="处理人" width="80">
          <template #default="{row}">{{ row.handler || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{row}">
            <el-tag :type="statusTag(row.status)" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="80" fixed="right">
          <template #default="{row}">
            <el-popconfirm title="确定删除？" @confirm="handleDelete(row.id)" @click.stop>
              <template #reference><el-button type="danger" size="small" @click.stop>删除</el-button></template>
            </el-popconfirm>
          </template>
        </el-table-column>
      </el-table>

      <el-empty v-if="!loading && list.length===0" description="暂无客诉记录" />
      <div v-if="list.length>10" class="pagination-wrap">
        <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="list.length" background />
      </div>
    </el-card>

    <!-- 新增客诉弹窗 -->
    <el-dialog v-model="dialogVisible" title="新增客诉" width="600px">
      <el-form :model="form" label-width="90px">
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="投诉人"><el-input v-model="form.customer_name" placeholder="客户姓名" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="联系方式"><el-input v-model="form.customer_phone" placeholder="电话/邮箱" /></el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="投诉日期">
              <el-date-picker v-model="form.complaint_date" type="date" value-format="YYYY-MM-DD" placeholder="选择日期" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="投诉渠道">
              <el-select v-model="form.complaint_channel" style="width:100%">
                <el-option v-for="ch in channels" :key="ch" :label="ch" :value="ch" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="投诉类型">
              <el-select v-model="form.complaint_type" style="width:100%">
                <el-option v-for="t in types" :key="t" :label="t" :value="t" />
              </el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="紧急程度">
              <el-select v-model="form.urgency" style="width:100%">
                <el-option label="🔴 紧急" value="紧急" />
                <el-option label="🟡 一般" value="一般" />
                <el-option label="🟢 轻微" value="轻微" />
              </el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="关联产品"><el-input v-model="form.product_name" placeholder="产品名称" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="生产批次"><el-input v-model="form.batch_no" placeholder="批次号" /></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="处理人"><el-input v-model="form.handler" placeholder="指定处理人" /></el-form-item>
        <el-form-item label="问题描述">
          <el-input v-model="form.problem_desc" type="textarea" :rows="4" placeholder="客户投诉的具体问题..." />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleAdd" :loading="submitting">确定添加</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import request from '../../utils/request'

const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

const types = ['异物', '变质', '过敏', '标签错误', '包装破损', '缺斤少两', '服务态度', '其他']
const channels = ['电话', '邮件', '电商平台', '社交媒体', '门店', '12315', '黑猫投诉']

const list = ref([])
const loading = ref(false)
const keyword = ref('')
const filterType = ref('')
const filterUrgency = ref('')
const filterStatus = ref('')
const currentPage = ref(1)
const pageSize = ref(10)

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return list.value.slice(start, start + pageSize.value)
})

const typeTag = (type) => ({ '异物':'danger', '变质':'danger', '过敏':'danger', '标签错误':'warning', '包装破损':'warning', '缺斤少两':'info', '服务态度':'success' }[type] || 'info')
const statusTag = (s) => ({ '待处理':'danger', '处理中':'warning', '待回复':'info', '已关闭':'success' }[s] || 'info')

const fetchList = async () => {
  loading.value = true
  try {
    const params = { user_id: userId }
    if (keyword.value) params.keyword = keyword.value
    if (filterType.value) params.type = filterType.value
    if (filterUrgency.value) params.urgency = filterUrgency.value
    if (filterStatus.value) params.status = filterStatus.value
    const res = await request.get('/complaints', { params })
    list.value = res.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchList)

// 新增
const dialogVisible = ref(false)
const submitting = ref(false)
const form = reactive({
  customer_name: '', customer_phone: '', complaint_date: '', complaint_channel: '电话',
  complaint_type: '其他', product_name: '', batch_no: '', problem_desc: '', urgency: '一般', handler: ''
})

const openAddDialog = () => {
  Object.keys(form).forEach(k => form[k] = '')
  form.complaint_channel = '电话'; form.complaint_type = '其他'; form.urgency = '一般'
  form.complaint_date = new Date().toISOString().slice(0, 10)
  dialogVisible.value = true
}

const handleAdd = async () => {
  if (!form.customer_name || !form.problem_desc) { ElMessage.warning('请填写投诉人和问题描述'); return }
  submitting.value = true
  try {
    await request.post('/complaints', { user_id: userId, ...form })
    ElMessage.success('客诉已创建')
    dialogVisible.value = false
    fetchList()
  } catch { ElMessage.error('创建失败') }
  finally { submitting.value = false }
}

const handleDelete = async (id) => {
  try {
    await request.delete(`/complaints/${id}`, { data: { user_id: userId } })
    ElMessage.success('已删除')
    fetchList()
  } catch {}
}
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; flex-wrap:wrap; gap:8px }
.toolbar h2 { margin:0; color:#303133 }
.toolbar-right { display:flex; align-items:center; gap:8px; flex-wrap:wrap }
.pagination-wrap { display:flex; justify-content:center; margin-top:16px }
</style>
