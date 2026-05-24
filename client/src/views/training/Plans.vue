<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>培训计划</h2>
      <div class="toolbar-right">
        <el-input v-model="keyword" placeholder="搜索计划名称/编号..." clearable style="width:220px;margin-right:8px" @input="currentPage=1" />
        <el-select v-model="typeFilter" placeholder="培训类型" clearable style="width:120px;margin-right:8px" @change="currentPage=1">
          <el-option v-for="t in types" :key="t" :label="t" :value="t" />
        </el-select>
        <el-select v-model="statusFilter" placeholder="状态" clearable style="width:110px;margin-right:8px" @change="currentPage=1">
          <el-option label="待执行" value="待执行" /><el-option label="进行中" value="进行中" />
          <el-option label="已完成" value="已完成" /><el-option label="已取消" value="已取消" />
        </el-select>
        <el-button type="primary" @click="openAddDialog">新增计划</el-button>
        <el-button v-if="selectedIds.length>0" type="danger" @click="handleBatchDelete">批量删除({{selectedIds.length}})</el-button>
      </div>
    </div>
    <el-row :gutter="16" style="margin-bottom:16px">
      <el-col :span="6" v-for="c in statCards" :key="c.label">
        <el-card shadow="hover" class="stat-card" :class="c.cls" @click="statusFilter=c.filter;currentPage=1">
          <div class="stat-num" :class="c.numCls">{{ c.value }}</div><div class="stat-label">{{ c.label }}</div>
        </el-card>
      </el-col>
    </el-row>
    <el-card>
      <el-table :data="pagedList" stripe v-loading="loading" @selection-change="onSelectionChange">
        <el-table-column type="selection" width="45" />
        <el-table-column label="计划编号" prop="plan_number" width="130" />
        <el-table-column label="计划名称" prop="plan_name" min-width="180" />
        <el-table-column label="培训类型" prop="training_type" width="100" />
        <el-table-column label="计划日期" width="110"><template #default="{row}">{{ row.planned_date || '-' }}</template></el-table-column>
        <el-table-column label="讲师" prop="trainer" width="80" />
        <el-table-column label="学时" prop="duration" width="70" />
        <el-table-column label="计划人数" width="80"><template #default="{row}">{{ row.planned_attendees || '-' }}</template></el-table-column>
        <el-table-column label="实际人数" width="80"><template #default="{row}">{{ row.actual_attendees || '-' }}</template></el-table-column>
        <el-table-column label="状态" width="90">
          <template #default="{row}"><el-tag :type="row.status==='已完成'?'success':row.status==='进行中'?'warning':row.status==='已取消'?'info':'danger'" size="small">{{ row.status }}</el-tag></template>
        </el-table-column>
        <el-table-column label="备注" prop="remark" min-width="100" show-overflow-tooltip />
        <el-table-column label="操作" width="150" fixed="right">
          <template #default="{row}">
            <el-button type="primary" link size="small" @click="openEditDialog(row)">编辑</el-button>
            <el-button v-if="row.status==='待执行'" type="warning" link size="small" @click="updateStatus(row,'进行中')">开始</el-button>
            <el-button v-if="row.status==='进行中'" type="success" link size="small" @click="updateStatus(row,'已完成')">完成</el-button>
            <el-button type="danger" link size="small" @click="handleDelete(row.id)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
      <el-empty v-if="!loading && filteredList.length===0" description="暂无计划" />
      <div v-if="filteredList.length>10" class="pagination-wrap"><el-pagination v-model:current-page="currentPage" :page-size="pageSize" :pager-count="5" layout="prev,pager,next,total" :total="filteredList.length" background /></div>
    </el-card>
    <el-dialog v-model="dialogVisible" :title="dialogTitle" width="500px">
      <el-form :model="form" label-width="80px">
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="计划编号"><el-input v-model="form.plan_number" placeholder="如：TP-2026-001" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="计划名称"><el-input v-model="form.plan_name" placeholder="培训主题" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="培训类型"><el-select v-model="form.training_type" style="width:100%"><el-option v-for="t in types" :key="t" :label="t" :value="t" /></el-select></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="计划日期"><el-date-picker v-model="form.planned_date" type="date" value-format="YYYY-MM-DD" style="width:100%" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="讲师"><el-input v-model="form.trainer" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item label="学时"><el-input v-model="form.duration" placeholder="如：4学时" /></el-form-item></el-col></el-row>
        <el-row :gutter="16"><el-col :span="12"><el-form-item label="计划人数"><el-input-number v-model="form.planned_attendees" :min="0" style="width:100%" /></el-form-item></el-col>
        <el-col :span="12"><el-form-item v-if="editId" label="实际人数"><el-input-number v-model="form.actual_attendees" :min="0" style="width:100%" /></el-form-item></el-col></el-row>
        <el-form-item label="备注"><el-input v-model="form.remark" type="textarea" :rows="2" /></el-form-item>
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
const list = ref([]); const loading = ref(false); const keyword = ref(''); const typeFilter = ref(''); const statusFilter = ref('')
const currentPage = ref(1); const pageSize = ref(10); const selectedIds = ref([])
const statCards = computed(() => [
  { label:'计划总数', value:list.value.length, cls:'', numCls:'', filter:'' },
  { label:'待执行', value:list.value.filter(r=>r.status==='待执行').length, cls:'stat-warning', numCls:'', filter:'待执行' },
  { label:'进行中', value:list.value.filter(r=>r.status==='进行中').length, cls:'', numCls:'', filter:'进行中' },
  { label:'已完成', value:list.value.filter(r=>r.status==='已完成').length, cls:'stat-valid', numCls:'', filter:'已完成' }
])
const filteredList = computed(() => {
  let r = list.value
  if (keyword.value) { const kw = keyword.value.toLowerCase(); r = r.filter(x => (x.plan_name||'').includes(kw) || (x.plan_number||'').includes(kw)) }
  if (typeFilter.value) r = r.filter(x => x.training_type === typeFilter.value)
  if (statusFilter.value) r = r.filter(x => x.status === statusFilter.value)
  return r
})
const pagedList = computed(() => filteredList.value.slice((currentPage.value-1)*pageSize.value, currentPage.value*pageSize.value))
const fetchList = async () => { loading.value = true; try { const u = JSON.parse(localStorage.getItem('user')); const p = { user_id: u.id }; if (typeFilter.value) p.training_type = typeFilter.value; if (statusFilter.value) p.status = statusFilter.value; if (keyword.value) p.keyword = keyword.value; const res = await request.get('/training/plans', { params: p }); list.value = res.list } catch {} finally { loading.value = false } }
onMounted(fetchList)
const onSelectionChange = (rows) => { selectedIds.value = rows.map(r => r.id) }
const handleBatchDelete = async () => { try { await ElMessageBox.confirm('确认删除？','批量删除',{type:'warning'}) } catch { return }; try { const u = JSON.parse(localStorage.getItem('user')); await axios.post('/api/training/plans/batch-delete',{user_id:u.id,ids:selectedIds.value}); ElMessage.success('已删除'); selectedIds.value=[]; fetchList() } catch { ElMessage.error('失败') } }
const handleDelete = async (id) => { try { await ElMessageBox.confirm('确认删除？','删除',{type:'warning'}) } catch { return }; try { const u = JSON.parse(localStorage.getItem('user')); await axios.delete('/api/training/plans/'+id,{data:{user_id:u.id}}); ElMessage.success('已删除'); fetchList() } catch { ElMessage.error('失败') } }
const updateStatus = async (row, status) => { try { const u = JSON.parse(localStorage.getItem('user')); await axios.put('/api/training/plans/'+row.id,{user_id:u.id,status}); ElMessage.success('已更新'); fetchList() } catch { ElMessage.error('失败') } }
const dialogVisible = ref(false); const dialogTitle = ref('新增计划'); const editId = ref(null); const submitting = ref(false)
const form = reactive({ plan_number:'', plan_name:'', training_type:'在岗复训', planned_date:'', trainer:'', duration:'', planned_attendees:0, actual_attendees:0, remark:'' })
const openAddDialog = () => { dialogTitle.value='新增计划'; editId.value=null; Object.assign(form,{plan_number:'',plan_name:'',training_type:'在岗复训',planned_date:'',trainer:'',duration:'',planned_attendees:0,actual_attendees:0,remark:''}); dialogVisible.value=true }
const openEditDialog = (row) => { dialogTitle.value='编辑计划'; editId.value=row.id; Object.assign(form,{plan_number:row.plan_number,plan_name:row.plan_name,training_type:row.training_type,planned_date:row.planned_date,trainer:row.trainer,duration:row.duration,planned_attendees:row.planned_attendees,actual_attendees:row.actual_attendees,remark:row.remark}); dialogVisible.value=true }
const handleSubmit = async () => { if(!form.plan_name) { ElMessage.warning('请填写计划名称'); return }; submitting.value=true; try { const u = JSON.parse(localStorage.getItem('user')); const d = {user_id:u.id,...form}; if(editId.value) { await axios.put('/api/training/plans/'+editId.value,d); ElMessage.success('更新成功') } else { await axios.post('/api/training/plans',d); ElMessage.success('添加成功') }; dialogVisible.value=false; fetchList() } catch { ElMessage.error('失败') } finally { submitting.value=false } }
</script>

<style scoped>
.page-container { padding: 0; } .toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 8px; } .toolbar h2 { margin: 0; color: #303133; } .toolbar-right { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; } .stat-card { cursor: pointer; text-align: center; } .stat-num { font-size: 28px; font-weight: bold; color: #303133; } .stat-label { font-size: 13px; color: #909399; margin-top: 4px; } .stat-valid .stat-num { color: #67c23a; } .stat-warning .stat-num { color: #e6a23c; } .stat-danger .stat-num { color: #f56c6c; } .pagination-wrap { display: flex; justify-content: center; margin-top: 16px; }
</style>
