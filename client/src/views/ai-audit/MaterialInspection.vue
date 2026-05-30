<template>
  <div class="page-container">
    <div class="toolbar"><h2>原料验收助手</h2></div>
    <el-card>
      <el-empty description="原料验收助手功能开发中，敬请期待">
        <template #image>
          <div style="font-size:64px;padding:20px">🔬</div>
        </template>
      </el-empty>
      <div class="coming-features">
        <h4>规划功能：</h4>
        <ul>
          <li>根据验收标准自动判定合格/让步/拒收</li>
          <li>OCR 识别证件内容</li>
          <li>对比温度、感官等数据</li>
          <li>综合供应商历史合格率评估</li>
          <li>生成验收风险评估报告</li>
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
