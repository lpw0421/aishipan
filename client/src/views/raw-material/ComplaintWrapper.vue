<template>
  <div>
    <div class="toolbar sub-toolbar">
      <span></span>
      <router-link to="/complaint/list">
        <el-button type="primary" size="small">客诉列表</el-button>
      </router-link>
    </div>

    <el-tabs v-model="subTab" class="sub-tabs">
      <el-tab-pane label="客诉看板" name="dashboard">
        <ComplaintDashboard v-if="subTab === 'dashboard'" />
      </el-tab-pane>
      <el-tab-pane label="客诉列表" name="list">
        <ComplaintList v-if="subTab === 'list'" />
      </el-tab-pane>
      <el-tab-pane label="客诉处理" name="handle">
        <ComplaintHandle v-if="subTab === 'handle'" />
      </el-tab-pane>
      <el-tab-pane label="满意度追踪" name="satisfaction">
        <ComplaintSatisfaction v-if="subTab === 'satisfaction'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ComplaintDashboard from '../complaint/Dashboard.vue'
import ComplaintList from '../complaint/List.vue'
import ComplaintHandle from '../complaint/Handle.vue'
import ComplaintSatisfaction from '../complaint/Satisfaction.vue'

const subTab = ref('dashboard')
</script>

<style scoped>
.sub-tabs :deep(.el-tabs__header){margin-bottom:8px}
.sub-toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:0}
</style>
