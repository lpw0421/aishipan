<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>培训记录</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索员工/编号..." clearable style="width:200px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="typeFilter" placeholder="培训类型" clearable style="width:120px;margin-right:8px" @change="currentPage=1">
          <el-option v-for="t in types" :key="t" :label="t" :value="t" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增记录</el-button>
      </div>
    </div>
    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="员工姓名" prop="employee_name" width="100" />
        <el-table-column label="部门" prop="department" width="100" />
        <el-table-column label="培训类型" prop="training_type" width="100" />
        <el-table-column label="培训日期" width="110"><template #default="{row}">{{ row.training_date || '-' }}</template></el-table-column>
        <el-table-column label="讲师" prop="trainer" width="80" />
        <el-table-column label="学时" prop="duration" width="70" />
        <el-table-column label="签到" width="80"><template #default="{row}"><el-tag :type="row.attendance==='已签到'?'success':row.attendance==='请假'?'warning':'info'" size="small">{{ row.attendance }}</el-tag></template></el-table-column>
        <el-table-column label="成绩" width="80"><template #default="{row}">{{ row.exam_score != null ? row.exam_score+'分' : '-' }}</template></el-table-column>
        <el-table-column label="考核结果" width="90"><template #default="{row}"><el-tag v-if="row.exam_result==='合格'" type="success" size="small">合格</el-tag><el-tag v-else-if="row.exam_result==='不合格'" type="danger" size="small">不合格</el-tag><span v-else style="color:#c0c4cc">-</span></template></el-table-column>
        <el-table-column label="附件" width="70">
          <template #default="{row}"><el-button v-if="getPaths(row).length>0" type="primary" link size="small" @click="preview(row)">查看</el-button><span v-else style="color:#c0c4cc">无</span></template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}"><el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button><el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无记录" />
      <div v-if="filteredList.length>10" class="pagination-wrap"><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background /></div>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="550px">
      <el-form :model="form" label-width="80px">
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="员工姓名"><el-input v-model="form.employee_name" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="部门"><el-input v-model="form.department" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="培训类型"><el-select v-model="form.training_type" style="width:100%"><el-option v-for="t in types" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="培训日期"><el-date-picker v-model="form.training_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="讲师"><el-input v-model="form.trainer" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="学时"><el-input v-model="form.duration" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="签到状态"><el-select v-model="form.attendance" style="width:100%"><el-option label="已签到" value="已签到" /><el-option label="未签到" value="未签到" /><el-option label="请假" value="请假" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="考核成绩"><el-input-number v-model="form.exam_score" :min="0" :max="100" style="width:100%" /></el-form-item></el-col></el-row>
        <el-form-item label="考核结果"><el-select v-model="form.exam_result" style="width:100%"><el-option label="合格" value="合格" /><el-option label="不合格" value="不合格" /><el-option label="-" value="" /></el-select></el-form-item>
        <el-form-item label="上传附件"><el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text"><div class="el-upload__text">拖拽文件 或 <em>点击选择</em></div><template #tip><div class="upload-tip">签到表、现场照片</div></template></el-upload></el-form-item>
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
const types = ['入职培训','在岗复训','专项培训','外部培训']
const getPaths = (r) => { try { return JSON.parse(r.file_paths||'[]') } catch { return [] } }
const list = ref([]); const loading = ref(false); const keyword = ref(''); const typeFilter = ref(''); const currentPage = ref(1); const pageSize = ref(10); const selectedIds = ref([])
const filteredList = computed(() => { let r = list.value; if (keyword.value) { const kw = keyword.value.toLowerCase(); r = r.filter(x => (x.employee_name||'').includes(kw) || (x.record_number||'').includes(kw)) }; if (typeFilter.value) r = r.filter(x => x.training_type === typeFilter.value); return r })
const pagedList = computed(() => filteredList.value.slice((currentPage.value-1)*pageSize.value, currentPage.value*pageSize.value))
const fetchList = async () => { loading.value = true; try { const u = JSON.parse(localStorage.getItem('user')); const p = { user_id: u.id }; if (typeFilter.value) p.training_type = typeFilter.value; if (keyword.value) p.keyword = keyword.value; const res = await request.get('/training/records', { params: p }); list.value = res.list } catch {} finally { loading.value = false } }
onMounted(fetchList)
const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }
const handleDelete = async (id) => { try { await ElMessageBox.confirm('确认删除？','删除',{type:'warning'}) } catch { return }; try { const u = JSON.parse(localStorage.getItem('user')); await axios.delete('/api/training/records/'+id,{data:{user_id:u.id}}); ElMessage.success('已删除'); fetchList() } catch { ElMessage.error('失败') } }
const preview = (row) => { getPaths(row).forEach(p => window.open(p,'_blank')) }
const dialogVisible = ref(false); const dialogTitle = ref('新增记录'); const editId = ref(null); const uploadRef = ref(null); const newFiles = ref([]); const existingFilesList = ref([]); const submitting = ref(false)
const form = reactive({ employee_name:'', department:'', training_type:'在岗复训', training_date:'', trainer:'', duration:'', attendance:'已签到', exam_score:null, exam_result:'' })
const openAddDialog = () => { dialogTitle.value='新增记录'; editId.value=null; Object.assign(form,{employee_name:'',department:'',training_type:'在岗复训',training_date:'',trainer:'',duration:'',attendance:'已签到',exam_score:null,exam_result:''}); newFiles.value=[]; existingFilesList.value=[]; if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const openEditDialog = (row) => { dialogTitle.value='编辑记录'; editId.value=row.id; Object.assign(form,{employee_name:row.employee_name,department:row.department,training_type:row.training_type,training_date:row.training_date,trainer:row.trainer,duration:row.duration,attendance:row.attendance,exam_score:row.exam_score,exam_result:row.exam_result}); newFiles.value=[]; existingFilesList.value=getPaths(row).map((p,i)=>({name:p.split('/').pop(),url:p,uid:i})); if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const handleFileChange = (f) => { newFiles.value.push(f.raw) }
const handleFileRemove = (f) => { const i = existingFilesList.value.findIndex(x => x.uid===f.uid); if(i>=0) existingFilesList.value.splice(i,1) }
const handleSubmit = async () => { if(!form.employee_name) { ElMessage.warning('请填写员工姓名'); return }; submitting.value=true; try { const u = JSON.parse(localStorage.getItem('user')); const fd = new FormData(); fd.append('user_id',u.id); Object.keys(form).forEach(k => fd.append(k,form[k]!=null?form[k]:'')); fd.append('existing_files',JSON.stringify(existingFilesList.value.map(f=>f.url))); newFiles.value.forEach(f => fd.append('files',f)); if(editId.value) { await axios.put('/api/training/records/'+editId.value,fd); ElMessage.success('更新成功') } else { await axios.post('/api/training/records',fd); ElMessage.success('添加成功') }; dialogVisible.value=false; fetchList() } catch { ElMessage.error('失败') } finally { submitting.value=false } }
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; } .toolbar h2 { margin: 0; color: #303133; } .toolbar-right { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; } .upload-tip { color: #909399; font-size: 12px; margin-top: 4px; } .pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
