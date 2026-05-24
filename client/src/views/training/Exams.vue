<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>考核管理</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索员工/课程..." clearable style="width:200px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="resultFilter" placeholder="考核结果" clearable style="width:100px;margin-right:8px" @change="currentPage=1">
          <el-option label="合格" value="合格" /><el-option label="不合格" value="不合格" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增考核</el-button>
      </div>
    </div>
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="c in statCards" :key="c.label">
        <el-card shadow="hover" class="stat-card" :class="c.cls" @click="resultFilter=c.filter;currentPage=1">
          <div class="stat-num" :class="c.numCls">{{ c.value }}</div><div class="stat-label">{{ c.label }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="员工姓名" prop="employee_name" width="100" />
        <el-table-column label="考核课程" prop="course_name" min-width="160" />
        <el-table-column label="考核方式" prop="exam_method" width="90" />
        <el-table-column label="得分" width="100"><template #default="{row}">{{ row.score }} / {{ row.total_score }}</template></el-table-column>
        <el-table-column label="及格线" width="70"><template #default="{row}">{{ row.pass_score }}分</template></el-table-column>
        <el-table-column label="结果" width="90"><template #default="{row}"><el-tag :type="row.result==='合格'?'success':'danger'" size="small">{{ row.result }}</el-tag></template></el-table-column>
        <el-table-column label="补考次数" prop="retake_count" width="80" />
        <el-table-column label="补考日期" width="110"><template #default="{row}">{{ row.retake_date || '-' }}</template></el-table-column>
        <el-table-column label="补考成绩" width="80"><template #default="{row}">{{ row.retake_score != null ? row.retake_score : '-' }}</template></el-table-column>
        <el-table-column label="附件" width="70"><template #default="{row}"><el-button v-if="getPaths(row).length>0" type="primary" link size="small" @click="preview(row)">查看</el-button><span v-else style="color:#c0c4cc">无</span></template></el-table-column>
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button v-if="row.result==='不合格'&&row.retake_count<2" type="warning" link size="small" @click="recordRetake(row)">补考</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无考核记录" />
      <div v-if="filteredList.length>10" class="pagination-wrap"><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background /></div>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="550px">
      <el-form :model="form" label-width="80px">
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="员工姓名"><el-input v-model="form.employee_name" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="考核课程"><el-input v-model="form.course_name" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="考核方式"><el-select v-model="form.exam_method" style="width:100%"><el-option label="笔试" value="笔试" /><el-option label="实操" value="实操" /><el-option label="口试" value="口试" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="及格线"><el-input-number v-model="form.pass_score" :min="0" :max="100" style="width:100%" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="满分"><el-input-number v-model="form.total_score" :min="0" :max="200" style="width:100%" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="得分"><el-input-number v-model="form.score" :min="0" :max="200" style="width:100%" /></el-form-item></el-col></el-row>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
        <el-form-item label="上传附件"><el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx" list-type="text"><div class="el-upload__text">拖拽文件 或 <em>点击选择</em></div><template #tip><div class="upload-tip">试卷、评分表</div></template></el-upload></el-form-item>
      </el-form>
      <template #footer><el-button @click="dialogVisible=false">取消</el-button><el-button type="primary" @click="handleSubmit" :loading="submitting">确定</el-button></template>
    </el-dialog>
    <!-- 补考弹窗 -->
    <el-dialog v-model="retakeVisible" title="补考记录" width="400px">
      <el-form :model="retakeForm" label-width="80px">
        <el-form-item label="补考日期"><el-date-picker v-model="retakeForm.retake_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item>
        <el-form-item label="补考成绩"><el-input-number v-model="retakeForm.retake_score" :min="0" :max="100" style="width:100%" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="retakeVisible=false">取消</el-button><el-button type="primary" @click="submitRetake" :loading="submitting">确定</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import request from '../../utils/request'
import axios from 'axios'
const getPaths = (r) => { try { return JSON.parse(r.file_paths||'[]') } catch { return [] } }
const list = ref([]); const loading = ref(false); const keyword = ref(''); const resultFilter = ref(''); const currentPage = ref(1); const pageSize = ref(10); const selectedIds = ref([])
const statCards = computed(() => [
  { label:'总考核', value:list.value.length, cls:'', numCls:'', filter:'' },
  { label:'合格', value:list.value.filter(r=>r.result==='合格').length, cls:'stat-valid', numCls:'', filter:'合格' },
  { label:'不合格', value:list.value.filter(r=>r.result==='不合格').length, cls:'stat-danger', numCls:'', filter:'不合格' },
  { label:'待补考', value:list.value.filter(r=>r.result==='不合格'&&r.retake_score==null).length, cls:'stat-warning', numCls:'', filter:'' }
])
const filteredList = computed(() => { let r = list.value; if (keyword.value) { const kw = keyword.value.toLowerCase(); r = r.filter(x => (x.employee_name||'').includes(kw) || (x.course_name||'').includes(kw)) }; if (resultFilter.value) r = r.filter(x => x.result === resultFilter.value); return r })
const pagedList = computed(() => filteredList.value.slice((currentPage.value-1)*pageSize.value, currentPage.value*pageSize.value))
const fetchList = async () => { loading.value = true; try { const u = JSON.parse(localStorage.getItem('user')); const p = { user_id: u.id }; if (resultFilter.value) p.result = resultFilter.value; if (keyword.value) p.keyword = keyword.value; const res = await request.get('/training/exams', { params: p }); list.value = res.list } catch {} finally { loading.value = false } }
onMounted(fetchList)
const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }
const handleDelete = async (id) => { try { await ElMessageBox.confirm('确认删除？','删除',{type:'warning'}) } catch { return }; try { const u = JSON.parse(localStorage.getItem('user')); await axios.delete('/api/training/exams/'+id,{data:{user_id:u.id}}); ElMessage.success('已删除'); fetchList() } catch { ElMessage.error('失败') } }
const preview = (row) => { getPaths(row).forEach(p => window.open(p,'_blank')) }
const dialogVisible = ref(false); const dialogTitle = ref('新增考核'); const editId = ref(null); const uploadRef = ref(null); const newFiles = ref([]); const existingFilesList = ref([]); const submitting = ref(false)
const form = reactive({ employee_name:'', course_name:'', exam_method:'笔试', total_score:100, score:0, pass_score:80, remark:'' })
const openAddDialog = () => { dialogTitle.value='新增考核'; editId.value=null; Object.assign(form,{employee_name:'',course_name:'',exam_method:'笔试',total_score:100,score:0,pass_score:80,remark:''}); newFiles.value=[]; existingFilesList.value=[]; if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const openEditDialog = (row) => { dialogTitle.value='编辑考核'; editId.value=row.id; Object.assign(form,{employee_name:row.employee_name,course_name:row.course_name,exam_method:row.exam_method,total_score:row.total_score,score:row.score,pass_score:row.pass_score,remark:row.remark}); newFiles.value=[]; existingFilesList.value=getPaths(row).map((p,i)=>({name:p.split('/').pop(),url:p,uid:i})); if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const handleFileChange = (f) => { newFiles.value.push(f.raw) }
const handleFileRemove = (f) => { const i = existingFilesList.value.findIndex(x => x.uid===f.uid); if(i>=0) existingFilesList.value.splice(i,1) }
const handleSubmit = async () => { if(!form.employee_name) { ElMessage.warning('请填写员工姓名'); return }; submitting.value=true; try { const u = JSON.parse(localStorage.getItem('user')); const fd = new FormData(); fd.append('user_id',u.id); Object.keys(form).forEach(k => fd.append(k,form[k]!=null?form[k]:'')); const r = form.score >= form.pass_score ? '合格' : '不合格'; fd.append('result',r); fd.append('existing_files',JSON.stringify(existingFilesList.value.map(f=>f.url))); newFiles.value.forEach(f => fd.append('files',f)); if(editId.value) { await axios.put('/api/training/exams/'+editId.value,fd); ElMessage.success('更新成功') } else { await axios.post('/api/training/exams',fd); ElMessage.success('添加成功') }; dialogVisible.value=false; fetchList() } catch { ElMessage.error('失败') } finally { submitting.value=false } }
// 补考
const retakeVisible = ref(false); const retakeId = ref(null)
const retakeForm = reactive({ retake_date:'', retake_score:null })
const recordRetake = (row) => { retakeId.value = row.id; retakeForm.retake_date = ''; retakeForm.retake_score = null; retakeVisible.value = true }
const submitRetake = async () => { if (!retakeForm.retake_date || retakeForm.retake_score == null) { ElMessage.warning('请填写补考日期和成绩'); return }; submitting.value=true; try { const u = JSON.parse(localStorage.getItem('user')); const row = list.value.find(r => r.id === retakeId.value); const newResult = retakeForm.retake_score >= row.pass_score ? '合格' : '不合格'; await axios.put('/api/training/exams/'+retakeId.value,{user_id:u.id,retake_count:(row.retake_count||0)+1,retake_date:retakeForm.retake_date,retake_score:retakeForm.retake_score,result:newResult}); ElMessage.success('补考已记录'); retakeVisible.value=false; fetchList() } catch { ElMessage.error('失败') } finally { submitting.value=false } }
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; } .toolbar h2 { margin: 0; color: #303133; } .toolbar-right { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; } .stat-card { cursor: pointer; text-align: center; } .stat-num { font-size: 28px; font-weight: bold; color: #303133; } .stat-label { font-size: 13px; color: #909399; margin-top: 4px; } .stat-valid .stat-num { color: #67c23a; } .stat-warning .stat-num { color: #e6a23c; } .stat-danger .stat-num { color: #f56c6c; } .upload-tip { color: #909399; font-size: 12px; margin-top: 4px; } .pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
