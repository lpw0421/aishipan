<template>
  <div class="page-container">
    <div class="toolbar"><h2>标签审核</h2></div>
    <el-tabs v-model="activeTab" type="border-card">
      <el-tab-pane label="智能审核" name="smart">
        <SmartAudit v-if="activeTab === 'smart'" />
      </el-tab-pane>
      <el-tab-pane label="多国出口审核" name="export">
        <ExportAudit v-if="activeTab === 'export'" />
      </el-tab-pane>
      <el-tab-pane label="营养成分生成" name="nutrition">
        <NutritionGen v-if="activeTab === 'nutrition'" />
      </el-tab-pane>
      <el-tab-pane label="配料表校验" name="ingredients">
        <IngredientsVerify v-if="activeTab === 'ingredients'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import SmartAudit from '../ai/SmartAudit.vue'
import ExportAudit from '../ai/ExportAudit.vue'
import NutritionGen from '../ai/NutritionGen.vue'
import IngredientsVerify from '../ai/IngredientsVerify.vue'

const activeTab = ref('smart')
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
</style>
