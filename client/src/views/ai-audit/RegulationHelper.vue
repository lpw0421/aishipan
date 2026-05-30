<template>
  <div class="page-container">
    <div class="toolbar"><h2>法规速查助手</h2></div>
    <el-card>
      <el-empty description="法规速查助手功能开发中，敬请期待">
        <template #image>
          <div style="font-size:64px;padding:20px">🔍</div>
        </template>
      </el-empty>
      <div class="coming-features">
        <h4>规划功能：</h4>
        <ul>
          <li>自然语言搜索法规条款</li>
          <li>语义解析问题意图</li>
          <li>匹配相关法规条款并通俗解读</li>
          <li>关联相关标准/规范</li>
          <li>提供整改建议</li>
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
