<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>虫害管理</h2>
    </div>
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="供应商资质" name="supplier">
        <PestSupplier v-if="activeTab === 'supplier'" />
      </el-tab-pane>
      <el-tab-pane label="人员管理" name="staff">
        <PestStaff v-if="activeTab === 'staff'" />
      </el-tab-pane>
      <el-tab-pane label="化学品管理" name="chemicals">
        <PestChemicals v-if="activeTab === 'chemicals'" />
      </el-tab-pane>
      <el-tab-pane label="服务记录" name="service-records">
        <PestServiceRecords v-if="activeTab === 'service-records'" />
      </el-tab-pane>
      <el-tab-pane label="服务报告" name="service-reports">
        <PestServiceReports v-if="activeTab === 'service-reports'" />
      </el-tab-pane>
      <el-tab-pane label="投诉整改" name="complaints">
        <PestComplaints v-if="activeTab === 'complaints'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import PestSupplier from './Supplier.vue'
import PestStaff from './Staff.vue'
import PestChemicals from './Chemicals.vue'
import PestServiceRecords from './ServiceRecords.vue'
import PestServiceReports from './ServiceReports.vue'
import PestComplaints from './Complaints.vue'

const activeTab = ref('supplier')
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.main-tabs :deep(.el-tabs__header){margin-bottom:0}
</style>
