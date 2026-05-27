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
            <span>原料与标准</span>
          </template>
          <el-menu-item index="/raw-material/library">
            <span>原料库</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/standards">
            <span>验收标准</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/inspection">
            <span>原料验收</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/product-standards">
            <span>产品标准</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/test-items">
            <span>检验项目</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/samples">
            <span>留样管理</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/traceability">
            <span>批次追溯</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/non-conforming">
            <span>不合格品</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/standard-changes">
            <span>标准变更</span>
          </el-menu-item>
          <el-menu-item index="/raw-material/supplier-quality">
            <span>供应商质量评估</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/credentials">
          <template #title>
            <el-icon><Document /></el-icon>
            <span>资质管理</span>
          </template>
          <el-menu-item index="/credentials/own">
            <span>自有资质</span>
          </el-menu-item>
          <el-menu-item index="/credentials/supplier">
            <span>供应商资质</span>
          </el-menu-item>
          <el-menu-item index="/credentials/product-reports">
            <span>产品报告</span>
          </el-menu-item>
          <el-menu-item index="/credentials/overview">
            <span>资质总览</span>
          </el-menu-item>
        </el-sub-menu>

        <el-menu-item index="/health-certs">
          <el-icon><FirstAidKit /></el-icon>
          <span>健康证管理</span>
        </el-menu-item>

        <el-sub-menu index="/ai">
          <template #title>
            <el-icon><MagicStick /></el-icon>
            <span>AI智能</span>
          </template>
          <el-menu-item index="/ai/smart">
            <el-icon><Document /></el-icon>
            <span>标签审核</span>
          </el-menu-item>
          <el-menu-item index="/ai/supplier-score">
            <el-icon><StarFilled /></el-icon>
            <span>供应商评分</span>
          </el-menu-item>
          <el-menu-item index="/ai/complaint-classify">
            <el-icon><CollectionTag /></el-icon>
            <span>客诉分类定级</span>
          </el-menu-item>
          <el-menu-item index="/ai/complaint-reply">
            <el-icon><ChatDotSquare /></el-icon>
            <span>客诉回复生成</span>
          </el-menu-item>
          <el-menu-item index="/ai/complaint-analysis">
            <el-icon><Search /></el-icon>
            <span>客诉根因分析</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/complaint">
          <template #title>
            <el-icon><WarningFilled /></el-icon>
            <span>客诉管理</span>
          </template>
          <el-menu-item index="/complaint/dashboard">
            <el-icon><TrendCharts /></el-icon>
            <span>客诉看板</span>
          </el-menu-item>
          <el-menu-item index="/complaint/list">
            <el-icon><List /></el-icon>
            <span>客诉列表</span>
          </el-menu-item>
          <el-menu-item index="/complaint/handle">
            <el-icon><EditPen /></el-icon>
            <span>客诉处理</span>
          </el-menu-item>
          <el-menu-item index="/complaint/satisfaction">
            <el-icon><Medal /></el-icon>
            <span>满意度追踪</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/system">
          <template #title>
            <el-icon><Folder /></el-icon>
            <span>体系文件</span>
          </template>
          <el-menu-item index="/system/architecture">
            <span>体系架构</span>
          </el-menu-item>
          <el-menu-item index="/system/manual">
            <span>管理手册</span>
          </el-menu-item>
          <el-menu-item index="/system/procedure">
            <span>程序文件</span>
          </el-menu-item>
          <el-menu-item index="/system/sop">
            <span>作业指导书</span>
          </el-menu-item>
          <el-menu-item index="/system/form">
            <span>记录表单</span>
          </el-menu-item>
          <el-menu-item index="/system/external">
            <span>外部文件</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/pest">
          <template #title>
            <el-icon><Platform /></el-icon>
            <span>虫害管理</span>
          </template>
          <el-menu-item index="/pest/supplier">
            <el-icon><Files /></el-icon>
            <span>供应商资质</span>
          </el-menu-item>
          <el-menu-item index="/pest/staff">
            <el-icon><User /></el-icon>
            <span>人员管理</span>
          </el-menu-item>
          <el-menu-item index="/pest/chemicals">
            <el-icon><Box /></el-icon>
            <span>化学品管理</span>
          </el-menu-item>
          <el-menu-item index="/pest/service-records">
            <el-icon><Notebook /></el-icon>
            <span>服务记录</span>
          </el-menu-item>
          <el-menu-item index="/pest/service-reports">
            <el-icon><DocumentChecked /></el-icon>
            <span>服务报告</span>
          </el-menu-item>
          <el-menu-item index="/pest/complaints">
            <el-icon><WarningFilled /></el-icon>
            <span>投诉整改</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/training">
          <template #title>
            <el-icon><School /></el-icon>
            <span>培训考核</span>
          </template>
          <el-menu-item index="/training/plans">
            <el-icon><Calendar /></el-icon>
            <span>培训计划</span>
          </el-menu-item>
          <el-menu-item index="/training/courses">
            <el-icon><Reading /></el-icon>
            <span>培训课程</span>
          </el-menu-item>
          <el-menu-item index="/training/records">
            <el-icon><Notebook /></el-icon>
            <span>培训记录</span>
          </el-menu-item>
          <el-menu-item index="/training/exams">
            <el-icon><EditPen /></el-icon>
            <span>考核管理</span>
          </el-menu-item>
          <el-menu-item index="/training/certs">
            <el-icon><Medal /></el-icon>
            <span>证书管理</span>
          </el-menu-item>
        </el-sub-menu>

        <el-sub-menu index="/calibration">
          <template #title>
            <el-icon><Clock /></el-icon>
            <span>计量校准</span>
          </template>
          <el-menu-item index="/calibration/devices">
            <el-icon><Platform /></el-icon>
            <span>设备台账</span>
          </el-menu-item>
          <el-menu-item index="/calibration/plans">
            <el-icon><Calendar /></el-icon>
            <span>校准计划</span>
          </el-menu-item>
          <el-menu-item index="/calibration/records">
            <el-icon><Tickets /></el-icon>
            <span>校准记录</span>
          </el-menu-item>
          <el-menu-item index="/calibration/agencies">
            <el-icon><OfficeBuilding /></el-icon>
            <span>校准机构</span>
          </el-menu-item>
          <el-menu-item index="/calibration/exceptions">
            <el-icon><CircleClose /></el-icon>
            <span>异常处理</span>
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
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import request from '../utils/request'
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
  Search
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
