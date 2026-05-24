<template>
  <div class="page-container">
    <div class="toolbar"><h2>验收标准管理</h2></div>

    <!-- 标准模板 -->
    <el-card class="mb16">
      <template #header><strong>标准模板</strong><span class="text-muted"> — 选择模板快速套用</span></template>
      <el-row :gutter="16">
        <el-col :span="6" v-for="t in templates" :key="t.name">
          <el-card shadow="hover" class="template-card" @click="applyTemplate(t)">
            <div class="template-name">{{ t.name }}</div>
            <div class="template-info">适用：{{ t.category }}</div>
            <div class="template-info">温度：{{ t.temp_standard }}</div>
            <div class="template-info">证件 {{ t.cert_count }} 项 / 感官 {{ t.sensory_count }} 项</div>
          </el-card>
        </el-col>
      </el-row>
    </el-card>

    <!-- 原料列表 + 标准配置 -->
    <el-card>
      <el-input v-model="keyword" placeholder="搜索原料" style="width:260px" clearable @clear="fetchMaterials" @keyup.enter="fetchMaterials" />
      <el-button @click="fetchMaterials" class="ml12">查询</el-button>

      <el-table :data="materials" v-loading="loading" class="mt16" stripe @row-click="openConfig">
        <el-table-column prop="material_number" label="原料编号" width="100" />
        <el-table-column prop="material_name" label="原料名称" min-width="120" />
        <el-table-column prop="category" label="类别" width="100" />
        <el-table-column prop="risk_level" label="风险等级" width="100">
          <template #default="{row}"><el-tag :type="row.risk_level==='高'?'danger':row.risk_level==='中'?'warning':'success'" size="small">{{ row.risk_level }}</el-tag></template>
        </el-table-column>
        <el-table-column label="验收标准状态" width="130">
          <template #default="{row}">
            <el-tag :type="row.hasStandard?'success':'info'" size="small">{{ row.hasStandard ? '已配置' : '未配置' }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column label="操作" width="120">
          <template #default="{row}">
            <el-button size="small" type="primary" @click.stop="openConfig(row)">{{ row.hasStandard ? '编辑标准' : '配置标准' }}</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <!-- 标准配置对话框 -->
    <el-dialog title="验收标准配置" v-model="showConfig" width="650px">
      <el-form v-if="currentMaterial" label-width="120px">
        <el-form-item label="原料">
          <el-tag>{{ currentMaterial.material_number }}</el-tag> {{ currentMaterial.material_name }}
        </el-form-item>
        <el-form-item label="温度标准">
          <el-select v-model="config.temp_standard" style="width:250px">
            <el-option label="冷藏 0~4°C" value="冷藏 0~4°C" />
            <el-option label="冷冻 ≤-18°C" value="冷冻 ≤-18°C" />
            <el-option label="常温 ≤25°C" value="常温 ≤25°C" />
            <el-option label="冷藏 0~8°C" value="冷藏 0~8°C" />
          </el-select>
        </el-form-item>
        <el-form-item label="证件要求">
          <el-checkbox-group v-model="config.cert_requirements">
            <el-checkbox value="营业执照">营业执照</el-checkbox>
            <el-checkbox value="食品许可证">食品许可证</el-checkbox>
            <el-checkbox value="检验报告">检验报告</el-checkbox>
            <el-checkbox value="检疫合格证">检疫合格证</el-checkbox>
            <el-checkbox value="报关单">报关单</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="感官检查项">
          <el-checkbox-group v-model="config.sensory_items">
            <el-checkbox value="色泽">色泽</el-checkbox>
            <el-checkbox value="气味">气味</el-checkbox>
            <el-checkbox value="弹性">弹性</el-checkbox>
            <el-checkbox value="粘度">粘度</el-checkbox>
            <el-checkbox value="组织状态">组织状态</el-checkbox>
            <el-checkbox value="异物">异物</el-checkbox>
          </el-checkbox-group>
        </el-form-item>
        <el-form-item label="包装要求"><el-input v-model="config.packaging_requirement" placeholder="如：包装完整、标签规范" /></el-form-item>
        <el-form-item label="保质期要求"><el-input-number v-model="config.shelf_life_ratio" :min="0" :max="1" :step="0.1" :precision="2" /> 剩余比例（如 0.33 表示 > 1/3）</el-form-item>
        <el-form-item label="判定规则">
          <div>合格条件：<el-input v-model="config.judge_rules.pass" placeholder="所有检查项通过" style="width:300px" /></div>
          <div class="mt8">让步条件：<el-input v-model="config.judge_rules.concession" placeholder="1-2项轻微不合格" style="width:300px" /></div>
          <div class="mt8">拒收条件：<el-input v-model="config.judge_rules.reject" placeholder="证件缺失/温度严重超标" style="width:300px" /></div>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showConfig = false">取消</el-button>
        <el-button type="primary" @click="saveConfig">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'
import { ElMessage } from 'element-plus'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const materials = ref([])
const loading = ref(false)
const keyword = ref('')
const showConfig = ref(false)
const currentMaterial = ref(null)

const templates = [
  { name: '肉类通用模板', category: '肉类/海鲜', temp_standard: '冷藏 0~4°C / 冷冻 ≤-18°C',
    cert_requirements: ['营业执照','食品许可证','检验报告','检疫合格证','报关单'],
    sensory_items: ['色泽','气味','弹性','粘度','组织状态','异物'] },
  { name: '蔬菜通用模板', category: '蔬菜/水果', temp_standard: '冷藏 0~8°C',
    cert_requirements: ['营业执照','食品许可证','检验报告'],
    sensory_items: ['色泽','气味','组织状态','异物'] },
  { name: '常温原料模板', category: '粮食/调料/包材', temp_standard: '常温 ≤25°C',
    cert_requirements: ['营业执照','食品许可证'],
    sensory_items: ['色泽','气味','异物'] },
  { name: '乳制品模板', category: '乳制品/蛋类', temp_standard: '冷藏 0~4°C',
    cert_requirements: ['营业执照','食品许可证','检验报告','检疫合格证'],
    sensory_items: ['色泽','气味','粘度','组织状态','异物'] }
]

const config = reactive({
  temp_standard: '', cert_requirements: [], sensory_items: [],
  packaging_requirement: '', shelf_life_ratio: 0.33,
  judge_rules: { pass: '所有检查项通过', concession: '1-2项轻微不合格', reject: '证件缺失/温度严重超标' }
})

async function fetchMaterials() {
  loading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    const { data } = await axios.get('/api/raw-materials', { params })
    // 检查每个原料是否已配置标准
    for (const m of data.list) {
      const res = await axios.get(`/api/raw-materials/${m.id}/standards`)
      m.hasStandard = !!res.data.standard
    }
    materials.value = data.list
  } finally { loading.value = false }
}

async function openConfig(row) {
  currentMaterial.value = row
  // 加载已有标准配置
  const { data } = await axios.get(`/api/raw-materials/${row.id}/standards`)
  if (data.standard) {
    const s = data.standard
    config.temp_standard = s.temp_standard
    config.cert_requirements = JSON.parse(typeof s.cert_requirements === 'string' ? s.cert_requirements : '[]')
    config.sensory_items = JSON.parse(typeof s.sensory_items === 'string' ? s.sensory_items : '[]')
    config.packaging_requirement = s.packaging_requirement
    config.shelf_life_ratio = s.shelf_life_ratio
    config.judge_rules = JSON.parse(typeof s.judge_rules === 'string' ? s.judge_rules : '{}')
  } else {
    resetConfig()
  }
  showConfig.value = true
}

function applyTemplate(t) {
  config.temp_standard = t.temp_standard
  config.cert_requirements = [...t.cert_requirements]
  config.sensory_items = [...t.sensory_items]
  ElMessage.success('已套用模板：' + t.name)
}

async function saveConfig() {
  await axios.post(`/api/raw-materials/${currentMaterial.value.id}/standards`, {
    user_id: user.id, ...config
  })
  ElMessage.success('验收标准保存成功')
  showConfig.value = false
  fetchMaterials()
}

function resetConfig() {
  Object.assign(config, {
    temp_standard: '', cert_requirements: [], sensory_items: [],
    packaging_requirement: '', shelf_life_ratio: 0.33,
    judge_rules: { pass: '所有检查项通过', concession: '1-2项轻微不合格', reject: '证件缺失/温度严重超标' }
  })
}

onMounted(fetchMaterials)
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.mb16{margin-bottom:16px}
.mt16{margin-top:16px}
.mt8{margin-top:8px}
.ml12{margin-left:12px}
.text-muted{color:#909399;font-size:13px}
.template-card{cursor:pointer;text-align:center}
.template-card:hover{border-color:#409eff}
.template-name{font-size:16px;font-weight:600;color:#303133;margin-bottom:8px}
.template-info{font-size:12px;color:#909399;line-height:1.8}
</style>
