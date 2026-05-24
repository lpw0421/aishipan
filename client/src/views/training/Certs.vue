<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>培训证书管理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索员工/证书编号..." clearable style="width:220px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="typeFilter" placeholder="证书类型" clearable style="width:150px;margin-right:8px" @change="currentPage=1">
          <el-option v-for="t in certTypes" :key="t" :label="t" :value="t" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增证书</el-button>
      </div>
    </div>
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="c in statCards" :key="c.label">
        <el-card shadow="hover" class="stat-card" :class="c.cls">
          <div class="stat-num" :class="c.numCls">{{ c.value }}</div><div class="stat-label">{{ c.label }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="员工姓名" prop="employee_name" width="100" />
        <el-table-column label="证书类型" prop="cert_type" min-width="160" />
        <el-table-column label="发证机构" prop="issuing_agency" width="140" />
        <el-table-column label="发证日期" width="110"><template #default="{row}">{{ row.issue_date || '-' }}</template></el-table-column>
        <el-table-column label="到期时间" width="110"><template #default="{row}">{{ row.expiry_date || '-' }}</template></el-table-column>
        <el-table-column label="状态" width="100">
          <template #default="{row}"><el-tag v-if="row.status==='valid'" type="success" size="small">正常</el-tag><el-tag v-else-if="row.status==='expiring_soon'" type="warning" size="small">临期</el-tag><el-tag v-else type="danger" size="small">已过期</el-tag></template>
        </el-table-column>
        <el-table-column label="附件" width="70"><template #default="{row}"><el-button v-if="getPaths(row).length>0" type="primary" link size="small" @click="preview(row)">查看</el-button><span v-else style="color:#c0c4cc">无</span></template></el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}"><el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button><el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无证书" />
      <div v-if="filteredList.length>10" class="pagination-wrap"><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background /></div>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="80px">
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="员工姓名"><el-input v-model="form.employee_name" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="证书类型"><el-select v-model="form.cert_type" style="width:100%"><el-option v-for="t in certTypes" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="发证机构"><el-input v-model="form.issuing_agency" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="证书编号"><el-input v-model="form.cert_number" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="发证日期"><el-date-picker v-model="form.issue_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="到期时间"><el-date-picker v-model="form.expiry_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col></el-row>
        <el-form-item label="上传附件"><el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text"><div class="el-upload__text">拖拽文件 或 <em>点击选择</em></div><template #tip><div class="upload-tip">证书扫描件</div></template></el-upload></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'
const certTypes = ['食品安全管理员','HACCP内审员','特种作业操作证','外部培训证书']
const getPaths = (r) => { try { return JSON.parse(r.file_paths||'[]') } catch { return [] } }
const list = ref([]); const loading = ref(false); const keyword = ref(''); const typeFilter = ref(''); const currentPage = ref(1); const pageSize = ref(10); const selectedIds = ref([])
const statCards = computed(() => [
  { label:'证书总数', value:list.value.length, cls:'', numCls:'' },
  { label:'有效', value:list.value.filter(r=>r.status==='valid').length, cls:'stat-valid', numCls:'' },
  { label:'临期≤30天', value:list.value.filter(r=>r.status==='expiring_soon').length, cls:'stat-warning', numCls:'' },
  { label:'已过期', value:list.value.filter(r=>r.status==='expired').length, cls:'stat-danger', numCls:'' }
])
const filteredList = computed(() => { let r = list.value; if (keyword.value) { const kw = keyword.value.toLowerCase(); r = r.filter(x => (x.employee_name||'').includes(kw) || (x.cert_number||'').includes(kw)) }; if (typeFilter.value) r = r.filter(x => x.cert_type === typeFilter.value); return r })
const pagedList = computed(() => filteredList.value.slice((currentPage.value-1)*pageSize.value, currentPage.value*pageSize.value))
const fetchList = async () => { loading.value = true; try { const u = JSON.parse(localStorage.getItem('user')); const p = { user_id: u.id }; if (typeFilter.value) p.cert_type = typeFilter.value; if (keyword.value) p.keyword = keyword.value; const res = await request.get('/training/certs', { params: p }); list.value = res.list } catch {} finally { loading.value = false } }
onMounted(fetchList)
const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }
const handleDelete = async (id) => { try { await ElMessageBox.confirm('确认删除？','删除',{type:'warning'}) } catch { return }; try { const u = JSON.parse(localStorage.getItem('user')); await axios.delete('/api/training/certs/'+id,{data:{user_id:u.id}}); ElMessage.success('已删除'); fetchList() } catch { ElMessage.error('失败') } }
const preview = (row) => { getPaths(row).forEach(p => window.open(p,'_blank')) }
const dialogVisible = ref(false); const dialogTitle = ref('新增证书'); const editId = ref(null); const uploadRef = ref(null); const newFiles = ref([]); const existingFilesList = ref([]); const submitting = ref(false)
const form = reactive({ employee_name:'', cert_type:'食品安全管理员', issuing_agency:'', cert_number:'', issue_date:'', expiry_date:'' })
const openAddDialog = () => { dialogTitle.value='新增证书'; editId.value=null; Object.assign(form,{employee_name:'',cert_type:'食品安全管理员',issuing_agency:'',cert_number:'',issue_date:'',expiry_date:''}); newFiles.value=[]; existingFilesList.value=[]; if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const openEditDialog = (row) => { dialogTitle.value='编辑证书'; editId.value=row.id; Object.assign(form,{employee_name:row.employee_name,cert_type:row.cert_type,issuing_agency:row.issuing_agency,cert_number:row.cert_number,issue_date:row.issue_date,expiry_date:row.expiry_date}); newFiles.value=[]; existingFilesList.value=getPaths(row).map((p,i)=>({name:p.split('/').pop(),url:p,uid:i})); if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const handleFileChange = (f) => { newFiles.value.push(f.raw) }
const handleFileRemove = (f) => { const i = existingFilesList.value.findIndex(x => x.uid===f.uid); if(i>=0) existingFilesList.value.splice(i,1) }
const handleSubmit = async () => { if(!form.employee_name) { ElMessage.warning('请填写员工姓名'); return }; submitting.value=true; try { const u = JSON.parse(localStorage.getItem('user')); const fd = new FormData(); fd.append('user_id',u.id); Object.keys(form).forEach(k => fd.append(k,form[k]||'')); fd.append('existing_files',JSON.stringify(existingFilesList.value.map(f=>f.url))); newFiles.value.forEach(f => fd.append('files',f)); if(editId.value) { await axios.put('/api/training/certs/'+editId.value,fd); ElMessage.success('更新成功') } else { await axios.post('/api/training/certs',fd); ElMessage.success('添加成功') }; dialogVisible.value=false; fetchList() } catch { ElMessage.error('失败') } finally { submitting.value=false } }
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; } .toolbar h2 { margin: 0; color: #303133; } .toolbar-right { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; } .stat-card { cursor: pointer; text-align: center; } .stat-num { font-size: 28px; font-weight: bold; color: #303133; } .stat-label { font-size: 13px; color: #909399; margin-top: 4px; } .stat-valid .stat-num { color: #67c23a; } .stat-warning .stat-num { color: #e6a23c; } .stat-danger .stat-num { color: #f56c6c; } .upload-tip { color: #909399; font-size: 12px; margin-top: 4px; } .pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
