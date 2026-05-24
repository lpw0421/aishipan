<template>
  <div class="page-container">
    <div class="toolbar"><h2>AI 营养成分表生成</h2></div>

    <el-row :gutter="16">
      <el-col :span="10">
        <el-card shadow="hover">
          <template #header><span class="card-header">📝 配方输入</span></template>
          <el-form label-width="80px">
            <el-form-item label="产品名称"><el-input v-model="productName" placeholder="如：牛肉酱（200g/瓶）" /></el-form-item>
          </el-form>
          <div class="section-label">原料及用量（每100g产品）</div>
          <el-table :data="ingredients" border stripe size="small">
            <el-table-column label="序号" type="index" width="55" />
            <el-table-column label="原料名称" prop="name"><template #default="{row,$index}"><el-input v-model="row.name" placeholder="如：牛肉" size="small" /></template></el-table-column>
            <el-table-column label="用量(g)" width="100"><template #default="{row,$index}"><el-input-number v-model="row.amount" :min="0" :max="100" :precision="1" size="small" style="width:100%" /></template></el-table-column>
            <el-table-column label="操作" width="65"><template #default="{row,$index}"><el-button type="danger" size="small" :icon="Delete" circle @click="removeIngredient($index)" :disabled="ingredients.length<=1" /></template></el-table-column>
          </el-table>
          <el-button type="primary" link style="margin-top:10px" @click="addIngredient">+ 添加原料</el-button>
          <div style="margin-top:16px">
            <el-button type="primary" size="large" @click="handleGenerate" :loading="generating" :disabled="!productName||!hasIngredients" style="width:100%">🤖 AI 生成营养成分表</el-button>
          </div>
        </el-card>
      </el-col>

      <el-col :span="14">
        <el-card shadow="hover">
          <template #header><span class="card-header">📊 营养成分表</span></template>
          <div v-if="!generated && !generating" class="empty-hint">输入产品配方后，点击"AI 生成"自动计算</div>
          <div v-if="generating" class="empty-hint">🤖 AI 正在计算营养成分...</div>
          <div v-if="generated && nutrition">
            <div class="product-name-label">{{ nutrition.product_name || productName }}</div>
            <table class="nutrition-table">
              <thead>
                <tr><th>项目</th><th>每{{ basis }}</th><th>NRV%</th></tr>
              </thead>
              <tbody>
                <tr v-for="item in nutritionItems" :key="item.key">
                  <td>{{ item.label }}</td>
                  <td>{{ item.value }} {{ item.unit }}</td>
                  <td>{{ item.nrv }}</td>
                </tr>
              </tbody>
            </table>
            <div class="nutrition-note" v-if="nutrition.note">{{ nutrition.note }}</div>
            <div class="nutrition-basis">{{ nutrition.basis || '每100克(g)' }}</div>
            <div style="margin-top:16px;text-align:center">
              <el-button type="success" @click="exportAsImage">📷 导出为图片</el-button>
            </div>
          </div>
          <div v-if="generated && !nutrition && !generating" class="empty-hint"><p>{{ fallbackMsg }}</p></div>
        </el-card>
      </el-col>
    </el-row>

    <!-- 营养成分表预览(导出用) -->
    <div ref="exportRef" class="export-nutrition" v-show="false">
      <h3 style="text-align:center">{{ nutrition?.product_name || productName }}</h3>
      <table>
        <tr><th>项目</th><th>每{{ basis }}</th><th>NRV%</th></tr>
        <tr v-for="item in nutritionItems" :key="item.key"><td>{{ item.label }}</td><td>{{ item.value }} {{ item.unit }}</td><td>{{ item.nrv }}</td></tr>
      </table>
      <p style="text-align:center;margin-top:8px">{{ nutrition?.note || '' }}</p>
      <p style="text-align:center">{{ nutrition?.basis || '每100克(g)' }}</p>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, computed, nextTick } from 'vue'
import { ElMessage } from 'element-plus'
import { Delete } from '@element-plus/icons-vue'
import axios from 'axios'
import html2canvas from 'html2canvas'

const productName = ref('')
const ingredients = reactive([{ name:'', amount:0 }])
const generating = ref(false)
const generated = ref(false)
const nutrition = ref(null)
const fallbackMsg = ref('')
const exportRef = ref(null)

const hasIngredients = computed(() => ingredients.some(i => i.name && i.amount > 0))
const nutritionItems = computed(() => {
  if (!nutrition.value) return []
  const n = nutrition.value.nutrition
  if (!n) return []
  return [
    { key:'energy', label:'能量', value:n.energy?.value||'-', unit:n.energy?.unit||'kJ', nrv:n.energy?.nrv||'-' },
    { key:'protein', label:'蛋白质', value:n.protein?.value||'-', unit:n.protein?.unit||'g', nrv:n.protein?.nrv||'-' },
    { key:'fat', label:'脂肪', value:n.fat?.value||'-', unit:n.fat?.unit||'g', nrv:n.fat?.nrv||'-' },
    { key:'carbohydrate', label:'碳水化合物', value:n.carbohydrate?.value||'-', unit:n.carbohydrate?.unit||'g', nrv:n.carbohydrate?.nrv||'-' },
    { key:'sodium', label:'钠', value:n.sodium?.value||'-', unit:n.sodium?.unit||'mg', nrv:n.sodium?.nrv||'-' }
  ]
})
const basis = computed(() => nutrition.value?.basis || '100克(g)')

const addIngredient = () => { ingredients.push({ name:'', amount:0 }) }
const removeIngredient = (idx) => { if (ingredients.length > 1) ingredients.splice(idx, 1) }

const handleGenerate = async () => {
  if (!productName.value) { ElMessage.warning('请填写产品名称'); return }
  if (!hasIngredients.value) { ElMessage.warning('请至少填写一种原料'); return }
  generating.value = true; generated.value = false; nutrition.value = null
  try {
    const res = await axios.post('/api/ai-audit/nutrition', {
      product_name: productName.value,
      ingredients: ingredients.filter(i => i.name && i.amount > 0).map(i => ({ name:i.name, amount:i.amount }))
    })
    if (res.data.method === 'fallback') {
      fallbackMsg.value = res.data.message
      nutrition.value = null
    } else {
      nutrition.value = res.data
    }
    generated.value = true
  } catch (e) {
    ElMessage.error('生成失败，请重试')
  } finally { generating.value = false }
}

const exportAsImage = async () => {
  await nextTick()
  if (!exportRef.value) return
  try {
    const canvas = await html2canvas(exportRef.value, { backgroundColor:'#ffffff', scale:2 })
    const link = document.createElement('a')
    link.download = (productName.value||'营养成分表') + '.png'
    link.href = canvas.toDataURL('image/png')
    link.click()
    ElMessage.success('导出成功')
  } catch { ElMessage.error('导出失败') }
}
</script>

<style scoped>
.page-container { padding:0 }
.toolbar { display:flex; justify-content:space-between; align-items:center; margin-bottom:16px }
.toolbar h2 { margin:0; color:#303133 }
.card-header { font-weight:bold; color:#303133 }
.section-label { font-weight:bold; color:#606266; margin-bottom:8px; font-size:14px }
.empty-hint { text-align:center; color:#c0c4cc; padding:80px 20px; font-size:15px; line-height:1.8 }
.product-name-label { text-align:center; font-size:18px; font-weight:bold; margin-bottom:16px; color:#303133 }
.nutrition-table { width:100%; border-collapse:collapse; font-size:14px }
.nutrition-table th { background:#f5f7fa; padding:10px 12px; text-align:center; font-weight:bold; color:#303133; border:1px solid #dcdfe6 }
.nutrition-table td { padding:10px 12px; text-align:center; color:#606266; border:1px solid #dcdfe6 }
.nutrition-note { text-align:center; color:#909399; font-size:12px; margin-top:10px }
.nutrition-basis { text-align:center; color:#909399; font-size:13px; margin-top:4px }
.export-nutrition { width:400px; padding:30px }
.export-nutrition table { width:100%; border-collapse:collapse }
.export-nutrition th, .export-nutrition td { border:1px solid #333; padding:8px 10px; text-align:center; font-size:14px }
.export-nutrition th { background:#eee }
</style>
