<template>
  <div class="page-container">
    <div class="toolbar"><h2>培训出题助手</h2></div>
    <el-card>
      <el-empty description="培训出题助手功能开发中，敬请期待">
        <template #image>
          <div style="font-size:64px;padding:20px">📚</div>
        </template>
      </el-empty>
      <div class="coming-features">
        <h4>规划功能：</h4>
        <ul>
          <li>根据课程内容自动生成考题</li>
          <li>支持单选/多选/判断/简答题型</li>
          <li>初级/中级/高级难度分级</li>
          <li>自动阅卷（客观题）</li>
          <li>错题分析与针对性复习建议</li>
        </ul>
      </div>
    </el-card>
  </div>
</template>

<script setup>
</script>

<style scoped>
.page-container { padding: 0; }
.toolbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; }
.toolbar h2 { margin: 0; color: #303133; }
.coming-features { margin-top: 20px; padding: 16px; background: #f5f7fa; border-radius: 8px; }
.coming-features h4 { margin: 0 0 8px 0; color: #303133; }
.coming-features ul { margin: 0; padding-left: 20px; color: #606266; font-size: 14px; line-height: 2; }
</style>
