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
          <!-- 通知铃铛 -->
          <el-popover
            placement="bottom-end"
            :width="340"
            trigger="click"
            @show="fetchNotifications"
          >
            <template #reference>
              <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99" class="notify-badge">
                <el-icon :size="22" class="bell-icon"><Bell /></el-icon>
              </el-badge>
            </template>
            <div class="notify-panel">
              <div class="notify-header">
                <span>通知</span>
                <el-button v-if="unreadCount > 0" type="primary" link size="small" @click="readAll">全部已读</el-button>
              </div>
              <div v-if="notifications.length === 0" class="notify-empty">暂无通知</div>
              <div
                v-for="item in notifications"
                :key="item.id"
                class="notify-item"
                :class="{ unread: item.is_read === 0 }"
                @click="readOne(item)"
              >
                <div class="notify-title">{{ item.title }}</div>
                <div class="notify-content">{{ item.content }}</div>
                <div class="notify-time">{{ item.created_at }}</div>
              </div>
            </div>
          </el-popover>
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
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../utils/request'
import {
  HomeFilled,
  Document,
  FirstAidKit,
  PriceTag,
  Reading,
  UserFilled,
  ArrowDown,
  Bell
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

// 当前激活的路由路径（菜单高亮用）
const currentRoute = computed(() => route.path)

// 从 localStorage 获取当前登录用户名
const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const username = user.username || '未知用户'
const userId = user.id

// 下拉菜单命令处理
const handleCommand = (command) => {
  if (command === 'logout') {
    localStorage.removeItem('user')
    router.push('/login')
  }
}

// ===== 通知 =====
const notifications = ref([])
const unreadCount = ref(0)
let pollTimer = null

const fetchNotifications = async () => {
  try {
    const res = await request.get('/notifications', { params: { user_id: userId } })
    notifications.value = res.list
    unreadCount.value = res.unreadCount
  } catch {}
}

const readOne = async (item) => {
  if (item.is_read === 0) {
    try {
      await request.put(`/notifications/${item.id}/read`)
      item.is_read = 1
      unreadCount.value = Math.max(0, unreadCount.value - 1)
    } catch {}
  }
}

const readAll = async () => {
  try {
    await request.put('/notifications/read-all', { user_id: userId })
    notifications.value.forEach(n => { n.is_read = 1 })
    unreadCount.value = 0
  } catch {}
}

onMounted(() => {
  fetchNotifications()
  pollTimer = setInterval(fetchNotifications, 60000)  // 每分钟刷新
})

onUnmounted(() => {
  clearInterval(pollTimer)
})
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

/* ===== 通知 ===== */
.bell-icon {
  cursor: pointer;
  color: #606266;
  margin-right: 20px;
}
.bell-icon:hover {
  color: #409eff;
}
.notify-badge {
  display: flex;
  align-items: center;
}
.notify-panel {
  max-height: 360px;
  overflow-y: auto;
}
.notify-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding-bottom: 10px;
  border-bottom: 1px solid #ebeef5;
  margin-bottom: 8px;
  font-weight: bold;
  color: #303133;
}
.notify-empty {
  text-align: center;
  color: #c0c4cc;
  padding: 30px 0;
  font-size: 14px;
}
.notify-item {
  padding: 10px 8px;
  border-radius: 6px;
  cursor: pointer;
  transition: background 0.2s;
}
.notify-item:hover {
  background: #f5f7fa;
}
.notify-item.unread {
  background: #ecf5ff;
}
.notify-title {
  font-size: 14px;
  font-weight: 500;
  color: #303133;
}
.notify-content {
  font-size: 12px;
  color: #909399;
  margin: 4px 0;
}
.notify-time {
  font-size: 11px;
  color: #c0c4cc;
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
