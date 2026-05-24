<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>培训课程库</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索课程名称/编号..." clearable style="width:220px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="categoryFilter" placeholder="课程类别" clearable style="width:120px;margin-right:8px" @change="currentPage=1">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增课程</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
      </div>
    </div>
    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="课程编号" prop="course_number" width="120" />
        <el-table-column label="课程名称" prop="course_name" min-width="200" />
        <el-table-column label="类别" prop="category" width="100" />
        <el-table-column label="学时" prop="duration" width="70" />
        <el-table-column label="考核方式" prop="exam_method" width="90" />
        <el-table-column label="及格线" width="80"><template #default="{row}">{{ row.pass_score }}分</template></el-table-column>
        <el-table-column label="培训教材" prop="material" min-width="150" show-overflow-tooltip />
        <el-table-column label="附件" width="70">
          <template #default="{row}"><el-button v-if="getPaths(row).length>0" type="primary" link size="small" @click="preview(row)">查看</el-button><span v-else style="color:#c0c4cc">无</span></template>
        </el-table-column>
        <el-table-column label="操作" width="120" fixed="right">
          <template #default="{row}"><el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button><el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button></template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无课程" />
      <div v-if="filteredList.length>10" class="pagination-wrap"><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background /></div>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="550px">
      <el-form :model="form" label-width="80px">
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="课程编号"><el-input v-model="form.course_number" placeholder="如：CS-001" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="课程名称"><el-input v-model="form.course_name" placeholder="课程标题" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="课程类别"><el-select v-model="form.category" style="width:100%"><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="学时"><el-input v-model="form.duration" placeholder="如：4学时" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="考核方式"><el-select v-model="form.exam_method" style="width:100%"><el-option label="笔试" value="笔试" /><el-option label="实操" value="实操" /><el-option label="口试" value="口试" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="及格线"><el-input-number v-model="form.pass_score" :min="0" :max="100" style="width:100%" /></el-form-item></el-col></el-row>
        <el-form-item label="培训教材"><el-input v-model="form.material" placeholder="关联的体系文件" /></el-form-item>
        <el-form-item label="上传附件"><el-upload ref="uploadRef" drag :auto-upload="false" :limit="5" :on-change="handleFileChange" :on-remove="handleFileRemove" :file-list="existingFilesList" accept=".jpg,.jpeg,.png,.gif,.pdf,.doc,.docx,.ppt,.pptx" list-type="text"><div class="el-upload__text">拖拽文件 或 <em>点击选择</em></div><template #tip><div class="upload-tip">课件PPT、视频</div></template></el-upload></el-form-item>
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
const categories = ['基础知识','操作技能','法规标准','安全管理']
const getPaths = (r) => { try { return JSON.parse(r.file_paths||'[]') } catch { return [] } }
const list = ref([]); const loading = ref(false); const keyword = ref(''); const categoryFilter = ref(''); const currentPage = ref(1); const pageSize = ref(10); const selectedIds = ref([])
const filteredList = computed(() => { let r = list.value; if (keyword.value) { const kw = keyword.value.toLowerCase(); r = r.filter(x => (x.course_name||'').includes(kw) || (x.course_number||'').includes(kw)) }; if (categoryFilter.value) r = r.filter(x => x.category === categoryFilter.value); return r })
const pagedList = computed(() => filteredList.value.slice((currentPage.value-1)*pageSize.value, currentPage.value*pageSize.value))
const fetchList = async () => { loading.value = true; try { const u = JSON.parse(localStorage.getItem('user')); const p = { user_id: u.id }; if (categoryFilter.value) p.category = categoryFilter.value; if (keyword.value) p.keyword = keyword.value; const res = await request.get('/training/courses', { params: p }); list.value = res.list } catch {} finally { loading.value = false } }
onMounted(fetchList)
const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }
const handleBatchDelete = async () => { try { await ElMessageBox.confirm('确认删除？','批量删除',{type:'warning'}) } catch { return }; try { const u = JSON.parse(localStorage.getItem('user')); await axios.post('/api/training/courses/batch-delete',{user_id:u.id,ids:selectedIds.value}); ElMessage.success('已删除'); selectedIds.value=[]; fetchList() } catch { ElMessage.error('失败') } }
const handleDelete = async (id) => { try { await ElMessageBox.confirm('确认删除？','删除',{type:'warning'}) } catch { return }; try { const u = JSON.parse(localStorage.getItem('user')); await axios.delete('/api/training/courses/'+id,{data:{user_id:u.id}}); ElMessage.success('已删除'); fetchList() } catch { ElMessage.error('失败') } }
const preview = (row) => { getPaths(row).forEach(p => window.open(p,'_blank')) }
const dialogVisible = ref(false); const dialogTitle = ref('新增课程'); const editId = ref(null); const uploadRef = ref(null); const newFiles = ref([]); const existingFilesList = ref([]); const submitting = ref(false)
const form = reactive({ course_number:'', course_name:'', category:'基础知识', duration:'', exam_method:'笔试', pass_score:80, material:'' })
const openAddDialog = () => { dialogTitle.value='新增课程'; editId.value=null; Object.assign(form,{course_number:'',course_name:'',category:'基础知识',duration:'',exam_method:'笔试',pass_score:80,material:''}); newFiles.value=[]; existingFilesList.value=[]; if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const openEditDialog = (row) => { dialogTitle.value='编辑课程'; editId.value=row.id; Object.assign(form,{course_number:row.course_number,course_name:row.course_name,category:row.category,duration:row.duration,exam_method:row.exam_method,pass_score:row.pass_score,material:row.material}); newFiles.value=[]; existingFilesList.value=getPaths(row).map((p,i)=>({name:p.split('/').pop(),url:p,uid:i})); if(uploadRef.value) uploadRef.value.clearFiles(); dialogVisible.value=true }
const handleFileChange = (f) => { newFiles.value.push(f.raw) }
const handleFileRemove = (f) => { const i = existingFilesList.value.findIndex(x => x.uid===f.uid); if(i>=0) existingFilesList.value.splice(i,1) }
const handleSubmit = async () => { if(!form.course_name) { ElMessage.warning('请填写课程名称'); return }; submitting.value=true; try { const u = JSON.parse(localStorage.getItem('user')); const fd = new FormData(); fd.append('user_id',u.id); Object.keys(form).forEach(k => fd.append(k,form[k]||'')); fd.append('existing_files',JSON.stringify(existingFilesList.value.map(f=>f.url))); newFiles.value.forEach(f => fd.append('files',f)); if(editId.value) { await axios.put('/api/training/courses/'+editId.value,fd); ElMessage.success('更新成功') } else { await axios.post('/api/training/courses',fd); ElMessage.success('添加成功') }; dialogVisible.value=false; fetchList() } catch { ElMessage.error('失败') } finally { submitting.value=false } }
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; } .toolbar h2 { margin: 0; color: #303133; } .toolbar-right { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; } .upload-tip { color: #909399; font-size: 12px; margin-top: 4px; } .pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
