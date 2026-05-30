<template>
  <div class="page-container">
    <div class="toolbar"><h2>文件编制助手</h2></div>
    <el-card>
      <el-empty description="文件编制助手功能开发中，敬请期待">
        <template #image>
          <div style="font-size:64px;padding:20px">📝</div>
        </template>
      </el-empty>
      <div class="coming-features">
        <h4>规划功能：</h4>
        <ul>
          <li>辅助生成体系文件初稿（管理手册、程序文件等）</li>
          <li>根据文件类型调用对应模板</li>
          <li>自动填充企业信息</li>
          <li>关联适用法规标准</li>
          <li>合规性检查</li>
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
