<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>培训考核</h2>
    </div>
    <el-tabs v-model="activeTab" class="main-tabs">
      <el-tab-pane label="培训计划" name="plans">
        <TrainingPlans />
      </el-tab-pane>
      <el-tab-pane label="培训课程" name="courses">
        <TrainingCourses />
      </el-tab-pane>
      <el-tab-pane label="培训记录" name="records">
        <TrainingRecords />
      </el-tab-pane>
      <el-tab-pane label="考核管理" name="exams">
        <TrainingExams />
      </el-tab-pane>
      <el-tab-pane label="证书管理" name="certs">
        <TrainingCerts />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import TrainingPlans from './Plans.vue'
import TrainingCourses from './Courses.vue'
import TrainingRecords from './Records.vue'
import TrainingExams from './Exams.vue'
import TrainingCerts from './Certs.vue'

const activeTab = ref('plans')
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}
.main-tabs :deep(.el-tabs__header){margin-bottom:0}
</style>
