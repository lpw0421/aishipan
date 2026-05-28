<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>物料管理</h2>
    </div>

    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="原料信息" name="info">
        <div class="toolbar sub-toolbar">
          <span></span>
          <el-button type="primary" @click="openAdd">新增原料</el-button>
        </div>

    <!-- 统计卡片 -->
    <el-row :gutter="16" class="stat-row">
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card" @click="filterRisk='';filterStatus='';fetchList()">
          <div class="stat-num">{{ stats.total }}</div>
          <div class="stat-label">原料总数</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-danger" @click="filterRisk='高';fetchList()">
          <div class="stat-num danger">{{ stats.high }}</div>
          <div class="stat-label">高风险</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-warning" @click="filterRisk='中';fetchList()">
          <div class="stat-num warning">{{ stats.medium }}</div>
          <div class="stat-label">中风险</div>
        </el-card>
      </el-col>
      <el-col :span="6">
        <el-card shadow="hover" class="stat-card stat-info" @click="filterStatus='停用';fetchList()">
          <div class="stat-num info">{{ stats.stopped }}</div>
          <div class="stat-label">已停用</div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 搜索筛选 -->
    <el-card class="filter-card">
      <el-input v-model="keyword" placeholder="搜索原料名称、编号或类别" style="width:260px" clearable @input="onSearchInput">
        <template #prefix><el-icon><Search /></el-icon></template>
      </el-input>
      <el-select v-model="filterCategory" placeholder="类别" style="width:140px" clearable @change="fetchList">
        <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
      </el-select>
      <el-select v-model="filterRisk" placeholder="风险等级" style="width:120px" clearable @change="fetchList">
        <el-option label="高" value="高" /><el-option label="中" value="中" /><el-option label="低" value="低" />
      </el-select>
      <el-select v-model="filterStatus" placeholder="状态" style="width:100px" clearable @change="fetchList">
        <el-option label="启用" value="启用" /><el-option label="停用" value="停用" />
      </el-select>
      <el-select v-model="filterStorage" placeholder="储存条件" style="width:140px" clearable @change="fetchList">
        <el-option label="冷藏" value="冷藏" /><el-option label="冷冻" value="冷冻" /><el-option label="常温" value="常温" /><el-option label="避光" value="避光" />
      </el-select>
    </el-card>

    <!-- 快捷筛选项 -->
    <div class="quick-tags">
      <el-tag :type="!filterRisk&&!filterStatus&&!keyword?'':'info'" class="tag-btn" @click="clearAllFilters">全部</el-tag>
      <el-tag class="tag-btn" :type="filterRisk==='高'?'danger':'info'" @click="filterRisk=filterRisk==='高'?'':'高';fetchList()">高风险</el-tag>
      <el-tag class="tag-btn" :type="filterCategory==='原料肉'?'':'info'" @click="filterCategory=filterCategory==='原料肉'?'':'原料肉';fetchList()">原料肉</el-tag>
      <el-tag class="tag-btn" :type="filterCategory==='食品添加剂'?'':'info'" @click="filterCategory=filterCategory==='食品添加剂'?'':'食品添加剂';fetchList()">食品添加剂</el-tag>
      <el-tag class="tag-btn" :type="filterStatus==='停用'?'danger':'info'" @click="filterStatus=filterStatus==='停用'?'':'停用';fetchList()">已停用</el-tag>
    </div>

    <!-- 批量操作 -->
    <div class="batch-bar" v-if="selectedIds.length > 0">
      <span class="batch-tip">已选 {{ selectedIds.length }} 项</span>
      <el-button type="danger" plain size="small" @click="batchDelete">批量删除</el-button>
      <el-button plain size="small" @click="batchToggleStatus('启用')">批量启用</el-button>
      <el-button plain size="small" @click="batchToggleStatus('停用')">批量停用</el-button>
      <el-button plain size="small" @click="exportExcel">导出Excel</el-button>
    </div>

    <!-- 数据表格 -->
    <el-card>
      <el-table :data="pagedList" v-loading="loading" stripe @selection-change="onSelectionChange" :max-height="560">
        <el-table-column type="selection" width="45" />
        <el-table-column prop="material_number" label="原料编号" width="100" />
        <el-table-column prop="material_name" label="原料名称" min-width="130" show-overflow-tooltip />
        <el-table-column prop="category" label="类别" width="110">
          <template #default="{row}"><el-tag size="small" type="info">{{ row.category }}</el-tag></template>
        </el-table-column>
        <el-table-column prop="risk_level" label="风险等级" width="100">
          <template #default="{row}">
            <span class="risk-tag" :class="'risk-'+ (row.risk_level==='高'?'high':row.risk_level==='中'?'mid':'low')">
              <span class="risk-dot"></span>{{ row.risk_level }}
            </span>
          </template>
        </el-table-column>
        <el-table-column prop="specification" label="规格" width="100" show-overflow-tooltip />
        <el-table-column prop="shelf_life" label="保质期(月)" width="100" />
        <el-table-column prop="storage_condition" label="储存条件" width="110" show-overflow-tooltip>
          <template #default="{row}">
            <el-tag size="small" :type="row.storage_condition.includes('冻')?'':'success'" effect="plain">
              {{ row.storage_condition }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="status" label="状态" width="80">
          <template #default="{row}">
            <el-tag :type="row.status==='启用'?'success':'info'" size="small">{{ row.status }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="140" fixed="right">
          <template #default="{row}">
            <el-button link type="primary" size="small" @click="editRow(row)">编辑</el-button>
            <el-button link type="danger" size="small" @click="deleteRow(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>

      <!-- 空状态 -->
      <el-empty v-if="!loading && filteredList.length === 0 && !keyword" description="原料库暂无数据">
        <el-button type="primary" @click="openAdd">新增原料</el-button>
      </el-empty>
      <el-empty v-if="!loading && filteredList.length === 0 && keyword" description="未找到匹配的原料，请调整搜索条件">
        <el-button @click="clearAllFilters">清除筛选</el-button>
      </el-empty>

      <!-- 分页 -->
      <div class="pagination-wrap" v-if="filteredList.length > 0">
        <el-pagination
          v-model:current-page="currentPage"
          v-model:page-size="pageSize"
          :page-sizes="[10, 20, 50]"
          :pager-count="5"
          layout="total, sizes, prev, pager, next"
          :total="filteredList.length"
          background
          small
        />
      </div>
    </el-card>

    <!-- 新增/编辑对话框 -->
    <el-dialog :title="editingId ? '编辑原料' : '新增原料'" v-model="showAdd" width="600px" @close="resetForm">
      <el-form :model="form" label-width="100px">
        <el-form-item label="原料名称"><el-input v-model="form.material_name" placeholder="请输入原料名称" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="类别"><el-select v-model="form.category" style="width:100%" filterable><el-option v-for="c in categories" :key="c" :label="c" :value="c" /></el-select></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="风险等级"><el-select v-model="form.risk_level" style="width:100%"><el-option label="高" value="高" /><el-option label="中" value="中" /><el-option label="低" value="低" /></el-select></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="规格型号"><el-input v-model="form.specification" placeholder="如：25kg/袋" /></el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="保质期(月)"><el-input-number v-model="form.shelf_life" :min="0" style="width:100%" /></el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="储存条件"><el-select v-model="form.storage_condition" style="width:100%"><el-option label="冷藏 0~4°C" value="冷藏 0~4°C" /><el-option label="冷冻 ≤-18°C" value="冷冻 ≤-18°C" /><el-option label="常温 ≤25°C" value="常温 ≤25°C" /><el-option label="避光常温" value="避光常温" /></el-select></el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="执行标准"><el-input v-model="form.executive_standard" placeholder="如：GB 2707-2016" /></el-form-item>
        <el-form-item label="过敏原信息"><el-input v-model="form.allergen_info" placeholder='如：含大豆、小麦，无则填"无"' /></el-form-item>
        <el-form-item label="状态"><el-radio-group v-model="form.status"><el-radio value="启用">启用</el-radio><el-radio value="停用">停用</el-radio></el-radio-group></el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAdd = false">取消</el-button>
        <el-button type="primary" @click="save" :loading="saving">保存</el-button>
      </template>
    </el-dialog>

    <!-- 验收标准配置对话框 -->
    <el-dialog :title="'验收标准 — ' + (currentMaterial?.material_name || '')" v-model="showStandard" width="650px" @close="resetStandardConfig">
      <el-form v-if="currentMaterial" label-width="120px">
        <el-form-item label="原料">
          <el-tag type="info">{{ currentMaterial.material_number }}</el-tag>
          <span style="margin-left:8px">{{ currentMaterial.material_name }}</span>
          <el-tag size="small" style="margin-left:8px" :type="currentMaterial.risk_level==='高'?'danger':currentMaterial.risk_level==='中'?'warning':'success'">{{ currentMaterial.risk_level }}风险</el-tag>
        </el-form-item>
        <el-form-item label="温度标准">
          <el-select v-model="standardConfig.temp_standard" style="width:250px">
            <el-option label="冷冻 ≤-18°C" value="冷冻 ≤-18°C" />
            <el-option label="冷藏 0~4°C" value="冷藏 0~4°C" />
            <el-option label="冷藏 0~8°C" value="冷藏 0~8°C" />
            <el-option label="常温 ≤25°C" value="常温 ≤25°C" />
            <el-option label="常温避光" value="常温避光" />
          </el-select>
        </el-form-item>
        <el-form-item label="证件要求">
          <el-checkbox-group v-model="standardConfig.cert_requirements">
            <el-checkbox value="营业执照">营业执照</el-checkbox>
            <el-checkbox value="食品许可证">食品许可证</el-checkbox>
            <el-checkbox value="检验报告">检验报告</el-checkbox>
            <el-checkbox value="检疫合格证">检疫合格证</el-checkbox>
            <el-checkbox value="报关单">报关单</el-checkbox>
            <el-checkbox value="第三方检测报告">第三方检测报告</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="感官检查项">
          <el-checkbox-group v-model="standardConfig.sensory_items">
            <el-checkbox value="色泽">色泽</el-checkbox>
            <el-checkbox value="气味">气味</el-checkbox>
            <el-checkbox value="弹性">弹性</el-checkbox>
            <el-checkbox value="粘度">粘度</el-checkbox>
            <el-checkbox value="组织状态">组织状态</el-checkbox>
            <el-checkbox value="异物">异物</el-checkbox>
            <el-checkbox value="霉变">霉变</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="包装要求">
          <el-input v-model="standardConfig.packaging_requirement" placeholder="如：包装完整无破损，标签规范" />
        </el-form-item>
        <el-form-item label="保质期剩余比例">
          <el-input-number v-model="standardConfig.shelf_life_ratio" :min="0" :max="1" :step="0.1" :precision="2" />
          <span class="text-muted ml8">（验收时剩余保质期不低于该比例）</span>
        </el-form-item>
        <el-form-item label="判定规则">
          <div class="rule-item">合格：<el-input v-model="standardConfig.judge_rules.pass" placeholder="所有检查项通过" /></div>
          <div class="rule-item">让步接收：<el-input v-model="standardConfig.judge_rules.concession" placeholder="1-2项轻微不合格" /></div>
          <div class="rule-item">拒收：<el-input v-model="standardConfig.judge_rules.reject" placeholder="证件缺失/温度严重超标/变质" /></div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStandard = false">取消</el-button>
        <el-button type="primary" @click="saveStandardConfig" :loading="savingStandard">保存</el-button>
      </template>
    </el-dialog>
      </el-tab-pane>

      <el-tab-pane label="原料标准" name="standards">
        <!-- 标准统计卡片 -->
        <el-row :gutter="16" class="stat-row">
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card" @click="standardFilterConfig='';standardPage=1">
              <div class="stat-num">{{ standardsStats.configured }}</div>
              <div class="stat-label">已配置标准</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card stat-warning" @click="standardFilterConfig='no';standardPage=1">
              <div class="stat-num warning">{{ standardsStats.unconfigured }}</div>
              <div class="stat-label">未配置标准</div>
            </el-card>
          </el-col>
          <el-col :span="8">
            <el-card shadow="hover" class="stat-card stat-info">
              <div class="stat-num info">{{ standardsStats.rate }}%</div>
              <div class="stat-label">配置率</div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 搜索筛选 -->
        <el-card class="filter-card">
          <el-input v-model="standardKeyword" placeholder="搜索原料名称或编号" style="width:240px" clearable @input="standardPage=1">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="standardFilterCategory" placeholder="类别" style="width:140px" clearable @change="standardPage=1">
            <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
          </el-select>
          <el-select v-model="standardFilterConfig" placeholder="配置状态" style="width:130px" clearable @change="standardPage=1">
            <el-option label="已配置" value="yes" /><el-option label="未配置" value="no" />
          </el-select>
          <el-select v-model="standardFilterRisk" placeholder="风险等级" style="width:120px" clearable @change="standardPage=1">
            <el-option label="高" value="高" /><el-option label="中" value="中" /><el-option label="低" value="低" />
          </el-select>
        </el-card>

        <!-- 标准表格 -->
        <el-card>
          <el-table :data="pagedStandards" stripe :max-height="560">
            <el-table-column prop="material_number" label="原料编号" width="100" />
            <el-table-column prop="material_name" label="原料名称" min-width="140" show-overflow-tooltip />
            <el-table-column prop="category" label="类别" width="110">
              <template #default="{row}"><el-tag size="small" type="info">{{ row.category }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="risk_level" label="风险等级" width="100">
              <template #default="{row}">
                <span class="risk-tag" :class="'risk-'+ (row.risk_level==='高'?'high':row.risk_level==='中'?'mid':'low')">
                  <span class="risk-dot"></span>{{ row.risk_level }}
                </span>
              </template>
            </el-table-column>
            <el-table-column label="配置状态" width="100">
              <template #default="{row}">
                <el-tag :type="row.hasStandard?'success':'info'" size="small">{{ row.hasStandard ? '已配置' : '未配置' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="100" fixed="right">
              <template #default="{row}">
                <el-button link type="primary" size="small" @click="openStandardConfig(row)">
                  {{ row.hasStandard ? '查看/编辑' : '配置标准' }}
                </el-button>
              </template>
            </el-table-column>
          </el-table>

          <el-empty v-if="!loading && filteredStandards.length === 0" description="未找到匹配的原料" />

          <div class="pagination-wrap" v-if="filteredStandards.length > 0">
            <el-pagination
              v-model:current-page="standardPage"
              v-model:page-size="standardPageSize"
              :page-sizes="[10, 20, 50]"
              :pager-count="5"
              layout="total, sizes, prev, pager, next"
              :total="filteredStandards.length"
              background
              small
            />
          </div>
        </el-card>

        <!-- 验收标准配置对话框（与原料信息Tab共用） -->

        <el-divider />
        <h4 class="section-title">标准变更记录</h4>
        <StandardChanges />
      </el-tab-pane>

      <el-tab-pane label="验收记录" name="inspection">
        <Inspection v-if="activeTab === 'inspection'" />
      </el-tab-pane>

      <el-tab-pane label="不合格品" name="nonconforming">
        <NonConforming v-if="activeTab === 'nonconforming'" source-type="原料验收" />
      </el-tab-pane>

      <el-tab-pane label="留样管理" name="samples">
        <Samples v-if="activeTab === 'samples'" sample-type="原料留样" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import Inspection from './Inspection.vue'
import NonConforming from './NonConforming.vue'
import Samples from './Samples.vue'
import StandardChanges from './StandardChanges.vue'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const list = ref([])
const loading = ref(false)
const saving = ref(false)
const keyword = ref('')
const filterCategory = ref('')
const filterRisk = ref('')
const filterStatus = ref('')
const filterStorage = ref('')
const showAdd = ref(false)
const editingId = ref(null)
const activeTab = ref('info')
const selectedIds = ref([])
const currentPage = ref(1)
const pageSize = ref(20)

// 原料标准 Tab 状态
const standardKeyword = ref('')
const standardFilterCategory = ref('')
const standardFilterConfig = ref('')
const standardFilterRisk = ref('')
const standardPage = ref(1)
const standardPageSize = ref(20)

// 验收标准
const showStandard = ref(false)
const currentMaterial = ref(null)
const savingStandard = ref(false)
const standardConfig = reactive({
  temp_standard: '', cert_requirements: [], sensory_items: [],
  packaging_requirement: '', shelf_life_ratio: 0.33,
  judge_rules: { pass: '', concession: '', reject: '' }
})

const categories = ['原料肉', '香辛料', '基础调味料', '复合调味料', '食品添加剂', '油脂类', '辅料', '蔬菜类', '肠衣', '包装材料', '其他']

const form = reactive({
  material_name: '', category: '其他', risk_level: '中', specification: '', shelf_life: 0,
  storage_condition: '', executive_standard: '', allergen_info: '', status: '启用'
})

// 统计
const stats = computed(() => ({
  total: list.value.length,
  high: list.value.filter(r => r.risk_level === '高').length,
  medium: list.value.filter(r => r.risk_level === '中').length,
  stopped: list.value.filter(r => r.status === '停用').length
}))

// 前端搜索筛选
const filteredList = computed(() => {
  let result = list.value
  if (keyword.value) {
    const kw = keyword.value.toLowerCase()
    result = result.filter(r =>
      (r.material_name || '').includes(kw) ||
      (r.material_number || '').toLowerCase().includes(kw) ||
      (r.category || '').includes(kw)
    )
  }
  if (filterCategory.value) result = result.filter(r => r.category === filterCategory.value)
  if (filterRisk.value) result = result.filter(r => r.risk_level === filterRisk.value)
  if (filterStatus.value) result = result.filter(r => r.status === filterStatus.value)
  if (filterStorage.value) result = result.filter(r => (r.storage_condition || '').includes(filterStorage.value))
  return result
})

const pagedList = computed(() => {
  const start = (currentPage.value - 1) * pageSize.value
  return filteredList.value.slice(start, start + pageSize.value)
})

// 原料标准 Tab
const standardsStats = computed(() => {
  const configured = list.value.filter(r => r.hasStandard).length
  const total = list.value.length
  return {
    configured,
    unconfigured: total - configured,
    rate: total ? Math.round((configured / total) * 100) : 0
  }
})

const filteredStandards = computed(() => {
  let result = list.value
  if (standardKeyword.value) {
    const kw = standardKeyword.value.toLowerCase()
    result = result.filter(r =>
      (r.material_name || '').includes(kw) ||
      (r.material_number || '').toLowerCase().includes(kw)
    )
  }
  if (standardFilterCategory.value) result = result.filter(r => r.category === standardFilterCategory.value)
  if (standardFilterRisk.value) result = result.filter(r => r.risk_level === standardFilterRisk.value)
  if (standardFilterConfig.value === 'yes') result = result.filter(r => r.hasStandard)
  if (standardFilterConfig.value === 'no') result = result.filter(r => !r.hasStandard)
  return result
})

const pagedStandards = computed(() => {
  const start = (standardPage.value - 1) * standardPageSize.value
  return filteredStandards.value.slice(start, start + standardPageSize.value)
})

// 搜索防抖
let searchTimer = null
function onSearchInput() {
  clearTimeout(searchTimer)
  searchTimer = setTimeout(() => { currentPage.value = 1; fetchList() }, 300)
}

function clearAllFilters() {
  keyword.value = ''
  filterCategory.value = ''
  filterRisk.value = ''
  filterStatus.value = ''
  filterStorage.value = ''
  currentPage.value = 1
  fetchList()
}

async function fetchList() {
  loading.value = true
  currentPage.value = 1
  selectedIds.value = []
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterCategory.value) params.category = filterCategory.value
    if (filterRisk.value) params.risk_level = filterRisk.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/raw-materials', { params })
    list.value = data.list
  } finally { loading.value = false }
}

function onSelectionChange(rows) { selectedIds.value = rows.map(r => r.id) }

function openAdd() { editingId.value = null; resetForm(); showAdd.value = true }

function editRow(row) {
  editingId.value = row.id
  Object.assign(form, {
    material_name: row.material_name, category: row.category, risk_level: row.risk_level,
    specification: row.specification, shelf_life: row.shelf_life, storage_condition: row.storage_condition,
    executive_standard: row.executive_standard, allergen_info: row.allergen_info, status: row.status
  })
  showAdd.value = true
}

async function deleteRow(row) {
  try { await ElMessageBox.confirm('确定删除该原料吗？此操作不可恢复。', '删除确认', { type: 'warning', confirmButtonText: '确认删除', cancelButtonText: '取消' }) } catch { return }
  await axios.delete(`/api/raw-materials/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchList()
}

async function batchDelete() {
  try { await ElMessageBox.confirm(`确定删除选中的 ${selectedIds.value.length} 项原料吗？此操作不可恢复。`, '批量删除', { type: 'warning' }) } catch { return }
  await axios.post('/api/raw-materials/batch-delete', { user_id: user.id, ids: selectedIds.value })
  ElMessage.success('批量删除成功')
  selectedIds.value = []
  fetchList()
}

async function batchToggleStatus(status) {
  try { await ElMessageBox.confirm(`确定将选中的 ${selectedIds.value.length} 项原料${status === '启用' ? '启用' : '停用'}吗？`, '批量操作', { type: 'warning' }) } catch { return }
  await axios.post('/api/raw-materials/batch-status', { user_id: user.id, ids: selectedIds.value, status })
  ElMessage.success(`已${status}`)
  selectedIds.value = []
  fetchList()
}

function exportExcel() {
  const ids = selectedIds.value.join(',')
  window.open(`/api/raw-materials/export?user_id=${user.id}&ids=${ids}`)
}

async function save() {
  if (!form.material_name) return ElMessage.warning('请填写原料名称')
  saving.value = true
  try {
    if (editingId.value) {
      await axios.put(`/api/raw-materials/${editingId.value}`, { user_id: user.id, ...form })
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/raw-materials', { user_id: user.id, ...form })
      ElMessage.success('添加成功')
    }
    showAdd.value = false
    resetForm()
    fetchList()
  } finally { saving.value = false }
}

function resetForm() {
  editingId.value = null
  Object.assign(form, {
    material_name: '', category: '其他', risk_level: '中', specification: '', shelf_life: 0,
    storage_condition: '', executive_standard: '', allergen_info: '', status: '启用'
  })
}

// ===== 验收标准 =====
async function openStandardConfig(row) {
  currentMaterial.value = row
  try {
    const { data } = await axios.get(`/api/raw-materials/${row.id}/standards`)
    if (data.standard) {
      const s = data.standard
      standardConfig.temp_standard = s.temp_standard || ''
      standardConfig.cert_requirements = JSON.parse(s.cert_requirements || '[]')
      standardConfig.sensory_items = JSON.parse(s.sensory_items || '[]')
      standardConfig.packaging_requirement = s.packaging_requirement || ''
      standardConfig.shelf_life_ratio = s.shelf_life_ratio || 0.33
      standardConfig.judge_rules = JSON.parse(s.judge_rules || '{}')
    } else {
      resetStandardConfig()
    }
  } catch { resetStandardConfig() }
  showStandard.value = true
}

function resetStandardConfig() {
  Object.assign(standardConfig, {
    temp_standard: '', cert_requirements: [], sensory_items: [],
    packaging_requirement: '', shelf_life_ratio: 0.33,
    judge_rules: { pass: '', concession: '', reject: '' }
  })
}

async function saveStandardConfig() {
  savingStandard.value = true
  try {
    await axios.post(`/api/raw-materials/${currentMaterial.value.id}/standards`, {
      user_id: user.id,
      ...standardConfig,
      cert_requirements: JSON.stringify(standardConfig.cert_requirements),
      sensory_items: JSON.stringify(standardConfig.sensory_items),
      judge_rules: JSON.stringify(standardConfig.judge_rules)
    })
    ElMessage.success('验收标准已保存')
    // 更新列表中的 hasStandard 状态
    currentMaterial.value.hasStandard = 1
    showStandard.value = false
  } catch { ElMessage.error('保存失败') }
  finally { savingStandard.value = false }
}

onMounted(fetchList)
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}

/* 主标签页 */
.main-tabs{margin-top:0}
.main-tabs :deep(.el-tabs__header){margin-bottom:0}
.sub-toolbar{margin-top:0;margin-bottom:16px}

/* 统计卡片 */
.stat-row{margin-bottom:16px}
.stat-card{cursor:pointer;text-align:center;transition:transform 0.2s}
.stat-card:hover{transform:translateY(-2px)}
.stat-num{font-size:28px;font-weight:bold;color:#303133}
.stat-num.danger{color:#f56c6c}
.stat-num.warning{color:#e6a23c}
.stat-num.info{color:#909399}
.stat-label{font-size:13px;color:#909399;margin-top:4px}

/* 筛选区 */
.filter-card{margin-bottom:12px}
.filter-card :deep(.el-card__body){display:flex;gap:10px;align-items:center;flex-wrap:wrap}

/* 快捷标签 */
.quick-tags{margin-bottom:12px;display:flex;gap:8px}
.tag-btn{cursor:pointer;user-select:none}
.tag-btn:hover{opacity:0.8}

/* 批量操作栏 */
.batch-bar{display:flex;align-items:center;gap:10px;padding:10px 16px;margin-bottom:12px;background:#f0f9ff;border:1px solid #b3d8ff;border-radius:6px}
.batch-tip{font-size:13px;color:#409eff;font-weight:500;margin-right:8px}

/* 风险等级样式 */
.risk-tag{display:inline-flex;align-items:center;gap:5px;padding:2px 10px;border-radius:4px;font-size:13px;font-weight:500}
.risk-tag.risk-high{background:#fef0f0;color:#f56c6c;border:1px solid #fab6b6}
.risk-tag.risk-mid{background:#fdf6ec;color:#e6a23c;border:1px solid #f3d19e}
.risk-tag.risk-low{background:#f0f9eb;color:#67c23a;border:1px solid #b3e19d}
.risk-dot{width:6px;height:6px;border-radius:50%}
.risk-high .risk-dot{background:#f56c6c}
.risk-mid .risk-dot{background:#e6a23c}
.risk-low .risk-dot{background:#67c23a}

/* 分页 */
.pagination-wrap{display:flex;justify-content:center;margin-top:16px}

/* 验收标准 */
.rule-item{margin-bottom:8px;display:flex;align-items:center;gap:8px}
.rule-item .el-input{width:320px}
.text-muted{color:#909399;font-size:12px}
.ml8{margin-left:8px}
.section-title{color:#303133;margin:12px 0}
</style>
