<template>
  <div class="page-container">
    <div class="toolbar"><h2>辅助工具</h2></div>
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="培训出题助手" name="exam">
        <ExamHelper v-if="activeTab === 'exam'" />
      </el-tab-pane>
      <el-tab-pane label="法规速查助手" name="regulation">
        <RegulationHelper v-if="activeTab === 'regulation'" />
      </el-tab-pane>
      <el-tab-pane label="HACCP 计划助手" name="haccp">
        <HaccpHelper v-if="activeTab === 'haccp'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ExamHelper from './ExamHelper.vue'
import RegulationHelper from './RegulationHelper.vue'
import HaccpHelper from './HaccpHelper.vue'

const activeTab = ref('exam')
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
</style>
