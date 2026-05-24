<template>
  <div class="dashboard-container">
    <!-- ===== 统计卡片 ===== -->
    <el-row :gutter="16" class="stats-row">
      <el-col :span="6">
        <div class="stat-card stat-blue">
          <div class="stat-icon"><el-icon size="32"><Document /></el-icon></div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.certificates.total }}</div>
            <div class="stat-label">资质总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-red">
          <div class="stat-icon"><el-icon size="32"><WarningFilled /></el-icon></div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.certificates.expiring_soon + stats.certificates.expired }}</div>
            <div class="stat-label">资质异常数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-green">
          <div class="stat-icon"><el-icon size="32"><UserFilled /></el-icon></div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.healthCerts.total }}</div>
            <div class="stat-label">员工总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-orange">
          <div class="stat-icon"><el-icon size="32"><Clock /></el-icon></div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.healthCerts.expiring_soon + stats.healthCerts.expired }}</div>
            <div class="stat-label">健康证异常数</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- 客诉统计卡片 -->
    <el-row :gutter="16" class="stats-row" v-if="stats.complaints">
      <el-col :span="6">
        <div class="stat-card stat-purple">
          <div class="stat-icon"><el-icon size="32"><ChatDotSquare /></el-icon></div>
          <div class="stat-info">
            <div class="stat-number">{{ stats.complaints.total }}</div>
            <div class="stat-label">客诉总数</div>
          </div>
        </div>
      </el-col>
      <el-col :span="6">
        <div class="stat-card stat-red" v-if="stats.complaints.urgent > 0">
          <div class="stat-icon"><el-icon size="32"><WarningFilled /></el-icon></div>
          <div class="stat-info">
            <div class="stat-number" style="color:#fff">{{ stats.complaints.urgent }}</div>
            <div class="stat-label">紧急客诉待处理</div>
          </div>
        </div>
      </el-col>
    </el-row>

    <!-- ===== 快捷入口 ===== -->
    <el-row :gutter="16" class="actions-row">
      <el-col :span="8">
        <el-card shadow="hover" class="action-card" @click="goAddCredential">
          <el-icon size="28" color="#409eff"><Plus /></el-icon>
          <span class="action-text">新增资质</span>
          <span class="action-desc">上传营业执照、许可证等资质证照</span>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="action-card" @click="goAddHealthCert">
          <el-icon size="28" color="#67c23a"><Plus /></el-icon>
          <span class="action-text">录入健康证</span>
          <span class="action-desc">录入员工健康证信息及到期提醒</span>
        </el-card>
      </el-col>
      <el-col :span="8">
        <el-card shadow="hover" class="action-card" @click="goComplaint">
          <el-icon size="28" color="#f56c6c"><Plus /></el-icon>
          <span class="action-text">新增客诉</span>
          <span class="action-desc">记录客户投诉并跟踪处理进度</span>
        </el-card>
      </el-col>
    </el-row>

    <!-- ===== 即将过期预警列表 ===== -->
    <el-card class="warning-card">
      <template #header>
        <div class="warning-header">
          <span class="warning-title">
            <el-icon color="#e6a23c"><WarningFilled /></el-icon>
            即将过期预警（30天内）
          </span>
          <el-tag type="warning" size="small">{{ warnings.length }} 项</el-tag>
        </div>
      </template>

      <el-table :data="warnings" stripe v-loading="loading" empty-text="暂无即将到期项">
        <el-table-column label="名称" min-width="180">
          <template #default="{ row }">
            <el-link type="primary" @click="goDetail(row)">{{ row.title }}</el-link>
          </template>
        </el-table-column>
        <el-table-column label="类型" width="100">
          <template #default="{ row }">
            <el-tag :type="row.type === 'certificate' ? 'primary' : 'success'" size="small">
              {{ row.type === 'certificate' ? '资质' : '健康证' }}
            </el-tag>
          </template>
        </el-table-column>
        <el-table-column label="到期时间" width="140" prop="expiry_date" />
        <el-table-column label="剩余天数" width="100">
          <template #default="{ row }">
            <el-tag :type="row.daysLeft <= 7 ? 'danger' : 'warning'" size="small">
              {{ row.daysLeft }} 天
            </el-tag>
          </template>
        </el-table-column>
      </el-table>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Document, WarningFilled, UserFilled, Clock, Plus, ChatDotSquare } from '@element-plus/icons-vue'
import request from '../utils/request'

const router = useRouter()
const loading = ref(false)

// 从 localStorage 获取当前用户 ID
const userStr = localStorage.getItem('user')
const user = userStr ? JSON.parse(userStr) : {}
const userId = user.id

// 统计数据
const stats = reactive({
  certificates: { total: 0, valid: 0, expiring_soon: 0, expired: 0 },
  healthCerts: { total: 0, valid: 0, expiring_soon: 0, expired: 0 },
  complaints: null
})

// 预警列表
const warnings = ref([])

// 获取仪表盘数据
const fetchStats = async () => {
  loading.value = true
  try {
    const res = await request.get('/dashboard/stats', { params: { user_id: userId } })
    stats.certificates = res.certificates
    stats.healthCerts = res.healthCerts
    stats.complaints = res.complaints
    warnings.value = res.warnings
  } catch {
    // 错误在拦截器处理
  } finally {
    loading.value = false
  }
}

onMounted(fetchStats)

// 快捷操作：跳转到对应页面并自动打开新增弹窗
const goAddCredential = () => {
  router.push('/credentials?action=add')
}

const goAddHealthCert = () => {
  router.push('/health-certs?action=add')
}

const goComplaint = () => {
  router.push('/complaint/list')
}

// 点击预警项：跳转到对应详情页
const goDetail = (item) => {
  if (item.type === 'certificate') {
    router.push('/credentials')
  } else {
    router.push('/health-certs')
  }
}
</script>

<style scoped>
.dashboard-container {
  max-width: 1200px;
}

/* ===== 统计卡片 ===== */
.stats-row {
  margin-bottom: 16px;
}
.stat-card {
  display: flex;
  align-items: center;
  padding: 24px 20px;
  border-radius: 8px;
  color: #fff;
  gap: 16px;
}
.stat-card .stat-icon {
  opacity: 0.8;
}
.stat-number {
  font-size: 32px;
  font-weight: bold;
  line-height: 1.2;
}
.stat-label {
  font-size: 14px;
  opacity: 0.85;
  margin-top: 2px;
}
.stat-blue  { background: linear-gradient(135deg, #409eff, #66b1ff); }
.stat-red   { background: linear-gradient(135deg, #f56c6c, #f89898); }
.stat-green { background: linear-gradient(135deg, #67c23a, #85ce61); }
.stat-orange{ background: linear-gradient(135deg, #e6a23c, #ebb563); }
.stat-purple{ background: linear-gradient(135deg, #a855f7, #c084fc); }

/* ===== 快捷入口 ===== */
.actions-row {
  margin-bottom: 16px;
}
.action-card {
  cursor: pointer;
  transition: all 0.3s;
}
.action-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}
.action-card :deep(.el-card__body) {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px;
  gap: 8px;
}
.action-text {
  font-size: 18px;
  font-weight: bold;
  color: #303133;
}
.action-desc {
  font-size: 13px;
  color: #909399;
}

/* ===== 预警列表 ===== */
.warning-card {
  margin-top: 16px;
}
.warning-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.warning-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 16px;
  font-weight: bold;
}

/* ===== 移动端适配 ===== */
@media (max-width: 768px) {
  .stats-row .el-col {
    margin-bottom: 12px;
  }
  .quick-actions .el-col {
    margin-bottom: 12px;
  }
}
</style>
