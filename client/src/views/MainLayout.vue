<template>
  <el-container class="layout-container">
    <!-- ===== 左侧边栏 ===== -->
    <el-aside width="220px" class="layout-aside">
      <!-- 侧边栏顶部的 Logo 区域 -->
      <div class="logo-area">
        <h2>AI 食安</h2>
      </div>

      <!-- 导航菜单：router 属性使菜单项自动根据 index 跳转路由 -->
      <el-menu
        :default-active="currentRoute"
        background-color="#304156"
        text-color="#bfcbd9"
        active-text-color="#409eff"
        router
      >
        <el-menu-item index="/dashboard">
          <el-icon><HomeFilled /></el-icon>
          <span>系统首页</span>
        </el-menu-item>

        <el-menu-item index="/credentials">
          <el-icon><Document /></el-icon>
          <span>资质管理</span>
        </el-menu-item>

        <el-menu-item index="/health-certs">
          <el-icon><FirstAidKit /></el-icon>
          <span>健康证管理</span>
        </el-menu-item>

        <el-menu-item index="/label-audit">
          <el-icon><PriceTag /></el-icon>
          <span>标签审核</span>
        </el-menu-item>

        <el-menu-item index="/regulations">
          <el-icon><Reading /></el-icon>
          <span>法规库</span>
        </el-menu-item>
      </el-menu>
    </el-aside>

    <!-- ===== 右侧区域 ===== -->
    <el-container>
      <!-- 顶部导航栏 -->
      <el-header class="layout-header">
        <div class="header-left">
          <span class="system-name">AI 食安</span>
        </div>
        <div class="header-right">
          <el-dropdown @command="handleCommand">
            <span class="user-info">
              <el-icon><UserFilled /></el-icon>
              {{ username }}
              <el-icon><ArrowDown /></el-icon>
            </span>
            <template #dropdown>
              <el-dropdown-menu>
                <el-dropdown-item command="logout">退出登录</el-dropdown-item>
              </el-dropdown-menu>
            </template>
          </el-dropdown>
        </div>
      </el-header>

      <!-- 主内容区：渲染子路由页面 -->
      <el-main class="layout-main">
        <router-view />
      </el-main>
    </el-container>
  </el-container>
</template>

<script setup>
import { computed } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import {
  HomeFilled,
  Document,
  FirstAidKit,
  PriceTag,
  Reading,
  UserFilled,
  ArrowDown
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

// 当前激活的路由路径（菜单高亮用）
const currentRoute = computed(() => route.path)

// 从 localStorage 获取当前登录用户名
const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const username = user.username || '未知用户'

// 下拉菜单命令处理
const handleCommand = (command) => {
  if (command === 'logout') {
    // 清除登录信息
    localStorage.removeItem('user')
    // 跳转回登录页
    router.push('/login')
  }
}
</script>

<style scoped>
.layout-container {
  height: 100vh;
}

/* ===== 侧边栏 ===== */
.layout-aside {
  background-color: #304156;
  overflow-y: auto;
}
.logo-area {
  height: 60px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}
.logo-area h2 {
  color: #fff;
  font-size: 20px;
  margin: 0;
}

/* ===== 顶部栏 ===== */
.layout-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  background-color: #fff;
  border-bottom: 1px solid #e6e6e6;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.08);
  padding: 0 20px;
  height: 60px;
}
.system-name {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}
.user-info {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  color: #606266;
  font-size: 14px;
}
.user-info:hover {
  color: #409eff;
}

/* ===== 内容区 ===== */
.layout-main {
  background-color: #f0f2f5;
  padding: 20px;
  overflow-y: auto;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .layout-aside {
    width: 64px !important;
  }
  .layout-aside .logo-area h2 {
    display: none;
  }
  .layout-aside .el-menu-item span {
    display: none;
  }
  .layout-main {
    padding: 12px;
  }
  .layout-header {
    padding: 0 12px;
  }
  .system-name {
    font-size: 14px;
  }
}
</style>
