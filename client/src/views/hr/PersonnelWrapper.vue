<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>人员综合</h2>
    </div>
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="人员信息" name="info">
        <Personnel />
      </el-tab-pane>
      <el-tab-pane label="健康证管理" name="health">
        <HealthCerts />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import Personnel from './Personnel.vue'
import HealthCerts from '../../views/HealthCerts.vue'

const activeTab = ref('info')
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.main-tabs :deep(.el-tabs__header){margin-bottom:0}
</style>
