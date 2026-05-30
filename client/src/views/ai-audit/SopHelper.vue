<template>
  <div class="page-container">
    <div class="toolbar"><h2>SOP 撰写助手</h2></div>
    <el-card>
      <el-empty description="SOP 撰写助手功能开发中，敬请期待">
        <template #image>
          <div style="font-size:64px;padding:20px">📋</div>
        </template>
      </el-empty>
      <div class="coming-features">
        <h4>规划功能：</h4>
        <ul>
          <li>根据操作类型自动生成 SOP 初稿</li>
          <li>填充关键参数（温度、时间、频次等）</li>
          <li>关联适用法规标准</li>
          <li>格式规范检查</li>
          <li>支持导出 Word/PDF</li>
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
