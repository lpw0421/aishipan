<template>
  <div class="personnel-page">
    <!-- 标题栏 -->
    <div class="page-hd">
      <div><h1>人员综合</h1><span class="sub">{{ stats.total }} 名员工</span></div>
      <div class="hd-btns">
        <el-button class="btn-ghost" @click="exportExcel">导出 Excel</el-button>
        <el-button type="primary" class="btn-main" @click="openAdd">新增员工</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card card-blue" :class="{active:activeCard==='total'}" @click="toggleCard('total')">
        <div class="stat-num">{{ stats.total }}</div><div class="stat-lbl">人员总数</div>
      </div>
      <div class="stat-card card-green" :class="{active:activeCard==='active'}" @click="toggleCard('active')">
        <div class="stat-num">{{ stats.active }}</div><div class="stat-lbl">在职</div>
      </div>
      <div class="stat-card card-orange" :class="{active:activeCard==='expiring'}" @click="toggleCard('expiring')">
        <div class="stat-num">{{ stats.expiringSoon }}</div><div class="stat-lbl">健康证临期</div>
      </div>
      <div class="stat-card card-red" :class="{active:activeCard==='expired'}" @click="toggleCard('expired')">
        <div class="stat-num">{{ stats.expired }}</div><div class="stat-lbl">健康证过期</div>
      </div>
    </div>

    <!-- 筛选区 -->
    <div class="filter-bar">
      <div class="filter-row">
        <span class="f-label">人员状态</span>
        <span v-for="t in statusTags" :key="t.v" class="f-tag" :class="{active:filterStatus===t.v}" :style="t.v===filterStatus?t.style:{}" @click="filterStatus=filterStatus===t.v?'全部':t.v;fetchData()">{{ t.l }}</span>
        <span class="f-sep">|</span>
        <span class="f-label">健康证</span>
        <span v-for="t in healthTags" :key="t.v" class="f-tag" :class="{active:filterHealth===t.v}" :style="t.v===filterHealth?t.style:{}" @click="filterHealth=filterHealth===t.v?'全部':t.v;fetchData()">{{ t.l }}</span>
      </div>
      <div class="filter-row2">
        <el-select v-model="filterDept" placeholder="全部部门" size="small" clearable @change="fetchData" style="width:140px">
          <el-option v-for="d in depts" :key="d" :label="d" :value="d" />
        </el-select>
        <el-input v-model="keyword" placeholder="搜索姓名/编号/职位" size="small" clearable @input="fetchData" style="width:200px" />
      </div>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <el-table :data="list" v-loading="loading" row-key="id" @expand-change="onExpand" :expand-row-keys="expandedRows" @selection-change="onSelectionChange" ref="tableRef">
        <el-table-column type="selection" width="40" />
        <el-table-column type="expand"><template #default="{row}">
          <div class="expand-panel" :class="{'hc-expired':row.hcStatus==='过期','hc-expiring':row.hcStatus==='临期'}">
            <span>电话：{{ row.phone || '—' }}</span>
            <span>入职日期：{{ row.entry_date || '—' }}</span>
            <el-button v-if="row.hcStatus==='临期'" size="small" class="btn-renew">续办健康证</el-button>
            <el-button v-else-if="row.hcStatus==='过期'" size="small" class="btn-update">立即更新</el-button>
            <el-button size="small" class="btn-file" @click="viewFiles(row)">查看附件</el-button>
          </div>
        </template></el-table-column>
        <el-table-column prop="employee_number" label="编号" width="72" />
        <el-table-column prop="name" label="姓名" width="56"><template #default="{row}"><span class="name-cell">{{ row.name }}</span></template></el-table-column>
        <el-table-column prop="department" label="部门" width="64" show-overflow-tooltip />
        <el-table-column prop="position" label="职位" width="80" show-overflow-tooltip />
        <el-table-column label="人员状态" width="66"><template #default="{row}"><span class="tag" :class="'tag-'+row.statusCls">{{ row.status }}</span></template></el-table-column>
        <el-table-column label="健康证到期" width="88"><template #default="{row}"><span :class="'date-'+row.hcStatus">{{ row.health_cert_expiry || '—' }}</span></template></el-table-column>
        <el-table-column label="证件状态" width="66"><template #default="{row}"><span class="tag" :class="'tag-'+row.hcCls">{{ row.hcLabel }}</span></template></el-table-column>
        <el-table-column label="操作" width="80"><template #default="{row}">
          <el-button link size="small" @click="editRow(row)">编辑</el-button>
          <el-button link size="small" @click="showDetail(row)">详情</el-button>
        </template></el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length===0" :description="emptyDesc">
        <template v-if="!keyword&&filterStatus==='全部'&&filterHealth==='全部'&&!filterDept">
          <el-button type="primary" @click="openAdd">+ 新增员工</el-button>
        </template>
        <template v-else>
          <el-button link type="primary" @click="clearFilters">清除筛选</el-button>
        </template>
      </el-empty>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedRows.length>0">
      <span>已选 {{ selectedRows.length }} 项</span>
      <el-button size="small" @click="batchExport">批量导出</el-button>
      <el-button size="small" type="warning" @click="batchUpdateHC">批量更新健康证</el-button>
      <el-button size="small" @click="tableRef?.clearSelection()">取消</el-button>
    </div>

    <!-- 新增/编辑弹窗 -->
    <el-dialog :title="editingId?'编辑人员':'新增人员'" v-model="showForm" width="550px" @close="resetForm">
      <div v-if="!editingId" class="ai-fill-bar">
        <el-input v-model="aiText" type="textarea" :rows="2" placeholder='🤖 粘贴描述，AI自动填写。如："张三，品控部质检员，健康证2026-12-31到期"' size="small" />
        <el-button type="success" size="small" @click="aiFill" :loading="aiLoading" style="margin-top:6px">AI 智能填写</el-button>
      </div>
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
      <template #footer><el-button @click="showForm=false">取消</el-button><el-button type="primary" @click="save" :loading="saving">保存</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import request from '../../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const userId = user.id
const loading = ref(false), saving = ref(false), showForm = ref(false), editingId = ref(null)
const keyword = ref(''), filterStatus = ref('全部'), filterHealth = ref('全部'), filterDept = ref(''), activeCard = ref('')
const list = ref([]), expandedRows = ref([]), depts = ref([]), selectedRows = ref([])
const aiText = ref(''), aiLoading = ref(false), tableRef = ref(null)

const emptyDesc = computed(() => {
  if (keyword.value) return `未找到"${keyword.value}"相关结果`
  if (filterStatus.value!=='全部'||filterHealth.value!=='全部'||filterDept.value) return '暂无匹配人员'
  return '暂无人员数据'
})

const stats = reactive({ total: 0, active: 0, expiringSoon: 0, expired: 0 })

const statusTags = [
  { l: '全部', v: '全部', style: { background: '#E6F1FB', borderColor: '#378ADD', color: '#185FA5' } },
  { l: '在职', v: '在职', style: { background: '#EAF3DE', borderColor: '#C0DD97', color: '#3B6D11' } },
  { l: '离职', v: '离职', style: { background: '#f3f4f6', borderColor: '#d1d5db', color: '#6b7280' } },
  { l: '试用期', v: '试用期', style: { background: '#dbeafe', borderColor: '#93c5fd', color: '#1e40af' } }
]
const healthTags = [
  { l: '全部', v: '全部', style: { background: '#E6F1FB', borderColor: '#378ADD', color: '#185FA5' } },
  { l: '正常', v: '正常', style: { background: '#EAF3DE', borderColor: '#C0DD97', color: '#3B6D11' } },
  { l: '临期', v: '临期', style: { background: '#FAEEDA', borderColor: '#FAC775', color: '#854F0B' } },
  { l: '过期', v: '过期', style: { background: '#FCEBEB', borderColor: '#F7C1C1', color: '#A32D2D' } }
]

const getHCStatus = (expiry) => {
  if (!expiry) return '无证件'
  const d = new Date(expiry), now = new Date()
  if (d < now) return '过期'
  const diff = Math.ceil((d - now) / 86400000)
  return diff <= 30 ? '临期' : '正常'
}

const form = reactive({ name: '', department: '', position: '', phone: '', entry_date: '', health_cert_expiry: '', status: '在职', remarks: '' })

const fetchData = async () => {
  loading.value = true
  try {
    const [pRes, hRes] = await Promise.all([
      request.get('/personnel', { params: { user_id: userId } }),
      request.get('/health-certs', { params: { user_id: userId } })
    ])
    const persons = pRes.list || []
    const healths = hRes.list || []

    // 统计
    stats.total = persons.length
    stats.active = persons.filter(p => p.status === '在职').length
    stats.expiringSoon = 0; stats.expired = 0

    // 合并数据
    const merged = persons.map(p => {
      const hc = healths.find(h => h.employee_name === p.name)
      const hcStatus = getHCStatus(hc?.expiry_date || p.health_cert_expiry)
      if (hcStatus === '临期') stats.expiringSoon++
      if (hcStatus === '过期') stats.expired++
      return {
        ...p,
        health_cert_expiry: hc?.expiry_date || p.health_cert_expiry || '',
        hcStatus,
        hcLabel: hcStatus === '正常' ? '正常' : hcStatus === '临期' ? '临期' : hcStatus === '过期' ? '过期' : '无证件',
        hcCls: hcStatus === '正常' ? 'normal' : hcStatus === '临期' ? 'warn' : hcStatus === '过期' ? 'danger' : 'none',
        statusCls: p.status === '在职' ? 'active' : p.status === '试用期' ? 'trial' : 'leave',
        hcData: hc
      }
    })

    depts.value = [...new Set(persons.map(p => p.department).filter(Boolean))]

    // 筛选
    let result = merged
    if (filterStatus.value !== '全部') result = result.filter(r => r.status === filterStatus.value)
    if (filterHealth.value !== '全部') result = result.filter(r => r.hcStatus === filterHealth.value)
    if (filterDept.value) result = result.filter(r => r.department === filterDept.value)
    if (keyword.value) {
      const kw = keyword.value.toLowerCase()
      result = result.filter(r => (r.name||'').includes(kw) || (r.employee_number||'').includes(kw) || (r.position||'').includes(kw))
    }
    list.value = result
  } catch (e) { console.error('[人员] 加载失败:', e) } finally { loading.value = false }
}

const toggleCard = (card) => {
  activeCard.value = activeCard.value === card ? '' : card
  if (card === 'total') { filterStatus.value = '全部'; filterHealth.value = '全部' }
  else if (card === 'active') { filterStatus.value = '在职' }
  else if (card === 'expiring') { filterHealth.value = '临期' }
  else if (card === 'expired') { filterHealth.value = '过期' }
  fetchData()
}

const onExpand = (row, rows) => { expandedRows.value = rows.map(r => r.id) }
const openAdd = () => { editingId.value = null; resetForm(); showForm.value = true }
const editRow = (row) => {
  editingId.value = row.id
  Object.assign(form, { name: row.name, department: row.department, position: row.position, phone: row.phone, entry_date: row.entry_date, health_cert_expiry: row.health_cert_expiry, status: row.status, remarks: row.remarks || '' })
  showForm.value = true
}
const showDetail = (row) => ElMessageBox.alert(`姓名：${row.name}\n部门：${row.department}\n职位：${row.position}\n电话：${row.phone}\n入职：${row.entry_date}\n健康证到期：${row.health_cert_expiry}\n状态：${row.hcLabel}`, '人员详情')
const viewFiles = (row) => ElMessage.info('附件功能开发中')
const exportExcel = () => ElMessage.info('导出功能开发中')
const onSelectionChange = (rows) => { selectedRows.value = rows }
const clearFilters = () => { keyword.value='';filterStatus.value='全部';filterHealth.value='全部';filterDept.value='';activeCard.value='';fetchData() }
const batchExport = () => ElMessage.info(`已选${selectedRows.value.length}项，导出开发中`)
const batchUpdateHC = () => ElMessage.info(`已选${selectedRows.value.length}人，批量更新健康证开发中`)

const resetForm = () => {
  Object.assign(form, { name: '', department: '', position: '', phone: '', entry_date: '', health_cert_expiry: '', status: '在职', remarks: '' })
  aiText.value = ''
}

const save = async () => {
  if (!form.name) return ElMessage.warning('请填写姓名')
  saving.value = true
  try {
    if (editingId.value) {
      await axios.put(`/api/personnel/${editingId.value}`, { user_id: userId, ...form })
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/personnel', { user_id: userId, ...form })
      ElMessage.success('添加成功')
    }
    showForm.value = false; resetForm()
    await fetchData()
  } catch (e) { ElMessage.error(e.response?.data?.message||'操作失败') }
  finally { saving.value = false }
}

const aiFill = async () => {
  if (!aiText.value.trim()) return
  aiLoading.value = true
  try {
    const res = await axios.post('/api/ai/extract-person', { text: aiText.value })
    if (res.data.method === 'ai') {
      if (res.data.name) form.name = res.data.name
      if (res.data.department) form.department = res.data.department
      if (res.data.position) form.position = res.data.position
      if (res.data.phone) form.phone = res.data.phone
      if (res.data.health_cert_expiry) form.health_cert_expiry = res.data.health_cert_expiry
      if (res.data.entry_date) form.entry_date = res.data.entry_date
      aiText.value = ''
      ElMessage.success('AI已填写，请核对')
    }
  } catch { ElMessage.error('AI异常') }
  finally { aiLoading.value = false }
}

onMounted(fetchData)
</script>

<style scoped>
.personnel-page{padding:0}
.page-hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px}
.page-hd h1{font-size:18px;font-weight:500;color:#222;margin:0}
.sub{font-size:12px;color:#888;margin-left:8px}
.hd-btns{display:flex;gap:8px}
.btn-ghost{height:32px;background:white;border:0.5px solid #d0d0d0;color:#555;border-radius:7px}
.btn-main{height:32px;background:#378ADD;color:#fff;font-weight:500;border-radius:7px;border:none}

/* 统计卡 */
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.stat-card{border-radius:10px;padding:14px 12px;color:white;cursor:pointer;transition:all .2s;position:relative}
.stat-card:hover{opacity:.9}
.stat-card.active{box-shadow:0 0 0 3px rgba(255,255,255,.5),0 0 0 5px currentColor}
.card-blue{background:#378ADD}.card-green{background:#4caf7d}.card-orange{background:#EF9F27}.card-red{background:#E24B4A}
.stat-num{font-size:26px;font-weight:500}
.stat-lbl{font-size:11px;opacity:.9;margin-top:2px}

/* 筛选 */
.filter-bar{margin-bottom:12px;display:flex;flex-direction:column;gap:8px}
.filter-row,.filter-row2{display:flex;align-items:center;gap:6px;flex-wrap:wrap}
.f-label{font-size:12px;color:#888;margin-right:2px}
.f-sep{color:#ddd;margin:0 4px}
.f-tag{font-size:12px;padding:4px 12px;border-radius:20px;cursor:pointer;border:1px solid transparent;background:#f5f6f8;color:#666;transition:all .2s}
.f-tag:hover{border-color:#ccc}

/* 表格 */
.table-wrap{background:white;border-radius:10px;border:0.5px solid #e0e0e0;overflow:hidden}
:deep(.el-table th){font-size:12px;color:#888;font-weight:400;background:#fafafa}
:deep(.el-table td){font-size:13px}
:deep(.el-table__body tr:hover td){background:#f7f9fc}
.name-cell{font-weight:500}
.expand-panel{display:flex;align-items:center;gap:16px;padding:8px 16px;background:#FAFBFD;font-size:13px}
.btn-renew{border:1px solid #EF9F27;color:#854F0B;background:#fff8f0}
.btn-update{border:1px solid #E24B4A;color:#A32D2D;background:#fff5f5}
.btn-file{border:1px solid #d0d0d0;color:#555}

/* 标签 */
.tag{font-size:11px;font-weight:500;padding:2px 8px;border-radius:5px}
.tag-active{background:#EAF3DE;color:#3B6D11}
.tag-leave{background:#f3f4f6;color:#9ca3af}
.tag-trial{background:#dbeafe;color:#1e40af}
.tag-normal{background:#EAF3DE;color:#3B6D11}
.tag-warn{background:#FAEEDA;color:#854F0B}
.tag-danger{background:#FCEBEB;color:#A32D2D}
.tag-none{background:#f3f4f6;color:#bbb}

/* 日期着色 */
.date-临期{color:#EF9F27;font-weight:500}
.date-过期{color:#E24B4A;font-weight:500}

.ai-fill-bar{margin-bottom:12px;padding:10px;background:#f0fdf4;border-radius:8px;border:1px solid #bbf7d0}
.ai-fill-bar .el-button{width:100%}
.ai-fill-bar :deep(.el-textarea__inner){font-size:13px}

/* 批量操作栏 */
.batch-bar{position:sticky;bottom:0;background:white;border-top:0.5px solid #e0e0e0;padding:8px 16px;display:flex;align-items:center;gap:12px;border-radius:0 0 10px 10px;margin-top:-1px;z-index:10}
.batch-bar span{font-size:13px;color:#666;font-weight:500}

/* 展开行过期标记 */
.expand-panel.hc-expired{background:#FFF5F5}
.expand-panel.hc-expiring{background:#FFFBF0}
</style>
