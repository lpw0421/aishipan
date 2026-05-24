<template>
  <div class="page-container">
    <div class="toolbar"><h2>批次追溯</h2></div>

    <el-row :gutter="20">
      <!-- 正向追溯 -->
      <el-col :span="12">
        <el-card>
          <template #header><strong>正向追溯</strong><span class="text-muted"> （原料 → 成品）</span></template>
          <el-input v-model="forwardBatch" placeholder="输入原料批次号，如 RM-20260524-001" @keyup.enter="doForward">
            <template #append><el-button @click="doForward" :loading="fwLoading">追溯</el-button></template>
          </el-input>
          <div v-if="fwResult" class="trace-result mt20">
            <el-steps direction="vertical" :active="3" finish-status="success">
              <el-step title="原料验收" :description="fwResult.raw_material_batch?.material_name + ' | ' + fwResult.raw_material_batch?.batch_number + ' | ' + fwResult.raw_material_batch?.supplier" />
              <el-step title="生产投料" description="领用出库 → 生产车间投料（需对接生产系统）" />
              <el-step title="成品入库" description="成品批次 → 检验合格 → 销售流向（需对接生产系统）" />
            </el-steps>
            <el-divider />
            <el-descriptions :column="1" border size="small">
              <el-descriptions-item label="原料批次">{{ fwResult.raw_material_batch?.batch_number }}</el-descriptions-item>
              <el-descriptions-item label="原料名称">{{ fwResult.raw_material_batch?.material_name }}</el-descriptions-item>
              <el-descriptions-item label="供应商">{{ fwResult.raw_material_batch?.supplier }}</el-descriptions-item>
              <el-descriptions-item label="到货日期">{{ fwResult.raw_material_batch?.arrival_time?.slice(0,10) }}</el-descriptions-item>
              <el-descriptions-item label="验收结果">{{ fwResult.raw_material_batch?.judge_result || '待判定' }}</el-descriptions-item>
            </el-descriptions>
          </div>
          <div v-if="fwError" class="mt20"><el-alert :title="fwError" type="error" :closable="false" /></div>
        </el-card>
      </el-col>

      <!-- 逆向追溯 -->
      <el-col :span="12">
        <el-card>
          <template #header><strong>逆向追溯</strong><span class="text-muted"> （成品 → 原料）</span></template>
          <el-input v-model="backwardBatch" placeholder="输入成品批次号，如 FG-20260524-001" @keyup.enter="doBackward">
            <template #append><el-button @click="doBackward" :loading="bwLoading">追溯</el-button></template>
          </el-input>
          <div v-if="bwResult" class="trace-result mt20">
            <el-steps direction="vertical" :active="3" finish-status="success">
              <el-step title="成品批次" :description="bwResult.finished_goods_batch" />
              <el-step title="生产批次" description="投料记录 → 领用记录（需对接生产系统）" />
              <el-step title="原料批次" description="原料批次 → 验收记录 → 供应商（需对接生产系统）" />
            </el-steps>
            <el-divider />
            <el-alert title="提示" :description="bwResult.message" type="info" :closable="false" />
          </div>
          <div v-if="bwError" class="mt20"><el-alert :title="bwError" type="error" :closable="false" /></div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import axios from 'axios'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const forwardBatch = ref('')
const backwardBatch = ref('')
const fwLoading = ref(false)
const bwLoading = ref(false)
const fwResult = ref(null)
const bwResult = ref(null)
const fwError = ref('')
const bwError = ref('')

async function doForward() {
  if (!forwardBatch.value) return
  fwLoading.value = true; fwError.value = ''; fwResult.value = null
  try {
    const { data } = await axios.post('/api/traceability/forward', { user_id: user.id, batch_number: forwardBatch.value })
    fwResult.value = data.trace_chain
  } catch (e) {
    fwError.value = e.response?.data?.message || '追溯失败'
  } finally { fwLoading.value = false }
}

async function doBackward() {
  if (!backwardBatch.value) return
  bwLoading.value = true; bwError.value = ''; bwResult.value = null
  try {
    const { data } = await axios.post('/api/traceability/backward', { user_id: user.id, batch_number: backwardBatch.value })
    bwResult.value = data.trace_chain
  } catch (e) {
    bwError.value = e.response?.data?.message || '追溯失败'
  } finally { bwLoading.value = false }
}
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.mt20{margin-top:20px}
.text-muted{color:#909399;font-size:13px}
.trace-result{margin-top:16px}
</style>
