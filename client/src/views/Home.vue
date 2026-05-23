<template>
  <div class="home-container">
    <!-- 页面头部 -->
    <el-header class="home-header">
      <h1>AI 食安系统</h1>
      <el-tag type="success">v1.0</el-tag>
    </el-header>

    <!-- 主要内容区 -->
    <el-main>
      <el-row :gutter="20">
        <!-- 欢迎卡片 -->
        <el-col :span="8">
          <el-card>
            <template #header>欢迎使用</template>
            <p>欢迎使用 AI 食安食品企业管理系统。本系统帮助您高效管理食品安全相关业务。</p>
          </el-card>
        </el-col>

        <!-- 系统信息卡片 -->
        <el-col :span="8">
          <el-card>
            <template #header>系统信息</template>
            <p>当前版本：v1.0</p>
            <p>技术栈：Vue3 + Element Plus + Express + SQLite</p>
          </el-card>
        </el-col>

        <!-- 功能预告卡片 -->
        <el-col :span="8">
          <el-card>
            <template #header>功能模块</template>
            <el-tag class="tag-item">企业管理</el-tag>
            <el-tag class="tag-item" type="success">食材管理</el-tag>
            <el-tag class="tag-item" type="warning">安全检测</el-tag>
            <el-tag class="tag-item" type="danger">报表统计</el-tag>
          </el-card>
        </el-col>
      </el-row>
    </el-main>
  </div>
</template>

<script setup>
// 首页组件：展示系统概览
</script>

<style scoped>
.home-container {
  min-height: 100vh;
  background-color: #f5f5f5;
}
.home-header {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 16px;
  background-color: #409eff;
  color: white;
  padding: 20px;
}
.home-header h1 {
  margin: 0;
}
.tag-item {
  margin: 4px;
}
</style>
