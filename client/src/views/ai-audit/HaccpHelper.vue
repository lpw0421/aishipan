<template>
  <div class="page-container">
    <div class="toolbar"><h2>HACCP 计划助手</h2></div>
    <el-card>
      <el-empty description="HACCP 计划助手功能开发中，敬请期待">
        <template #image>
          <div style="font-size:64px;padding:20px">🛡️</div>
        </template>
      </el-empty>
      <div class="coming-features">
        <h4>规划功能：</h4>
        <ul>
          <li>根据产品类型自动识别潜在危害（生物/化学/物理）</li>
          <li>使用决策树判定关键控制点（CCP）</li>
          <li>根据法规和行业标准推荐关键限值</li>
          <li>生成 HACCP 计划初稿（Word/PDF）</li>
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
