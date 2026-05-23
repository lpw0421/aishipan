<template>
  <!-- 页面过渡动画 -->
  <router-view v-slot="{ Component }">
    <transition name="fade-page" mode="out-in">
      <component :is="Component" />
    </transition>
  </router-view>
</template>

<script setup>
// App 根组件：只负责渲染路由匹配的页面
</script>

<style>
/* ===== 全局样式 ===== */

/* 统一字体 */
body {
  margin: 0;
  padding: 0;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'PingFang SC',
    'Hiragino Sans GB', 'Microsoft YaHei', 'Helvetica Neue', Helvetica, Arial,
    sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  color: #303133;
}

/* 统一滚动条样式 */
::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}
::-webkit-scrollbar-thumb {
  background: #c0c4cc;
  border-radius: 3px;
}
::-webkit-scrollbar-thumb:hover {
  background: #909399;
}

/* 统一卡片圆角 */
.el-card {
  border-radius: 8px !important;
}

/* 统一按钮圆角 */
.el-button {
  border-radius: 6px !important;
}

/* 统一输入框圆角 */
.el-input__wrapper {
  border-radius: 6px !important;
}

/* 统一弹窗圆角 */
.el-dialog {
  border-radius: 12px !important;
}

/* 页面过渡动画 */
.fade-page-enter-active,
.fade-page-leave-active {
  transition: opacity 0.2s ease;
}
.fade-page-enter-from,
.fade-page-leave-to {
  opacity: 0;
}
</style>
