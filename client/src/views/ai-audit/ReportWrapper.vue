<template>
  <div class="page-container">
    <div class="toolbar"><h2>文件报告</h2></div>
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="客诉报告助手" name="complaint">
        <ComplaintReport v-if="activeTab === 'complaint'" />
      </el-tab-pane>
      <el-tab-pane label="文件编制助手" name="document">
        <DocumentHelper v-if="activeTab === 'document'" />
      </el-tab-pane>
      <el-tab-pane label="SOP 撰写助手" name="sop">
        <SopHelper v-if="activeTab === 'sop'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ComplaintReport from './ComplaintReport.vue'
import DocumentHelper from './DocumentHelper.vue'
import SopHelper from './SopHelper.vue'

const activeTab = ref('complaint')
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
</style>
