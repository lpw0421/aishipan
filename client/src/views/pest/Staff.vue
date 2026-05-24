<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>虫害服务人员管理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索姓名/工号..." clearable style="width:240px;margin-right:10px" @input="currentPage=1" />
        <el-button type="primary" @click="openStaffDialog()">添加人员</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="8"><el-card shadow="hover" class="stat-card"><div class="stat-num">{{ staffList.length }}</div><div class="stat-label">总人数</div></el-card></el-col>
      <el-col :span="8"><el-card shadow="hover" class="stat-card stat-valid"><div class="stat-num">{{ staffList.filter(s => s.healthStatus === 'valid' && s.trainingStatus === 'valid').length }}</div><div class="stat-label">证件正常</div></el-card></el-col>
      <el-col :span="8"><el-card shadow="hover" class="stat-card stat-warning"><div class="stat-num">{{ staffList.filter(s => s.healthStatus === 'expiring_soon' || s.healthStatus === 'expired' || s.trainingStatus === 'expiring_soon' || s.trainingStatus === 'expired').length }}</div><div class="stat-label">证件异常</div></el-card></el-col>
    </el-row>

    <el-card>
      <el-table :data="pagedStaffList" stripe v-loading="loading" @selection-change="onSelectionChange" @row-click="showStaffCerts" highlight-current-row>
        <el-table-column type="selection" width="45" />
        <el-table-column label="姓名" prop="name" min-width="100" />
        <el-table-column label="工号" prop="employee_number" width="120" />
        <el-table-column label="电话" prop="phone" width="140" />
        <el-table-column label="健康证到期" width="120">
          <template #default="{row}">{{ row.healthExpiry || '-' }}</template>
        </el-table-column>
        <el-table-column label="培训证到期" width="120">
          <template #default="{row}">{{ row.trainingExpiry || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{row}">
            <el-tag v-if="row.healthStatus==='expired'||row.trainingStatus==='expired'" type="danger" size="small">已过期</el-tag>
            <el-tag v-else-if="row.healthStatus==='expiring_soon'||row.trainingStatus==='expiring_soon'" type="warning" size="small">临期</el-tag>
            <el-tag v-else type="success" size="small">正常</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="180" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click.stop="openStaffDialog(row)">编辑</el-button>
            <el-button type="success" link size="small" @click.stop="openCertDialog(row)">添加证件</el-button>
            <el-button type="danger" link size="small" @click.stop="handleDeleteStaff(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 选中人员的证件列表 -->
    <el-card v-if="selectedStaff" style="margin-top:16px">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">
        <h3 style="margin:0">{{ selectedStaff.name }} 的证件</h3>
        <el-button type="primary" size="small" @click="openCertDialog(selectedStaff)">添加证件</el-button>
      </div>
      <el-table :data="staffCerts" stripe size="small">
        <el-table-column label="证件类型" width="110">
          <template #default="{row}">{{ row.cert_type==='health'?'健康证':'培训合格证' }}</template>
        </el-table-column>
        <el-table-column label="证件名称" prop="cert_name" min-width="150" />
        <el-table-column label="发证机构" prop="issuing_agency" width="150" />
        <el-table-column label="编号" prop="cert_number" width="150" />
        <el-table-column label="发证日期" width="110">
          <template #default="{row}">{{ row.issue_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="到期日期" width="110">
          <template #default="{row}">{{ row.expiry_date || '-' }}</template>
        </el-table-column>
        <el-table-column label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="getStatus(row.expiry_date)==='expired'?'danger':getStatus(row.expiry_date)==='expiring_soon'?'warning':'success'" size="small">
              {{ getStatus(row.expiry_date)==='expired'?'过期':getStatus(row.expiry_date)==='expiring_soon'?'临期':'正常' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="附件" width="70">
          <template #default="{row}">
            <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
            <span v-else style="color:#c0c4cc">无</span>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openCertDialog(selectedStaff, row)">编辑</el-button>
            <el-button type="danger" link size="small" @click="handleDeleteCert(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 人员对话框 -->
    <el-dialog v-model="staffDialogVisible" :title="staffDialogTitle" width="450px">
      <el-form :model="staffForm" label-width="80px">
        <el-form-item label="姓名"><el-input v-model="staffForm.name" placeholder="人员姓名" /></el-form-item>
        <el-form-item label="工号"><el-input v-model="staffForm.employee_number" placeholder="工号" /></el-form-item>
        <el-form-item label="电话"><el-input v-model="staffForm.phone" placeholder="联系电话" /></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="staffDialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleStaffSubmit" :loading="staffSubmitting">确定</el-button>
      </template>
    </el-dialog>

    <!-- 证件对话框 -->
    <el-dialog v-model="certDialogVisible" :title="certDialogTitle" width="550px">
      <el-form :model="certForm" label-width="80px">
        <el-form-item label="证件类型">
          <el-select v-model="certForm.cert_type" style="width:100%">
            <el-option label="健康证" value="health" />
            <el-option label="培训合格证" value="training" />
          </el-select>
        </el-form-item>
        <el-form-item label="证件名称"><el-input v-model="certForm.cert_name" placeholder="证件名称" /></el-form-item>
        <el-form-item label="发证机构"><el-input v-model="certForm.issuing_agency" placeholder="发证机构" /></el-form-item>
        <el-form-item label="编号"><el-input v-model="certForm.cert_number" placeholder="证件编号" /></el-form-item>
        <el-form-item label="发证日期">
          <el-date-picker v-model="certForm.issue_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="发证日期" />
        </el-form-item>
        <el-form-item label="到期日期">
          <el-date-picker v-model="certForm.expiry_date" type="date" value-format="YYYY-MM-DD" style="width:100%" placeholder="到期日期" />
        </el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="certUploadRef" drag :auto-upload="false" :limit="5" :on-change="handleCertFileChange" :on-remove="handleCertFileRemove" :file-list="certExistingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
          </el-upload>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="certDialogVisible=false">取消</el-button>
        <el-button type="primary" @click="handleCertSubmit" :loading="certSubmitting">确定</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'

const staffList = ref([])
const allCerts = ref([])
const loading = ref(false)
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])
const selectedStaff = ref(null)
const staffCerts = ref([])

const getStatus = (expiryDate) => {
  if (!expiryDate) return 'valid'
  const diff = Math.ceil((new Date(expiryDate) - new Date()) / (1000 * 60 * 60 * 24))
  if (diff < 0) return 'expired'
  if (diff <= 30) return 'expiring_soon'
  return 'valid'
}

const getFilePaths = (row) => {
  try { return JSON.parse(row.file_paths || '[]') } catch { return [] }
}

const filteredStaffList = computed(() => {
  let result = staffList.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(s => s.name.includes(kw) || s.employee_number.includes(kw))
  }
  return result
})

const pagedStaffList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredStaffList.value.slice(start, start + pageSize.value)
})

const fetchData = async () => {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const [staffRes, certsRes] = await Promise.all([
      request.get('/pest/staff', { params: { user_id: user.id } }),
      request.get('/pest/staff-certs', { params: { user_id: user.id } })
    ])
    allCerts.value = certsRes.list
    staffList.value = staffRes.list.map(s => {
      const healthCerts = certsRes.list.filter(c => c.staff_id === s.id && c.cert_type === 'health')
      const trainingCerts = certsRes.list.filter(c => c.staff_id === s.id && c.cert_type === 'training')
      const latestHealth = healthCerts.sort((a, b) => new Date(b.expiry_date) - new Date(a.expiry_date))[0]
      const latestTraining = trainingCerts.sort((a, b) => new Date(b.expiry_date) - new Date(a.expiry_date))[0]
      return {
        ...s,
        healthExpiry: latestHealth ? latestHealth.expiry_date : '',
        trainingExpiry: latestTraining ? latestTraining.expiry_date : '',
        healthStatus: latestHealth ? getStatus(latestHealth.expiry_date) : 'valid',
        trainingStatus: latestTraining ? getStatus(latestTraining.expiry_date) : 'valid'
      }
    })
  } catch {} finally { loading.value = false }
}

onMounted(fetchData)

const showStaffCerts = (row) => {
  selectedStaff.value = row
  staffCerts.value = allCerts.value.filter(c => c.staff_id === row.id)
}

const onSelectionChange = (rows) => {
  selectedIds.value = rows.map(r => r.id)
}

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 名人员？将同时删除其所有证件`, '批量删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/pest/staff/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    selectedStaff.value = null
    staffCerts.value = []
    fetchData()
  } catch { ElMessage.error('批量删除失败') }
}

const handleDeleteStaff = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除该人员？将同时删除其所有证件', '删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete(`/api/pest/staff/${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    if (selectedStaff.value?.id === id) { selectedStaff.value = null; staffCerts.value = [] }
    fetchData()
  } catch { ElMessage.error('删除失败') }
}

const handleDeleteCert = async (id) => {
  try {
    await ElMessageBox.confirm('确认删除该证件？', '删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.delete(`/api/pest/staff-certs/${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    fetchData()
    if (selectedStaff.value) {
      staffCerts.value = allCerts.value.filter(c => c.staff_id === selectedStaff.value.id)
    }
  } catch { ElMessage.error('删除失败') }
}

const previewFiles = (row) => {
  getFilePaths(row).forEach(p => window.open(p, '_blank'))
}

// 人员对话框
const staffDialogVisible = ref(false)
const staffDialogTitle = ref('添加人员')
const editStaffId = ref(null)
const staffSubmitting = ref(false)
const staffForm = reactive({ name: '', employee_number: '', phone: '' })

const openStaffDialog = (row) => {
  if (row) {
    staffDialogTitle.value = '编辑人员'
    editStaffId.value = row.id
    Object.assign(staffForm, { name: row.name, employee_number: row.employee_number, phone: row.phone })
  } else {
    staffDialogTitle.value = '添加人员'
    editStaffId.value = null
    Object.assign(staffForm, { name: '', employee_number: '', phone: '' })
  }
  staffDialogVisible.value = true
}

const handleStaffSubmit = async () => {
  if (!staffForm.name) { ElMessage.warning('请填写姓名'); return }
  staffSubmitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    if (editStaffId.value) {
      await axios.put(`/api/pest/staff/${editStaffId.value}`, { user_id: user.id, ...staffForm })
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/pest/staff', { user_id: user.id, ...staffForm })
      ElMessage.success('添加成功')
    }
    staffDialogVisible.value = false
    fetchData()
  } catch { ElMessage.error('操作失败') } finally { staffSubmitting.value = false }
}

// 证件对话框
const certDialogVisible = ref(false)
const certDialogTitle = ref('添加证件')
const editCertId = ref(null)
const currentStaffForCert = ref(null)
const certUploadRef = ref(null)
const certNewFiles = ref([])
const certExistingFilesList = ref([])
const certSubmitting = ref(false)
const certForm = reactive({ cert_type: 'health', cert_name: '', issuing_agency: '', cert_number: '', issue_date: '', expiry_date: '' })

const openCertDialog = (staff, cert) => {
  currentStaffForCert.value = staff
  if (cert) {
    certDialogTitle.value = '编辑证件'
    editCertId.value = cert.id
    Object.assign(certForm, {
      cert_type: cert.cert_type, cert_name: cert.cert_name, issuing_agency: cert.issuing_agency,
      cert_number: cert.cert_number, issue_date: cert.issue_date, expiry_date: cert.expiry_date
    })
    certNewFiles.value = []
    const paths = getFilePaths(cert)
    certExistingFilesList.value = paths.map((p, i) => ({ name: p.split('/').pop(), url: p, uid: i }))
  } else {
    certDialogTitle.value = '添加证件'
    editCertId.value = null
    Object.assign(certForm, { cert_type: 'health', cert_name: '', issuing_agency: '', cert_number: '', issue_date: '', expiry_date: '' })
    certNewFiles.value = []
    certExistingFilesList.value = []
  }
  if (certUploadRef.value) certUploadRef.value.clearFiles()
  certDialogVisible.value = true
}

const handleCertFileChange = (file) => { certNewFiles.value.push(file.raw) }
const handleCertFileRemove = (file) => {
  const idx = certExistingFilesList.value.findIndex(f => f.uid === file.uid)
  if (idx >= 0) certExistingFilesList.value.splice(idx, 1)
}

const handleCertSubmit = async () => {
  if (!certForm.cert_name) { ElMessage.warning('请填写证件名称'); return }
  certSubmitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)
    fd.append('staff_id', currentStaffForCert.value.id)
    fd.append('cert_type', certForm.cert_type)
    fd.append('cert_name', certForm.cert_name)
    fd.append('issuing_agency', certForm.issuing_agency)
    fd.append('cert_number', certForm.cert_number)
    fd.append('issue_date', certForm.issue_date)
    fd.append('expiry_date', certForm.expiry_date)
    fd.append('existing_files', JSON.stringify(certExistingFilesList.value.map(f => f.url)))
    certNewFiles.value.forEach(f => fd.append('files', f))

    if (editCertId.value) {
      await axios.put(`/api/pest/staff-certs/${editCertId.value}`, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/pest/staff-certs', fd)
      ElMessage.success('添加成功')
    }
    certDialogVisible.value = false
    fetchData()
    if (selectedStaff.value) {
      // Will be refreshed after fetchData completes
      setTimeout(() => {
        staffCerts.value = allCerts.value.filter(c => c.staff_id === selectedStaff.value?.id)
      }, 500)
    }
  } catch { ElMessage.error('操作失败') } finally { certSubmitting.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.stat-card { cursor: pointer; text-align: center; }
.stat-num { font-size: 28px; font-weight: bold; color: #303133; }
.stat-label { font-size: 13px; color: #909399; margin-top: 4px; }
.stat-valid .stat-num { color: #67c23a; }
.stat-warning .stat-num { color: #e6a23c; }
</style>
