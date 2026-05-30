<template>
  <div class="page-container">
    <div class="toolbar"><h2>合规审核</h2></div>
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="供应商合规审核" name="supplier">
        <SupplierAudit v-if="activeTab === 'supplier'" />
      </el-tab-pane>
      <el-tab-pane label="标签审核" name="label">
        <LabelWrapper v-if="activeTab === 'label'" />
      </el-tab-pane>
      <el-tab-pane label="原料验收助手" name="material">
        <MaterialInspection v-if="activeTab === 'material'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SupplierAudit from './SupplierAudit.vue'
import LabelWrapper from './LabelWrapper.vue'
import MaterialInspection from './MaterialInspection.vue'

const activeTab = ref('supplier')
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
</style>
