<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>计量校准</h2>
    </div>
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="设备台账" name="devices">
        <CalibrationDevices />
      </el-tab-pane>
      <el-tab-pane label="校准计划" name="plans">
        <CalibrationPlans />
      </el-tab-pane>
      <el-tab-pane label="校准记录" name="records">
        <CalibrationRecords />
      </el-tab-pane>
      <el-tab-pane label="校准机构" name="agencies">
        <CalibrationAgencies />
      </el-tab-pane>
      <el-tab-pane label="异常处理" name="exceptions">
        <CalibrationExceptions />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import CalibrationDevices from './Devices.vue'
import CalibrationPlans from './Plans.vue'
import CalibrationRecords from './Records.vue'
import CalibrationAgencies from './Agencies.vue'
import CalibrationExceptions from './Exceptions.vue'

const activeTab = ref('devices')
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.main-tabs :deep(.el-tabs__header){margin-bottom:0}
</style>
