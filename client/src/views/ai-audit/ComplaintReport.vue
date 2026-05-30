<template>
  <div class="page-container">
    <div class="toolbar"><h2>客诉报告助手</h2></div>
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="客诉分类定级" name="classify">
        <ComplaintClassify v-if="activeTab === 'classify'" />
      </el-tab-pane>
      <el-tab-pane label="客诉回复生成" name="reply">
        <ComplaintReply v-if="activeTab === 'reply'" />
      </el-tab-pane>
      <el-tab-pane label="客诉根因分析" name="analysis">
        <ComplaintAnalysis v-if="activeTab === 'analysis'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import ComplaintClassify from '../ai/ComplaintClassify.vue'
import ComplaintReply from '../ai/ComplaintReply.vue'
import ComplaintAnalysis from '../ai/ComplaintAnalysis.vue'

const activeTab = ref('classify')
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
</style>
