<template>
  <div class="page-wrap">
    <!-- 标题栏 -->
    <div class="top-bar">
      <div class="top-left">
        <h1>人员综合管理</h1>
        <span class="top-sub">员工信息与健康证状态统一管理</span>
      </div>
      <div class="top-right">
        <el-button class="btn-ghost" size="small" @click="fetchData">↻ 刷新</el-button>
        <el-button class="btn-ghost" size="small" @click="exportExcel">导出 Excel</el-button>
        <el-upload :auto-upload="false" :show-file-list="false" accept=".xlsx,.xls" :on-change="importHealthCerts" style="display:inline-block">
          <el-button class="btn-ghost" size="small">📥 导入员工</el-button>
        </el-upload>
        <el-button class="btn-ghost" size="small" @click="downloadTemplate">📋 下载模板</el-button>
        <el-button class="btn-verify" size="small" @click="showVerify=true">🔍 真伪验证</el-button>
        <el-button class="btn-ghost" size="small" @click="showQR=true">📱 手机录入</el-button>
        <el-button type="primary" size="small" class="btn-main" @click="openAdd">+ 新增员工</el-button>
      </div>
    </div>

    <!-- 统计卡片 -->
    <div class="stat-row">
      <div class="stat-card stat-blue" :class="{on:activeCard==='total'}" @click="toggleCard('total')">
        <div class="stat-num">{{ stats.total }}</div>
        <div class="stat-label">人员总数</div>
        <div class="stat-sub">在职 {{ stats.active }} · 离职 {{ stats.total - stats.active }}</div>
      </div>
      <div class="stat-card stat-green" :class="{on:activeCard==='active'}" @click="toggleCard('active')">
        <div class="stat-num">{{ stats.active }}</div>
        <div class="stat-label">在职人员</div>
        <div class="stat-sub">健康证正常 {{ stats.hcNormal }} 人</div>
      </div>
      <div class="stat-card stat-orange" :class="{on:activeCard==='expiring'}" @click="toggleCard('expiring')">
        <div class="stat-num">{{ stats.expiringSoon }}<i v-if="stats.expiringSoon>0" class="stat-dot"></i></div>
        <div class="stat-label">健康证临期</div>
        <div class="stat-sub">30 天内到期</div>
      </div>
      <div class="stat-card stat-red" :class="{on:activeCard==='expired'}" @click="toggleCard('expired')">
        <div class="stat-num">{{ stats.expired }}</div>
        <div class="stat-label">健康证过期</div>
        <div class="stat-sub">需立即处理</div>
      </div>
    </div>

    <!-- 筛选栏 -->
    <div class="filter-bar">
      <el-input v-model="keyword" placeholder="搜索姓名、电话、部门..." size="small" clearable @input="fetchData" class="filter-search">
        <template #prefix><span style="font-size:13px">🔍</span></template>
      </el-input>
      <el-select v-model="filterDept" placeholder="全部部门" size="small" clearable @change="fetchData" style="width:130px">
        <el-option v-for="d in depts" :key="d" :label="d" :value="d" />
      </el-select>
      <span class="filter-div"></span>
      <span class="filter-label">人员</span>
      <span v-for="t in statusTags" :key="t.v" class="filter-tag" :class="{on:filterStatus===t.v}" @click="filterStatus=filterStatus===t.v?'全部':t.v;fetchData()">{{ t.l }}</span>
      <span class="filter-div"></span>
      <span class="filter-label">健康证</span>
      <span v-for="t in healthTags" :key="t.v" class="filter-tag" :class="{on:filterHealth===t.v}" @click="filterHealth=filterHealth===t.v?'全部':t.v;fetchData()">{{ t.l }}</span>
    </div>

    <!-- 表格 -->
    <div class="table-wrap">
      <el-table :data="pagedList" v-loading="loading" row-key="id" @selection-change="onSelectionChange" ref="tableRef" :row-class-name="rowClass">
        <el-table-column type="selection" width="36" />
        <el-table-column prop="employee_number" label="编号" width="72" />
        <el-table-column prop="name" label="姓名" width="80"><template #default="{row}"><span class="nc">{{ row.name }}</span></template></el-table-column>
        <el-table-column prop="department" label="部门" min-width="80" show-overflow-tooltip />
        <el-table-column prop="position" label="职位" min-width="80" show-overflow-tooltip />
        <el-table-column prop="phone" label="电话" min-width="110"><template #default="{row}">{{ row.phone || '—' }}</template></el-table-column>
        <el-table-column label="入职日期" width="110"><template #default="{row}"><span style="white-space:nowrap">{{ formatDate(row.entry_date) }}</span></template></el-table-column>
        <el-table-column label="状态" width="72"><template #default="{row}"><span class="tg" :class="'tg-'+row.statusCls">{{ row.status }}</span></template></el-table-column>
        <el-table-column label="到期日期" width="110"><template #default="{row}"><span :class="'dt-'+row.hcStatus" style="white-space:nowrap">{{ formatDate(row.health_cert_expiry) }}</span></template></el-table-column>
        <el-table-column label="健康证" width="80"><template #default="{row}"><span class="tg" :class="'tg-'+row.hcCls">{{ row.hcLabel }}</span></template></el-table-column>
        <el-table-column label="附件" width="90" align="center"><template #default="{row}"><a v-if="row.file_path" :href="fileUrl(row.file_path)" target="_blank" class="file-btn" :title="'查看：'+fileUrl(row.file_path)"><span class="file-icon">{{ fileIcon(row.file_path) }}</span><span class="file-txt">查看</span></a><span v-else class="file-none">—</span></template></el-table-column>
        <el-table-column label="操作" width="100" fixed="right"><template #default="{row}">
          <el-button link size="small" type="primary" @click="editRow(row)">编辑</el-button>
          <el-button link size="small" type="danger" @click="deleteRow(row)">删除</el-button>
        </template></el-table-column>
      </el-table>
      <el-empty v-if="!loading && list.length===0" :description="emptyDesc">
        <el-button v-if="!hasFilter" type="primary" size="small" @click="openAdd">+ 新增员工</el-button>
        <el-button v-else link type="primary" @click="clearFilters">清除筛选</el-button>
      </el-empty>
      <!-- 分页 -->
      <div class="pager" v-if="list.length > 0">
        <span class="pager-total">共 {{ list.length }} 条</span>
        <el-pagination background small layout="total, sizes, prev, pager, next" :page-sizes="[10, 20, 50]" :page-size="pageSize" :total="list.length" v-model:current-page="currentPage" @size-change="s=>{pageSize=s;currentPage=1}" @current-change="page=>currentPage=page" />
      </div>
    </div>

    <!-- 批量操作栏 -->
    <div class="batch-bar" v-if="selectedRows.length>0">
      <span>已选 {{ selectedRows.length }} 项</span>
      <el-button size="small" class="batch-btn-outline" @click="batchExport">批量导出</el-button>
      <el-button size="small" type="danger" plain @click="batchDelete">批量删除</el-button>
      <el-button size="small" class="btn-ghost" @click="tableRef?.clearSelection()">取消</el-button>
    </div>

    <!-- 新增/编辑弹窗 -->
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
        <el-form-item label="资质附件">
          <el-upload ref="uploadRef" :auto-upload="false" :limit="1" :on-change="onFileChange" :on-remove="onFileRemove">
            <el-button size="small">选择文件</el-button>
            <span class="upload-tip">支持图片/PDF</span>
          </el-upload>
        </el-form-item>
        <el-form-item label="备注"><el-input v-model="form.remarks" type="textarea" :rows="2" /></el-form-item>
      </el-form>
      <template #footer><el-button @click="showForm=false">取消</el-button><el-button type="primary" @click="save" :loading="saving">{{ editingId?'保存修改':'确认新增' }}</el-button></template>
    </el-dialog>

    <!-- 真伪验证弹窗 -->
    <el-dialog title="🔍 健康证真伪验证" v-model="showVerify" width="600px">
      <el-upload :auto-upload="false" :show-file-list="false" accept="image/*" :on-change="doVerify" drag>
        <div style="padding:30px 0">
          <div style="font-size:40px;margin-bottom:10px">📸</div>
          <div>点击或拖拽上传健康证图片</div>
          <div style="font-size:12px;color:#999;margin-top:6px">支持 JPG/PNG，AI 自动识别并验证真伪</div>
        </div>
      </el-upload>
      <div v-if="verifyResult" style="margin-top:16px">
        <el-alert :type="verifyResult.verified?'success':'warning'" :title="verifyResult.verdict" :closable="false" style="margin-bottom:12px" />
        <div v-if="verifyResult.qrCode" class="verify-info">
          <div class="vi-row"><span>二维码内容</span><b style="word-break:break-all;font-size:12px">{{ verifyResult.qrCode.data }}</b></div>
          <div class="vi-row" v-if="verifyResult.qrCode.isUrl"><span>联网状态</span><b>{{ verifyResult.qrCode.status || '检测中' }}</b></div>
          <div v-if="verifyResult.qrCode.isUrl" style="margin-top:10px;display:flex;gap:8px">
            <a :href="verifyResult.qrCode.data" target="_blank" style="flex:1">
              <el-button type="primary" size="small" style="width:100%">🌐 一键打开官方验证页面</el-button>
            </a>
            <el-button size="small" class="btn-ghost" @click="copyToClipboard(verifyResult.qrCode.data)">📋 复制链接</el-button>
          </div>
          <div v-if="verifyResult.qrCode.preview" style="margin-top:8px;padding:8px;background:#fff;border-radius:4px;font-size:12px;max-height:150px;overflow:auto">
            {{ verifyResult.qrCode.preview }}
          </div>
        </div>
        <div v-if="verifyResult.externalCheck && verifyResult.externalCheck.attempted" style="margin-top:10px;font-size:12px;color:#888">
          🌐 外部查询：{{ verifyResult.externalCheck.result }}
        </div>
        <div style="margin-top:10px;font-size:13px;color:#666">{{ verifyResult.suggestion }}</div>
      </div>
    </el-dialog>

    <!-- 手机录入二维码弹窗 -->
    <el-dialog title="📱 手机扫码录入" v-model="showQR" width="420px" align-center>
      <div style="text-align:center">
        <img :src="qrCodeUrl" style="width:240px;height:240px;border:1px solid #eee;border-radius:8px" alt="QR Code" />
        <div style="font-size:13px;color:#888;margin-top:10px">用手机扫描二维码，即可打开录入表单</div>
        <div style="font-size:12px;color:#378ADD;margin-top:6px;word-break:break-all">{{ mobileUrl }}</div>
      </div>
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
const list=ref([]), depts=ref([]), positions=ref([]), selectedRows=ref([])
const currentPage=ref(1), pageSize=ref(10)
const pagedList=computed(()=>{const s=(currentPage.value-1)*pageSize.value;return list.value.slice(s,s+pageSize.value)})
const aiText=ref(''), aiLoading=ref(false), tableRef=ref(null)
const showVerify=ref(false), verifyResult=ref(null), verifying=ref(false)
const showQR=ref(false)
const mobileUrl=computed(()=>`${window.location.origin}/personnel/mobile-add?user_id=${userId}`)
const qrCodeUrl=computed(()=>`https://api.qrserver.com/v1/create-qr-code/?size=240x240&data=${encodeURIComponent(mobileUrl.value)}`)

const stats = reactive({ total:0, active:0, expiringSoon:0, expired:0, hcNormal:0 })
const hasFilter = computed(()=>!!(keyword.value||filterStatus.value!=='全部'||filterHealth.value!=='全部'||filterDept.value))
const emptyDesc = computed(()=>keyword.value?`未找到"${keyword.value}"相关结果`:'暂无匹配人员')

const statusTags=[{l:'全部',v:'全部'},{l:'在职',v:'在职'},{l:'离职',v:'离职'},{l:'试用期',v:'试用期'}]
const healthTags=[{l:'全部',v:'全部'},{l:'正常',v:'正常'},{l:'临期',v:'临期'},{l:'已过期',v:'过期'}]

const formatDate=(d)=>{if(!d)return'—';const s=String(d);return s.includes('T')?s.slice(0,10):s.length>=10?s.slice(0,10):s}
const fileUrl=(p)=>{if(!p)return'';if(p.startsWith('http')||p.startsWith('/uploads/'))return p;return '/uploads/'+p}
const fileIcon=(p)=>{const e=(p||'').split('.').pop().toLowerCase();if(['jpg','jpeg','png','gif','bmp','webp','svg'].includes(e))return'🖼️';if(['pdf'].includes(e))return'📕';if(['doc','docx'].includes(e))return'📝';if(['xls','xlsx','csv'].includes(e))return'📊';return'📎'}
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
    return{...p,health_cert_expiry:hc?.expiry_date||p.health_cert_expiry||'',hc_number:p.hc_number||'',file_path:hc?.file_path||p.file_path||'',hcStatus:s,
      hcLabel:s==='正常'?'正常':s==='临期'?'临期':s==='过期'?'已过期':'无证件',
      hcCls:s==='正常'?'ok':s==='临期'?'warn':s==='过期'?'bad':'none',statusCls:p.status==='在职'?'ok':p.status==='试用期'?'trial':'off'}})
  let r=merged
  if(filterStatus.value!=='全部')r=r.filter(x=>x.status===filterStatus.value)
  if(filterHealth.value!=='全部'){const m={正常:'正常',临期:'临期',过期:'过期'};r=r.filter(x=>x.hcStatus===m[filterHealth.value])}
  if(filterDept.value)r=r.filter(x=>x.department===filterDept.value)
  if(keyword.value){const kw=keyword.value.toLowerCase();r=r.filter(x=>(x.name||'').includes(kw)||(x.employee_number||'').includes(kw)||(x.position||'').includes(kw)||(x.phone||'').includes(kw)||(x.department||'').includes(kw))}
  list.value=r;currentPage.value=1}catch(e){console.error(e)}finally{loading.value=false}}

const toggleCard=c=>{activeCard.value=activeCard.value===c?'':c;if(c==='total'){filterStatus.value='全部';filterHealth.value='全部'}else if(c==='active')filterStatus.value='在职';else if(c==='expiring')filterHealth.value='临期';else if(c==='expired')filterHealth.value='过期';fetchData()}
const openAdd=()=>{editingId.value=null;resetForm();showForm.value=true}
const editRow=r=>{editingId.value=r.id;Object.assign(form,{name:r.name,department:r.department,position:r.position,phone:r.phone,entry_date:r.entry_date,health_cert_expiry:r.health_cert_expiry,status:r.status,remarks:r.remarks||'',hc_number:r.hc_number||'',file_path:r.file_path||''});showForm.value=true}
const renewHC=r=>{form.health_cert_expiry='';editRow(r);form.status=r.status}
const deleteRow=async r=>{await ElMessageBox.confirm(`确定删除 ${r.name} 的员工记录？`,'确认删除',{type:'warning'});try{await axios.delete(`/api/personnel/${r.id}`,{data:{user_id:userId}});ElMessage.success('已删除');fetchData()}catch{ElMessage.error('删除失败')}}
const onSelectionChange=rows=>{selectedRows.value=rows}
const clearFilters=()=>{keyword.value='';filterStatus.value='全部';filterHealth.value='全部';filterDept.value='';activeCard.value='';fetchData()}
const exportExcel=()=>{window.open('/api/personnel/export?user_id='+userId)}
const importHealthCerts=(file)=>{const fd=new FormData();fd.append('file',file.raw);fd.append('user_id',userId);axios.post('/api/health-certs/import',fd).then(r=>{ElMessage.success(r.data.message);fetchData()}).catch(e=>{ElMessage.error(e.response?.data?.message||'导入失败')})}
const downloadTemplate=()=>{window.open('/api/health-certs/template')}
const doVerify=(file)=>{const fd=new FormData();fd.append('file',file.raw);fd.append('user_id',userId);verifying.value=true;verifyResult.value=null;axios.post('/api/health-certs/verify',fd).then(r=>{verifyResult.value=r.data}).catch(e=>{verifyResult.value={verified:false,verdict:'验证失败',suggestion:e.response?.data?.message||'网络错误'}}).finally(()=>{verifying.value=false})}
const copyToClipboard=(text)=>{navigator.clipboard.writeText(text).then(()=>{ElMessage.success('已复制到剪贴板')}).catch(()=>{ElMessage.error('复制失败')})}
const batchExport=()=>{const ids=selectedRows.value.map(r=>r.id).join(',');window.open('/api/personnel/export?user_id='+userId+'&ids='+ids)}
const batchDelete=async()=>{await ElMessageBox.confirm(`确定删除选中的 ${selectedRows.value.length} 人？`,'批量删除',{type:'warning'});try{const ids=selectedRows.value.map(r=>r.id);await axios.post('/api/personnel/batch-delete',{user_id:userId,ids});ElMessage.success(`已删除 ${ids.length} 人`);tableRef.value?.clearSelection();fetchData()}catch{ElMessage.error('删除失败')}}
const resetForm=()=>{Object.assign(form,{name:'',department:'',position:'',phone:'',entry_date:'',health_cert_expiry:'',status:'在职',remarks:'',hc_number:'',file_path:''});aiText.value=''}
const uploadFile=ref(null)
const onFileChange=(file)=>{uploadFile.value=file.raw}
const onFileRemove=()=>{uploadFile.value=null}
const save=async()=>{if(!form.name)return ElMessage.warning('请填写姓名');saving.value=true;try{
  if(uploadFile.value){const fd=new FormData();fd.append('file',uploadFile.value);const upRes=await axios.post('/api/upload',fd);form.file_path=upRes.data.filename}
  if(editingId.value)await axios.put(`/api/personnel/${editingId.value}`,{user_id:userId,...form});else await axios.post('/api/personnel',{user_id:userId,...form})
  ElMessage.success(editingId.value?'更新成功':'添加成功');showForm.value=false;resetForm();uploadFile.value=null;await fetchData()}catch(e){ElMessage.error(e.response?.data?.message||'操作失败')}finally{saving.value=false}}
const aiFill=async()=>{if(!aiText.value.trim())return;aiLoading.value=true;try{const r=await axios.post('/api/ai/extract-person',{text:aiText.value});if(r.data.method==='ai'){const d=r.data;if(d.name)form.name=d.name;if(d.department)form.department=d.department;if(d.position)form.position=d.position;if(d.phone)form.phone=d.phone;if(d.health_cert_expiry)form.health_cert_expiry=d.health_cert_expiry;if(d.entry_date)form.entry_date=d.entry_date;aiText.value='';ElMessage.success('AI已填写，请核对')}}catch{ElMessage.error('AI异常')}finally{aiLoading.value=false}}
onMounted(fetchData)
</script>

<style scoped>
/* ===== 页面容器 ===== */
.page-wrap{max-width:1400px;margin:0 auto}

/* ===== 顶部标题栏 ===== */
.top-bar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.top-left{display:flex;align-items:baseline;gap:10px}
.top-left h1{font-size:18px;font-weight:600;color:#1a1a2e;margin:0;line-height:1}
.top-sub{font-size:12px;color:#999}
.top-right{display:flex;gap:8px}

/* ===== 按钮 ===== */
.btn-ghost{background:#fff;border:0.5px solid #d0d0d0;color:#666;border-radius:6px}
.btn-main{background:#378ADD;color:#fff;border:none;border-radius:6px;font-weight:500}
.btn-main:hover{background:#2b6fc4}

/* ===== 统计卡片 ===== */
.stat-row{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:14px}
.stat-card{border-radius:10px;padding:14px 16px;cursor:pointer;border:2px solid transparent;transition:all .2s}
.stat-card:hover{transform:translateY(-2px);box-shadow:0 4px 12px rgba(0,0,0,.06)}
.stat-card.on{border-color:#378ADD;box-shadow:0 0 0 3px rgba(55,138,221,.12)}
.stat-blue{background:#EBF3FE}.stat-blue .stat-num{color:#378ADD}.stat-blue .stat-sub{color:#6A9FD8}
.stat-green{background:#EAF3DE}.stat-green .stat-num{color:#639922}.stat-green .stat-sub{color:#8AB562}
.stat-orange{background:#FEF6E7}.stat-orange .stat-num{color:#BA7517}.stat-orange .stat-sub{color:#D49A3F}
.stat-red{background:#FCEBEB}.stat-red .stat-num{color:#A32D2D}.stat-red .stat-sub{color:#C45A5A}
.stat-num{font-size:26px;font-weight:700;line-height:1.1;position:relative;display:inline-block}
.stat-dot{position:absolute;top:1px;right:-8px;width:7px;height:7px;background:#E24B4A;border-radius:50%;display:inline-block}
.stat-label{font-size:12px;font-weight:500;color:#555;margin-top:2px}
.stat-sub{font-size:11px;margin-top:2px}

/* ===== 筛选栏 ===== */
.filter-bar{display:flex;align-items:center;gap:8px;flex-wrap:wrap;background:#fff;border-radius:10px;border:0.5px solid #e8e8e8;padding:10px 14px;margin-bottom:14px}
.filter-search{width:220px}
.filter-search :deep(.el-input__wrapper){border-radius:6px;box-shadow:none!important}
.filter-div{width:1px;height:18px;background:#e0e0e0;margin:0 4px}
.filter-label{font-size:12px;color:#999;margin-right:2px;flex-shrink:0}
.filter-tag{font-size:12px;padding:3px 12px;border-radius:20px;cursor:pointer;border:0.5px solid #d0d0d0;background:#fff;color:#555;transition:all .15s;user-select:none;line-height:1.4}
.filter-tag:hover{border-color:#378ADD;color:#378ADD}
.filter-tag.on{background:#378ADD;color:#fff;border-color:#378ADD}

/* ===== 表格 ===== */
.table-wrap{background:#fff;border-radius:10px;border:0.5px solid #e8e8e8;overflow:hidden}
.table-wrap :deep(.el-table){font-size:13px}
.table-wrap :deep(.el-table th){font-size:11px;color:#888;font-weight:500;background:#f8f9fb;padding:10px 0}
.table-wrap :deep(.el-table td){padding:10px 0}
.table-wrap :deep(.el-table__body tr:hover td){background:#f7f9fc!important}
.table-wrap :deep(.row-expired){border-left:3px solid #E24B4A}
.table-wrap :deep(.row-expired td){background:#FFFAFA!important}
.table-wrap :deep(.row-expiring){border-left:3px solid #EF9F27}
.table-wrap :deep(.el-table__empty-block){min-height:120px}

/* 表格内元素 */
.nc{font-weight:500;white-space:nowrap}
.tg{font-size:11px;padding:2px 8px;border-radius:8px;white-space:nowrap}
.tg-ok{background:#EAF3DE;color:#3B6D11}
.tg-off{background:#f0f0f0;color:#999}
.tg-trial{background:#FEF6E7;color:#854F0B}
.tg-warn{background:#FEF6E7;color:#854F0B}
.tg-bad{background:#FCEBEB;color:#A32D2D}
.tg-none{background:#f5f5f5;color:#bbb}
.dt-临期{color:#BA7517;font-weight:500}
.dt-过期{color:#A32D2D;font-weight:500}

/* ===== 批量操作栏 ===== */
.batch-bar{background:#EBF3FE;border:0.5px solid #B5D4F4;border-radius:8px;padding:10px 16px;display:flex;align-items:center;gap:10px;margin-top:10px}
.batch-bar>span:first-child{font-size:13px;color:#185FA5;font-weight:500}
.batch-btn-outline{border:0.5px solid #378ADD;color:#378ADD;background:#fff}

/* 附件按钮 */
.file-btn{display:inline-flex;align-items:center;gap:3px;background:#EBF3FE;color:#378ADD;padding:3px 10px;border-radius:6px;text-decoration:none;font-size:11px;transition:all .15s;white-space:nowrap}
.file-btn:hover{background:#378ADD;color:#fff}
.file-icon{font-size:14px;line-height:1}
.file-txt{font-weight:500}
.file-none{color:#ccc;font-size:13px}

/* 分页 */
.pager{display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border-top:0.5px solid #f0f0f0}
.pager-total{font-size:13px;color:#999}

/* 真伪验证 */
.btn-verify{background:#fff;border:1px solid #EF9F27;color:#BA7517;border-radius:6px}
.btn-verify:hover{background:#FEF6E7}
.verify-info{background:#f8f9fb;border-radius:8px;padding:12px 16px}
.vi-row{display:flex;justify-content:space-between;padding:4px 0;font-size:13px;border-bottom:0.5px solid #eee}
.vi-row:last-child{border:none}
.vi-row span{color:#999}
.vi-row b{color:#333;font-weight:500}
.vi-compare{font-size:13px;padding:2px 0}

/* ===== 弹窗 ===== */
.ai{margin-bottom:12px;padding:10px;background:#E6F1FB;border-radius:8px;border:1px solid #B5D4F4}
.ai .el-button{width:100%}
</style>
