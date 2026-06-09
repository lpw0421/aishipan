<template>
  <div class="pp">
    <!-- 标题 -->
    <div class="hd">
      <div><h1>人员综合管理</h1><p class="sub">员工信息与健康证状态统一管理</p></div>
      <div class="hd-r">
        <el-button class="btn-ghost" @click="fetchData">↻ 刷新</el-button>
        <el-button class="btn-ghost" @click="exportExcel">导出 Excel</el-button>
        <el-button type="primary" class="btn-main" @click="openAdd">+ 新增员工</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="sc">
      <div class="scd sc-b" :class="{on:activeCard==='total'}" @click="toggleCard('total')">
        <div class="scn">{{ stats.total }}</div><div class="scl">人员总数</div>
        <div class="scs">在职 {{ stats.active }} · 离职 {{ stats.total - stats.active }}</div>
      </div>
      <div class="scd sc-g" :class="{on:activeCard==='active'}" @click="toggleCard('active')">
        <div class="scn">{{ stats.active }}</div><div class="scl">在职人员</div>
        <div class="scs">健康证正常 {{ stats.hcNormal }} 人</div>
      </div>
      <div class="scd sc-o" :class="{on:activeCard==='expiring'}" @click="toggleCard('expiring')">
        <div class="scn">{{ stats.expiringSoon }}<span v-if="stats.expiringSoon>0" class="dot"></span></div><div class="scl">健康证临期</div>
        <div class="scs">30天内到期</div>
      </div>
      <div class="scd sc-r" :class="{on:activeCard==='expired'}" @click="toggleCard('expired')">
        <div class="scn">{{ stats.expired }}</div><div class="scl">健康证过期</div>
        <div class="scs">需立即处理</div>
      </div>
    </div>

    <!-- 筛选 -->
    <div class="fb">
      <div class="fbr">
        <el-input v-model="keyword" placeholder="搜索姓名、电话、部门..." size="default" clearable @input="fetchData" class="fs" />
        <el-select v-model="filterDept" placeholder="全部部门" clearable @change="fetchData" style="width:150px"><el-option v-for="d in depts" :key="d" :label="d" :value="d" /></el-select>
        <el-button class="btn-ghost">高级搜索</el-button>
      </div>
      <div class="fbr">
        <span class="flb">人员状态：</span>
        <span v-for="t in statusTags" :key="t.v" class="ft" :class="{on:filterStatus===t.v}" @click="filterStatus=filterStatus===t.v?'全部':t.v;fetchData()">{{ t.l }}</span>
        <span class="fsp"></span>
        <span class="flb">健康证：</span>
        <span v-for="t in healthTags" :key="t.v" class="ft" :class="{on:filterHealth===t.v}" @click="filterHealth=filterHealth===t.v?'全部':t.v;fetchData()">{{ t.l }}</span>
      </div>
    </div>

    <!-- 表格 -->
    <div class="tw">
      <el-table :data="list" v-loading="loading" row-key="id" @selection-change="onSelectionChange" ref="tableRef" @expand-change="onExpand" :expand-row-keys="expandedRows" :row-class-name="rowClass">
        <el-table-column type="selection" width="36" />
        <el-table-column type="expand"><template #default="{row}">
          <div class="ex">
            <div class="exi"><span>电话：{{ row.phone || '—' }}</span><span>入职日期：{{ formatDate(row.entry_date) }}</span><span>部门：{{ row.department }}</span><span>职位：{{ row.position }}</span></div>
            <div v-if="row.remarks" class="exr">备注：{{ row.remarks }}</div>
            <div v-if="row.hcStatus==='临期'" class="exw o">⚠ 该员工健康证将于 {{ row.health_cert_expiry }} 到期，请及时安排续办</div>
            <div v-if="row.hcStatus==='过期'" class="exw r">⚠ 该员工健康证已于 {{ row.health_cert_expiry }} 过期，请立即续办</div>
          </div>
        </template></el-table-column>
        <el-table-column prop="employee_number" label="编号" width="80" />
        <el-table-column prop="name" label="姓名" min-width="70"><template #default="{row}"><span class="nc">{{ row.name }}</span></template></el-table-column>
        <el-table-column prop="department" label="部门" min-width="70" show-overflow-tooltip />
        <el-table-column prop="position" label="职位" min-width="80" show-overflow-tooltip />
        <el-table-column label="状态" width="78"><template #default="{row}"><span class="tg" :class="'tg-'+row.statusCls">{{ row.status }}</span></template></el-table-column>
        <el-table-column label="到期日期" width="110"><template #default="{row}"><span :class="'dt-'+row.hcStatus">{{ formatDate(row.health_cert_expiry) }}</span></template></el-table-column>
        <el-table-column label="证件" width="78"><template #default="{row}"><span class="tg" :class="'tg-'+row.hcCls">{{ row.hcLabel }}</span></template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right"><template #default="{row}">
          <el-button link size="small" type="primary" @click="editRow(row)">编辑</el-button>
          <el-button link size="small" type="danger" @click="deleteRow(row)">删除</el-button>
        </template></el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length===0" :description="emptyDesc">
        <el-button v-if="!hasFilter" type="primary" @click="openAdd">+ 新增员工</el-button>
        <el-button v-else link type="primary" @click="clearFilters">清除筛选</el-button>
      </el-empty>
    </div>

    <!-- 批量操作 -->
    <div class="bb" v-if="selectedRows.length>0">
      <span>已选 {{ selectedRows.length }} 项</span>
      <el-button size="small" class="bb-o" @click="batchExport">批量导出</el-button>
      <el-button size="small" type="primary" @click="batchUpdateHC">批量更新健康证</el-button>
      <el-button size="small" class="btn-ghost" @click="tableRef?.clearSelection()">取消</el-button>
    </div>

    <!-- 弹窗 -->
    <el-dialog :title="editingId?'编辑员工':'新增员工'" v-model="showForm" width="560px" @close="resetForm">
      <div v-if="!editingId" class="ai">
        <el-input v-model="aiText" type="textarea" :rows="2" placeholder='🤖 粘贴描述AI自动填写。如："张三，品控部质检员，健康证2026-12-31到期"' size="small" />
        <el-button type="primary" size="small" @click="aiFill" :loading="aiLoading" style="margin-top:6px">AI 智能填写</el-button>
      </div>
      <el-form :model="form" label-width="90px">
        <el-form-item label="姓名"><el-input v-model="form.name" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="部门">
              <el-select v-model="form.department" filterable allow-create placeholder="选择或输入" style="width:100%"><el-option v-for="d in depts" :key="d" :label="d" :value="d" /></el-select>
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="职位">
              <el-select v-model="form.position" filterable allow-create placeholder="选择或输入" style="width:100%"><el-option v-for="p in positions" :key="p" :label="p" :value="p" /></el-select>
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="状态">
          <el-radio-group v-model="form.status"><el-radio value="在职">在职</el-radio><el-radio value="试用期">试用期</el-radio><el-radio value="离职">离职</el-radio></el-radio-group>
        </el-form-item>
        <el-form-item label="电话"><el-input v-model="form.phone" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12"><el-form-item label="入职日期"><el-date-picker v-model="form.entry_date" type="date" style="width:100%" value-format="YYYY-MM-DD" /></el-form-item></el-col>
          <el-col :span="12"><el-form-item label="健康证到期"><el-date-picker v-model="form.health_cert_expiry" type="date" style="width:100%" value-format="YYYY-MM-DD" /></el-form-item></el-col>
        </el-row>
        <el-form-item label="健康证号"><el-input v-model="form.hc_number" placeholder="选填" /></el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remarks" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showForm=false">取消</el-button><el-button type="primary" @click="save" :loading="saving">{{ editingId?'保存修改':'确认新增' }}</el-button></template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import request from '../../utils/request'
import { ElMessage, ElMessageBox } from 'element-plus'

const user = JSON.parse(localStorage.getItem('user') || '{}'), userId = user.id
const loading=ref(false), saving=ref(false), showForm=ref(false), editingId=ref(null)
const keyword=ref(''), filterStatus=ref('全部'), filterHealth=ref('全部'), filterDept=ref(''), activeCard=ref('')
const list=ref([]), expandedRows=ref([]), depts=ref([]), positions=ref([]), selectedRows=ref([])
const aiText=ref(''), aiLoading=ref(false), tableRef=ref(null)

const stats = reactive({ total:0, active:0, expiringSoon:0, expired:0, hcNormal:0 })
const hasFilter = computed(()=>!!(keyword.value||filterStatus.value!=='全部'||filterHealth.value!=='全部'||filterDept.value))
const emptyDesc = computed(()=>keyword.value?`未找到"${keyword.value}"相关结果`:'暂无匹配人员')

const statusTags=[{l:'全部',v:'全部'},{l:'在职',v:'在职'},{l:'离职',v:'离职'},{l:'试用期',v:'试用期'}]
const healthTags=[{l:'全部',v:'全部'},{l:'正常',v:'正常'},{l:'临期',v:'临期'},{l:'已过期',v:'过期'}]

const formatDate=(d)=>{if(!d)return'—';const s=String(d);return s.includes('T')?s.slice(0,10):s.length>=10?s.slice(0,10):s}
const getHCStatus=(expiry)=>{if(!expiry)return'无证件';const d=new Date(expiry),n=new Date();if(d<n)return'过期';return Math.ceil((d-n)/86400000)<=30?'临期':'正常'}
const rowClass=({row})=>{if(row.hcStatus==='过期')return'row-expired';if(row.hcStatus==='临期')return'row-expiring';return''}

const form=reactive({name:'',department:'',position:'',phone:'',entry_date:'',health_cert_expiry:'',status:'在职',remarks:'',hc_number:'',file_path:''})

const fetchData=async()=>{loading.value=true;try{
  const[pR,hR]=await Promise.all([request.get('/personnel',{params:{user_id:userId}}),request.get('/health-certs',{params:{user_id:userId}})])
  const persons=pR.list||[],healths=hR.list||[]
  stats.total=persons.length;stats.active=persons.filter(p=>p.status==='在职').length;stats.expiringSoon=0;stats.expired=0;stats.hcNormal=0
  depts.value=[...new Set(persons.map(p=>p.department).filter(Boolean))]
  positions.value=[...new Set(persons.map(p=>p.position).filter(Boolean))]
  const merged=persons.map(p=>{const hc=healths.find(h=>h.employee_name===p.name);const s=getHCStatus(hc?.expiry_date||p.health_cert_expiry)
    if(s==='临期')stats.expiringSoon++;if(s==='过期')stats.expired++;if(s==='正常')stats.hcNormal++
    return{...p,health_cert_expiry:hc?.expiry_date||p.health_cert_expiry||'',hc_number:p.hc_number||'',hcStatus:s,
      hcLabel:s==='正常'?'正常':s==='临期'?'临期':s==='过期'?'已过期':'无证件',
      hcCls:s==='正常'?'ok':s==='临期'?'warn':s==='过期'?'bad':'none',statusCls:p.status==='在职'?'ok':p.status==='试用期'?'trial':'off'}})
  let r=merged
  if(filterStatus.value!=='全部')r=r.filter(x=>x.status===filterStatus.value)
  if(filterHealth.value!=='全部'){const m={正常:'正常',临期:'临期',过期:'过期'};r=r.filter(x=>x.hcStatus===m[filterHealth.value])}
  if(filterDept.value)r=r.filter(x=>x.department===filterDept.value)
  if(keyword.value){const kw=keyword.value.toLowerCase();r=r.filter(x=>(x.name||'').includes(kw)||(x.employee_number||'').includes(kw)||(x.position||'').includes(kw)||(x.phone||'').includes(kw)||(x.department||'').includes(kw))}
  list.value=r}catch(e){console.error(e)}finally{loading.value=false}}

const toggleCard=c=>{activeCard.value=activeCard.value===c?'':c;if(c==='total'){filterStatus.value='全部';filterHealth.value='全部'}else if(c==='active')filterStatus.value='在职';else if(c==='expiring')filterHealth.value='临期';else if(c==='expired')filterHealth.value='过期';fetchData()}
const openAdd=()=>{editingId.value=null;resetForm();showForm.value=true}
const editRow=r=>{editingId.value=r.id;Object.assign(form,{name:r.name,department:r.department,position:r.position,phone:r.phone,entry_date:r.entry_date,health_cert_expiry:r.health_cert_expiry,status:r.status,remarks:r.remarks||'',hc_number:r.hc_number||'',file_path:r.file_path||''});showForm.value=true}
const renewHC=r=>{form.health_cert_expiry='';editRow(r);form.status=r.status}
const deleteRow=async r=>{await ElMessageBox.confirm(`确定删除 ${r.name} 的员工记录？`,'确认删除',{type:'warning'});try{await axios.delete(`/api/personnel/${r.id}`,{data:{user_id:userId}});ElMessage.success('已删除');fetchData()}catch{ElMessage.error('删除失败')}}
const onSelectionChange=rows=>{selectedRows.value=rows}
const onExpand=(row,rows)=>{expandedRows.value=rows.map(r=>r.id)}
const clearFilters=()=>{keyword.value='';filterStatus.value='全部';filterHealth.value='全部';filterDept.value='';activeCard.value='';fetchData()}
const exportExcel=()=>ElMessage.info('导出功能开发中')
const batchExport=()=>ElMessage.info(`已选${selectedRows.value.length}项，导出开发中`)
const batchUpdateHC=()=>ElMessage.info(`已选${selectedRows.value.length}人，批量更新健康证开发中`)
const resetForm=()=>{Object.assign(form,{name:'',department:'',position:'',phone:'',entry_date:'',health_cert_expiry:'',status:'在职',remarks:'',hc_number:'',file_path:''});aiText.value=''}
const save=async()=>{if(!form.name)return ElMessage.warning('请填写姓名');saving.value=true;try{if(editingId.value)await axios.put(`/api/personnel/${editingId.value}`,{user_id:userId,...form});else await axios.post('/api/personnel',{user_id:userId,...form});ElMessage.success(editingId.value?'更新成功':'添加成功');showForm.value=false;resetForm();await fetchData()}catch(e){ElMessage.error(e.response?.data?.message||'操作失败')}finally{saving.value=false}}
const aiFill=async()=>{if(!aiText.value.trim())return;aiLoading.value=true;try{const r=await axios.post('/api/ai/extract-person',{text:aiText.value});if(r.data.method==='ai'){const d=r.data;if(d.name)form.name=d.name;if(d.department)form.department=d.department;if(d.position)form.position=d.position;if(d.phone)form.phone=d.phone;if(d.health_cert_expiry)form.health_cert_expiry=d.health_cert_expiry;if(d.entry_date)form.entry_date=d.entry_date;aiText.value='';ElMessage.success('AI已填写，请核对')}}catch{ElMessage.error('AI异常')}finally{aiLoading.value=false}}
onMounted(fetchData)
</script>

<style scoped>
.pp{padding:0}
.hd{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:18px}
.hd h1{font-size:18px;font-weight:600;color:#1a1a2e;margin:0}.sub{font-size:13px;color:#888;margin:4px 0 0}
.hd-r{display:flex;gap:8px}
.btn-ghost{background:white;border:0.5px solid #d0d0d0;color:#666;border-radius:6px;height:34px}
.btn-main{background:#378ADD;color:#fff;font-weight:500;border-radius:6px;height:34px;border:none}

/* 统计卡 */
.sc{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
.scd{border-radius:10px;padding:16px 18px;cursor:pointer;border:2px solid transparent;transition:all .2s;position:relative}
.scd:hover{transform:translateY(-2px)}
.scd.on{border-color:#378ADD}
.sc-b{background:#EBF3FE}.sc-b .scn{color:#378ADD}.sc-b .scs{color:#6A9FD8}
.sc-g{background:#EAF3DE}.sc-g .scn{color:#639922}.sc-g .scs{color:#8AB562}
.sc-o{background:#FEF6E7}.sc-o .scn{color:#BA7517}.sc-o .scs{color:#D49A3F}
.sc-r{background:#FCEBEB}.sc-r .scn{color:#A32D2D}.sc-r .scs{color:#C45A5A}
.scn{font-size:28px;font-weight:700;position:relative;display:inline-block}
.dot{position:absolute;top:2px;right:-8px;width:8px;height:8px;background:#E24B4A;border-radius:50%}
.scl{font-size:12px;font-weight:500;color:#555;margin-top:4px}
.scs{font-size:11px;margin-top:2px}

/* 筛选 */
.fb{margin-bottom:14px;display:flex;flex-direction:column;gap:10px}
.fbr{display:flex;align-items:center;gap:8px;flex-wrap:wrap}
.fs{max-width:320px}.fs :deep(.el-input__wrapper){padding:7px 12px 7px 32px;border-radius:6px}
.flb{font-size:12px;color:#888;margin-right:2px}
.ft{font-size:12px;padding:4px 14px;border-radius:20px;cursor:pointer;border:0.5px solid #d0d0d0;background:#fff;color:#333;transition:all .2s}
.ft:hover{border-color:#378ADD;color:#378ADD}
.ft.on{background:#378ADD;color:#fff;border-color:#378ADD}
.fsp{width:1px;height:20px;background:#d0d0d0;margin:0 8px}

/* 表格 */
.tw{background:white;border-radius:10px;border:0.5px solid #e8e8e8;overflow-x:auto}
:deep(.el-table th){font-size:12px;color:#666;font-weight:500;background:#f8f9fb}
:deep(.el-table td){font-size:13px}
:deep(.el-table__body tr:hover td){background:#f7f9fc}
:deep(.row-expired td){background:#FFFAFA!important}
:deep(.row-expired){border-left:3px solid #E24B4A}
:deep(.row-expiring){border-left:3px solid #EF9F27}
.nc{font-weight:500;white-space:nowrap}
.tg{font-size:12px;padding:2px 10px;border-radius:10px;white-space:nowrap}
.tg-ok{background:#EAF3DE;color:#3B6D11}.tg-off{background:#f0f0f0;color:#888}.tg-trial{background:#FEF6E7;color:#854F0B}
.tg-warn{background:#FEF6E7;color:#854F0B}.tg-bad{background:#FCEBEB;color:#A32D2D}.tg-none{background:#f0f0f0;color:#bbb}
.dt-临期{color:#BA7517;font-weight:500}.dt-过期{color:#A32D2D;font-weight:500}

/* 展开行 */
.ex{padding:12px 16px 12px 60px;background:#fafbfe;font-size:13px}
.exi{display:flex;gap:20px;flex-wrap:wrap}
.exr{margin-top:8px;color:#666}
.exw{margin-top:8px;padding:8px 12px;border-radius:6px;font-size:12px}
.exw.o{background:#FEF6E7;color:#854F0B}.exw.r{background:#FCEBEB;color:#A32D2D}

/* 批量 */
.bb{background:#EBF3FE;border-top:0.5px solid #B5D4F4;padding:10px 16px;display:flex;align-items:center;gap:12px;position:sticky;bottom:0}
.bb span{font-size:13px;color:#185FA5;font-weight:500}
.bb-o{border:0.5px solid #378ADD;color:#378ADD;background:white}

/* 弹窗 */
.ai{margin-bottom:12px;padding:10px;background:#E6F1FB;border-radius:8px;border:1px solid #B5D4F4}
.ai .el-button{width:100%}
.ai :deep(.el-textarea__inner){font-size:13px}
</style>
