<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>体系文件</h2>
    </div>
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="体系架构" name="architecture">
        <SystemArchitecture v-if="activeTab === 'architecture'" />
      </el-tab-pane>
      <el-tab-pane label="管理手册" name="manual">
        <SystemDocs v-if="activeTab === 'manual'" doc-type="manual" />
      </el-tab-pane>
      <el-tab-pane label="程序文件" name="procedure">
        <SystemDocs v-if="activeTab === 'procedure'" doc-type="procedure" />
      </el-tab-pane>
      <el-tab-pane label="作业指导书" name="sop">
        <SystemDocs v-if="activeTab === 'sop'" doc-type="sop" />
      </el-tab-pane>
      <el-tab-pane label="记录表单" name="form">
        <SystemDocs v-if="activeTab === 'form'" doc-type="form" />
      </el-tab-pane>
      <el-tab-pane label="外部文件" name="external">
        <SystemDocs v-if="activeTab === 'external'" doc-type="external" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SystemArchitecture from './Architecture.vue'
import SystemDocs from './SystemDocs.vue'

const activeTab = ref('architecture')
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.main-tabs :deep(.el-tabs__header){margin-bottom:0}
</style>
