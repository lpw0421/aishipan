<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>服务记录与趋势分析</h2>
      <div class="toolbar-right">
        <el-input v-if="activeTab==='inspections'" v-model="keyword" placeholder="搜索人员/区域/问题..." clearable style="width:240px;margin-right:10px" @input="currentPage=1" />
        <el-button type="primary" @click="openAddDialog()">添加{{ tabLabel }}</el-button>
        <el-button v-if="activeTab==='inspections'&&selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
        <el-button v-if="activeTab==='inspections'" @click="handleExport">导出Excel</el-button>
      </div>
    </div>

    <el-card>
      <el-tabs v-model="activeTab" @tab-change="currentPage=1">
        <el-tab-pane :label="'布防图 ('+maps.length+')'" name="maps" />
        <el-tab-pane :label="'检查记录 ('+inspections.length+')'" name="inspections" />
        <el-tab-pane :label="'月度报告 ('+reports.length+')'" name="reports" />
      </el-tabs>

      <!-- 布防图 -->
      <template v-if="activeTab==='maps'">
        <el-table :data="maps" stripe v-loading="loading">
          <el-table-column label="图名称" prop="map_name" min-width="180" />
          <el-table-column label="版本" prop="version" width="100" />
          <el-table-column label="覆盖区域" prop="coverage_area" min-width="200" />
          <el-table-column label="上传日期" width="120">
            <template #default="{row}">{{ row.created_at?.slice(0,10) || '-' }}</template>
          </el-table-column>
          <el-table-column label="附件" width="80">
            <template #default="{row}">
              <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
              <span v-else style="color:#c0c4cc">无</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{row}">
              <el-button type="primary" link size="small" @click="openEditDialog('map',row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDelete('map',row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>

      <!-- 检查记录 -->
      <template v-if="activeTab==='inspections'">
        <el-table :data="pagedInspections" stripe v-loading="loading" @selection-change="onSelectionChange">
          <el-table-column type="selection" width="45" />
          <el-table-column label="检查日期" prop="inspection_date" width="110" sortable />
          <el-table-column label="检查人员" prop="inspector" width="100" />
          <el-table-column label="检查区域" prop="area" width="120" />
          <el-table-column label="发现问题" prop="findings_type" min-width="150" />
          <el-table-column label="数量" prop="findings_count" width="80" />
          <el-table-column label="处理措施" prop="measures" min-width="150" />
          <el-table-column label="下次检查" prop="next_inspection_date" width="110" />
          <el-table-column label="附件" width="70">
            <template #default="{row}">
              <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
              <span v-else style="color:#c0c4cc">无</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{row}">
              <el-button type="primary" link size="small" @click="openEditDialog('inspection',row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDelete('inspection',row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
        <el-empty v-if="!loading && filteredInspections.length===0" description="暂无检查记录" />
        <div v-if="filteredInspections.length>10" class="pagination-wrap">
          <el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredInspections.length" background />
        </div>
      </template>

      <!-- 月度报告 -->
      <template v-if="activeTab==='reports'">
        <el-table :data="reports" stripe v-loading="loading">
          <el-table-column label="报告月份" prop="report_month" width="120" sortable />
          <el-table-column label="编制人" prop="author" width="100" />
          <el-table-column label="总结摘要" prop="summary" min-width="250" />
          <el-table-column label="改进建议" prop="improvements" min-width="200" />
          <el-table-column label="附件" width="80">
            <template #default="{row}">
              <el-button v-if="getFilePaths(row).length>0" type="primary" link size="small" @click="previewFiles(row)">查看</el-button>
              <span v-else style="color:#c0c4cc">无</span>
            </template>
          </el-table-column>
          <el-table-column label="操作" width="120">
            <template #default="{row}">
              <el-button type="primary" link size="small" @click="openEditDialog('report',row)">编辑</el-button>
              <el-button type="danger" link size="small" @click="handleDelete('report',row.id)">删除</el-button>
            </template>
          </el-table-column>
        </el-table>
      </template>
    </el-card>

    <!-- 通用对话框 -->
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="600px">
      <!-- 布防图表单 -->
      <el-form v-if="editType==='map'" :model="mapForm" label-width="80px">
        <el-form-item label="图名称"><el-input v-model="mapForm.map_name" placeholder="布防图名称" /></el-form-item>
        <el-form-item label="版本"><el-input v-model="mapForm.version" placeholder="版本号" /></el-form-item>
        <el-form-item label="覆盖区域"><el-input v-model="mapForm.coverage_area" type="textarea" :rows="2" placeholder="覆盖的区域" /></el-form-item>
        <el-form-item label="上传附件">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
          </el-upload>
        </el-form-item>
      </el-form>

      <!-- 检查记录表单 -->
      <el-form v-if="editType==='inspection'" :model="inspForm" label-width="80px">
        <el-form-item label="检查日期"><el-date-picker v-model="inspForm.inspection_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="检查人员"><el-input v-model="inspForm.inspector" placeholder="检查人员" /></el-form-item>
        <el-form-item label="检查区域"><el-input v-model="inspForm.area" placeholder="检查区域" /></el-form-item>
        <el-form-item label="发现问题"><el-input v-model="inspForm.findings_type" placeholder="虫害类型，如：鼠迹、蟑螂" /></el-form-item>
        <el-form-item label="数量"><el-input v-model="inspForm.findings_count" placeholder="发现数量" /></el-form-item>
        <el-form-item label="位置"><el-input v-model="inspForm.findings_location" placeholder="具体位置" /></el-form-item>
        <el-form-item label="处理措施"><el-input v-model="inspForm.measures" type="textarea" :rows="2" placeholder="采取的处理措施" /></el-form-item>
        <el-form-item label="下次检查"><el-date-picker v-model="inspForm.next_inspection_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="现场照片">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
          </el-upload>
        </el-form-item>
      </el-form>

      <!-- 月度报告表单 -->
      <el-form v-if="editType==='report'" :model="reportForm" label-width="80px">
        <el-form-item label="报告月份"><el-input v-model="reportForm.report_month" placeholder="如：2026-05" /></el-form-item>
        <el-form-item label="编制人"><el-input v-model="reportForm.author" placeholder="编制人" /></el-form-item>
        <el-form-item label="总结摘要"><el-input v-model="reportForm.summary" type="textarea" :rows="3" placeholder="本月虫害趋势总结" /></el-form-item>
        <el-form-item label="改进建议"><el-input v-model="reportForm.improvements" type="textarea" :rows="2" placeholder="改进建议" /></el-form-item>
        <el-form-item label="上传报告">
          <el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text">
            <div class="el-upload__text">拖拽文件到此处 或 <em>点击选择</em></div>
          </el-upload>
        </el-form-item>
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

const activeTab = ref('maps')
const maps = ref([])
const inspections = ref([])
const reports = ref([])
const loading = ref(false)
const keyword = ref('')
const currentPage = ref(1)
const pageSize = ref(10)
const selectedIds = ref([])

const tabLabel = computed(() => ({ maps: '布防图', inspections: '检查记录', reports: '月度报告' })[activeTab.value])

const getFilePaths = (row) => {
  try { return JSON.parse(row.file_paths || '[]') } catch { return [] }
}

const filteredInspections = computed(() => {
  let result = inspections.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r => r.inspector.includes(kw) || r.area.includes(kw) || r.findings_type.includes(kw) || r.findings_location.includes(kw))
  }
  return result
})

const pagedInspections = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredInspections.value.slice(start, start + pageSize.value)
})

const fetchData = async () => {
  loading.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const [mapsRes, inspRes, reportsRes] = await Promise.all([
      request.get('/pest/layout-maps', { params: { user_id: user.id } }),
      request.get('/pest/inspections', { params: { user_id: user.id } }),
      request.get('/pest/monthly-reports', { params: { user_id: user.id } })
    ])
    maps.value = mapsRes.list
    inspections.value = inspRes.list
    reports.value = reportsRes.list
  } catch {} finally { loading.value = false }
}

onMounted(fetchData)

const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }

const handleBatchDelete = async () => {
  try {
    await ElMessageBox.confirm(`确认删除选中的 ${selectedIds.value.length} 条记录？`, '批量删除', { type: 'warning' })
  } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    await axios.post('/api/pest/inspections/batch-delete', { user_id: user.id, ids: selectedIds.value })
    ElMessage.success('批量删除成功')
    selectedIds.value = []
    fetchData()
  } catch { ElMessage.error('批量删除失败') }
}

const handleExport = () => {
  const user = JSON.parse(localStorage.getItem('user'))
  let url = `/api/pest/inspections/export?user_id=${user.id}`
  if (selectedIds.value.length > 0) url += '&ids=' + selectedIds.value.join(',')
  window.open(url)
}

const handleDelete = async (type, id) => {
  try { await ElMessageBox.confirm('确认删除？', '删除', { type: 'warning' }) } catch { return }
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const urls = { map: '/pest/layout-maps/', inspection: '/pest/inspections/', report: '/pest/monthly-reports/' }
    await axios.delete(`/api${urls[type]}${id}`, { data: { user_id: user.id } })
    ElMessage.success('已删除')
    fetchData()
  } catch { ElMessage.error('删除失败') }
}

const previewFiles = (row) => { getFilePaths(row).forEach(p => window.open(p, '_blank')) }

// 对话框
const dialogVisible = ref(false)
const dialogTitle = ref('')
const editType = ref('')
const editId = ref(null)
const uploadRef = ref(null)
const newFiles = ref([])
const existingFilesList = ref([])
const submitting = ref(false)

const mapForm = reactive({ map_name: '', version: '', coverage_area: '' })
const inspForm = reactive({ inspection_date: '', inspector: '', area: '', findings_type: '', findings_count: '', findings_location: '', measures: '', next_inspection_date: '' })
const reportForm = reactive({ report_month: '', author: '', summary: '', improvements: '' })

const openAddDialog = () => {
  editId.value = null
  dialogTitle.value = '添加' + tabLabel.value
  editType.value = activeTab.value === 'maps' ? 'map' : activeTab.value === 'inspections' ? 'inspection' : 'report'
  resetForm()
  dialogVisible.value = true
}

const openEditDialog = (type, row) => {
  editId.value = row.id
  editType.value = type
  dialogTitle.value = '编辑' + ({ map: '布防图', inspection: '检查记录', report: '月度报告' })[type]
  if (type === 'map') {
    Object.assign(mapForm, { map_name: row.map_name, version: row.version, coverage_area: row.coverage_area })
  } else if (type === 'inspection') {
    Object.assign(inspForm, {
      inspection_date: row.inspection_date, inspector: row.inspector, area: row.area,
      findings_type: row.findings_type, findings_count: row.findings_count,
      findings_location: row.findings_location, measures: row.measures, next_inspection_date: row.next_inspection_date
    })
  } else {
    Object.assign(reportForm, { report_month: row.report_month, author: row.author, summary: row.summary, improvements: row.improvements })
  }
  newFiles.value = []
  const paths = getFilePaths(row)
  existingFilesList.value = paths.map((p, i) => ({ name: p.split('/').pop(), url: p, uid: i }))
  if (uploadRef.value) uploadRef.value.clearFiles()
  dialogVisible.value = true
}

const resetForm = () => {
  newFiles.value = []
  existingFilesList.value = []
  Object.assign(mapForm, { map_name: '', version: '', coverage_area: '' })
  Object.assign(inspForm, { inspection_date: '', inspector: '', area: '', findings_type: '', findings_count: '', findings_location: '', measures: '', next_inspection_date: '' })
  Object.assign(reportForm, { report_month: '', author: '', summary: '', improvements: '' })
  if (uploadRef.value) uploadRef.value.clearFiles()
}

const handleFileChange = (file) => { newFiles.value.push(file.raw) }
const handleFileRemove = (file) => {
  const idx = existingFilesList.value.findIndex(f => f.uid === file.uid)
  if (idx >= 0) existingFilesList.value.splice(idx, 1)
}

const handleSubmit = async () => {
  submitting.value = true
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const fd = new FormData()
    fd.append('user_id', user.id)

    let url = ''
    if (editType.value === 'map') {
      url = '/pest/layout-maps'
      fd.append('map_name', mapForm.map_name)
      fd.append('version', mapForm.version)
      fd.append('coverage_area', mapForm.coverage_area)
    } else if (editType.value === 'inspection') {
      url = '/pest/inspections'
      fd.append('inspection_date', inspForm.inspection_date)
      fd.append('inspector', inspForm.inspector)
      fd.append('area', inspForm.area)
      fd.append('findings_type', inspForm.findings_type)
      fd.append('findings_count', inspForm.findings_count)
      fd.append('findings_location', inspForm.findings_location)
      fd.append('measures', inspForm.measures)
      fd.append('next_inspection_date', inspForm.next_inspection_date)
    } else {
      url = '/pest/monthly-reports'
      fd.append('report_month', reportForm.report_month)
      fd.append('author', reportForm.author)
      fd.append('summary', reportForm.summary)
      fd.append('improvements', reportForm.improvements)
    }

    fd.append('existing_files', JSON.stringify(existingFilesList.value.map(f => f.url)))
    newFiles.value.forEach(f => fd.append('files', f))

    if (editId.value) {
      await axios.put(`/api${url}/${editId.value}`, fd)
      ElMessage.success('更新成功')
    } else {
      await axios.post(`/api${url}`, fd)
      ElMessage.success('添加成功')
    }
    dialogVisible.value = false
    fetchData()
  } catch { ElMessage.error('操作失败') } finally { submitting.value = false }
}
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
.toolbar-right { display: flex; align-items: center; gap: 8px; }
.pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
