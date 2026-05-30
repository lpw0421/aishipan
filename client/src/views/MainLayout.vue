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

        <el-sub-menu index="/raw-material">
          <template #title>
            <el-icon><Box /></el-icon>
            <span>物料管理</span>
          </template>
          <el-menu-item index="/raw-material/library">
            <span>原料管理</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/product-standards">
            <span>产品管理</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/traceability">
            <span>批次追溯</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/credentials">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>供方管理</span>
          </template>
          <el-menu-item index="/credentials/supplier">
            <span>资质管理</span>
          </el-menu-item>
          <el-menu-item index="/credentials/supplier-quality">
            <span>质量评估</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/personnel">
          <template #title>
            <el-icon><User /></el-icon>
            <span>人员管理</span>
          </template>
          <el-menu-item index="/personnel/info">
            <span>人员综合</span>
          </el-menu-item>
          <el-menu-item index="/training">
            <span>培训考核</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/ai-audit">
          <template #title>
            <el-icon><MagicStick /></el-icon>
            <span>AI 智能中心</span>
          </template>
          <el-sub-menu index="ai-group-1">
            <template #title><span>合规审核</span></template>
            <el-menu-item index="/ai-audit/supplier">
              <span>供应商合规审核</span>
            </el-menu-item>
            <el-menu-item index="/ai-audit/label">
              <span>标签审核</span>
            </el-menu-item>
            <el-menu-item index="/ai-audit/material">
              <span>原料验收助手</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="ai-group-2">
            <template #title><span>文件报告</span></template>
            <el-menu-item index="/ai-audit/complaint">
              <span>客诉报告助手</span>
            </el-menu-item>
            <el-menu-item index="/ai-audit/document">
              <span>文件编制助手</span>
            </el-menu-item>
            <el-menu-item index="/ai-audit/sop">
              <span>SOP 撰写助手</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu index="ai-group-3">
            <template #title><span>辅助工具</span></template>
            <el-menu-item index="/ai-audit/exam">
              <span>培训出题助手</span>
            </el-menu-item>
            <el-menu-item index="/ai-audit/regulation">
              <span>法规速查助手</span>
            </el-menu-item>
            <el-menu-item index="/ai-audit/haccp">
              <span>HACCP 计划助手</span>
            </el-menu-item>
          </el-sub-menu>
        </el-sub-menu>

        <el-menu-item index="/system">
          <el-icon><Folder /></el-icon>
          <span>体系文件</span>
        </el-menu-item>

        <el-sub-menu index="/third-party">
          <template #title>
            <el-icon><Connection /></el-icon>
            <span>三方管理</span>
          </template>
          <el-menu-item index="/third-party/pest">
            <el-icon><Platform /></el-icon>
            <span>虫害管理</span>
          </el-menu-item>
          <el-menu-item index="/third-party/calibration">
            <el-icon><Clock /></el-icon>
            <span>计量校准</span>
          </el-menu-item>
        </el-sub-menu>
      </el-menu>
    </el-aside>

    <!-- ===== 右侧区域 ===== -->
    <el-container>
      <!-- 顶部导航栏 -->
      <el-header class="layout-header">
        <div class="header-left">
          <span class="system-name">AI 食安</span>
        </div>
        <div class="header-center">
          <span class="date-time">{{ currentTime }}</span>
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
              <el-badge :value="unreadCount" :hidden="unreadCount === 0" :max="99">
                <el-button type="default" circle :icon="Bell" class="bell-btn" />
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

  <!-- 智能助手 -->
  <ChatBot />
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../utils/request'
import ChatBot from './ChatBot.vue'
import {
  HomeFilled,
  Document,
  FirstAidKit,
  Reading,
  UserFilled,
  ArrowDown,
  Bell,
  Platform,
  Files,
  User,
  Box,
  Notebook,
  DocumentChecked,
  WarningFilled,
  Clock,
  Calendar,
  Tickets,
  OfficeBuilding,
  CircleClose,
  Folder,
  School,
  Medal,
  EditPen,
  MagicStick,
  List,
  StarFilled,
  ChatDotSquare,
  TrendCharts,
  CollectionTag,
  Search,
  Connection
} from '@element-plus/icons-vue'

const router = useRouter()
const route = useRoute()

// 当前激活的路由路径（菜单高亮用）
const currentRoute = computed(() => route.path)

// 实时日期时间
const currentTime = ref('')
const updateTime = () => {
  const now = new Date()
  const weekMap = ['日', '一', '二', '三', '四', '五', '六']
  currentTime.value = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 周${weekMap[now.getDay()]} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:${String(now.getSeconds()).padStart(2, '0')}`
}

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

let timeTimer = null

onMounted(() => {
  updateTime()
  timeTimer = setInterval(updateTime, 1000)
  fetchNotifications()
  pollTimer = setInterval(fetchNotifications, 60000)
})

onUnmounted(() => {
  clearInterval(timeTimer)
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
.header-left {
  min-width: 100px;
}
.system-name {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}
.header-center {
  flex: 1;
  text-align: center;
}
.date-time {
  font-size: 14px;
  color: #606266;
  letter-spacing: 0.5px;
}
.header-right {
  display: flex;
  align-items: center;
  gap: 16px;
}
.bell-btn {
  font-size: 20px;
  border: none;
  background: none;
  color: #606266;
  box-shadow: none;
}
.bell-btn:hover {
  color: #409eff;
  background: #ecf5ff;
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
