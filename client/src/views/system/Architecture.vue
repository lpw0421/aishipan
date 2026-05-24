<template>
  <div class="page-container">
    <h2 style="margin-bottom:16px">体系文件架构</h2>

    <el-row :gutter="16" style="margin-bottom:20px">
      <el-col :span="4" v-for="card in statCards" :key="card.label">
        <el-card shadow="hover" class="arch-stat" :style="{borderTop:'3px solid '+card.color}">
          <div class="arch-num">{{ card.value }}</div>
          <div class="arch-label">{{ card.label }}</div>
        </el-card>
      </el-col>
    </el-row>

    <el-card>
      <template #header><span style="font-weight:bold">📂 食品安全管理体系文件层级</span></template>
      <div class="file-tree">
        <div class="tree-level level-0" @click="$router.push('/system/manual')">
          <div class="tree-dot" style="background:#409eff"></div>
          <span class="tree-title">管理手册（L1）</span>
          <span class="tree-desc">方针、目标、体系概述</span>
          <span class="tree-count">{{ stats.manual }}</span>
        </div>
        <div class="tree-line"></div>
        <div class="tree-level level-1" @click="$router.push('/system/procedure')">
          <div class="tree-dot" style="background:#67c23a"></div>
          <span class="tree-title">程序文件（L2）</span>
          <span class="tree-desc">跨部门流程控制</span>
          <span class="tree-count">{{ stats.procedure }}</span>
        </div>
        <div class="tree-line"></div>
        <div class="tree-level level-2" @click="$router.push('/system/sop')">
          <div class="tree-dot" style="background:#e6a23c"></div>
          <span class="tree-title">作业指导书 SOP（L3）</span>
          <span class="tree-desc">具体操作步骤</span>
          <span class="tree-count">{{ stats.sop }}</span>
        </div>
        <div class="tree-line"></div>
        <div class="tree-level level-3" @click="$router.push('/system/form')">
          <div class="tree-dot" style="background:#909399"></div>
          <span class="tree-title">记录表单（L4）</span>
          <span class="tree-desc">执行痕迹、台账、检查表</span>
          <span class="tree-count">{{ stats.form }}</span>
        </div>
      </div>
    </el-card>

    <el-row :gutter="16" style="margin-top:16px">
      <el-col :span="12">
        <el-card>
          <template #header><span style="font-weight:bold">📊 文件状态分布</span></template>
          <div style="padding:12px">
            <div class="status-bar">
              <span>现行有效</span><span style="color:#67c23a;font-weight:bold">{{ stats.active }}</span>
            </div>
            <div class="status-bar">
              <span>修订中</span><span style="color:#e6a23c;font-weight:bold">{{ stats.revising }}</span>
            </div>
            <div class="status-bar">
              <span>已作废</span><span style="color:#f56c6c;font-weight:bold">{{ stats.obsolete }}</span>
            </div>
          </div>
        </el-card>
      </el-col>
      <el-col :span="12">
        <el-card>
          <template #header><span style="font-weight:bold">📋 外部文件来源</span></template>
          <div style="padding:12px">
            <div class="status-bar" v-for="ext in externalStats" :key="ext.label">
              <span>{{ ext.label }}</span><span style="font-weight:bold">{{ ext.value }}</span>
            </div>
            <div v-if="externalStats.every(e=>e.value===0)" style="color:#c0c4cc;text-align:center;padding:20px">暂无外部文件</div>
          </div>
        </el-card>
      </el-col>
    </el-row>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import request from '../../utils/request'

const list = ref([])

const stats = computed(() => ({
  manual: list.value.filter(r => r.doc_type === 'manual').length,
  procedure: list.value.filter(r => r.doc_type === 'procedure').length,
  sop: list.value.filter(r => r.doc_type === 'sop').length,
  form: list.value.filter(r => r.doc_type === 'form').length,
  external: list.value.filter(r => r.doc_type === 'external').length,
  active: list.value.filter(r => r.status === '现行有效').length,
  revising: list.value.filter(r => r.status === '修订中').length,
  obsolete: list.value.filter(r => r.status === '已作废').length
}))

const statCards = computed(() => [
  { label: '管理手册', value: stats.value.manual, color: '#409eff' },
  { label: '程序文件', value: stats.value.procedure, color: '#67c23a' },
  { label: 'SOP', value: stats.value.sop, color: '#e6a23c' },
  { label: '记录表单', value: stats.value.form, color: '#909399' },
  { label: '外部文件', value: stats.value.external, color: '#f56c6c' },
  { label: '已作废', value: stats.value.obsolete, color: '#c0c4cc' }
])

const externalStats = computed(() => {
  const externals = list.value.filter(r => r.doc_type === 'external')
  const categories = { law: '法律法规', standard: '国家标准', industry: '行业规范', company: '企业制度', customer: '客户要求', certification: '认证标准' }
  return Object.entries(categories).map(([key, label]) => ({ label, value: externals.filter(r => r.category === key).length }))
})

onMounted(async () => {
  try {
    const user = JSON.parse(localStorage.getItem('user'))
    const res = await request.get('/sys-docs', { params: { user_id: user.id } })
    list.value = res.list
  } catch {}
})
</script>

<style scoped>
.arch-stat { text-align: center; cursor: pointer; }
.arch-num { font-size: 32px; font-weight: bold; color: #303133; }
.arch-label { font-size: 13px; color: #909399; margin-top: 4px; }

.file-tree { padding: 8px 0; }
.tree-level { display: flex; align-items: center; gap: 12px; padding: 14px 16px; cursor: pointer; border-radius: 8px; transition: background 0.2s; }
.tree-level:hover { background: #f5f7fa; }
.tree-dot { width: 12px; height: 12px; border-radius: 50%; flex-shrink: 0; }
.tree-title { font-weight: bold; color: #303133; min-width: 100px; font-size: 15px; }
.tree-desc { color: #909399; font-size: 13px; flex: 1; }
.tree-count { background: #f0f2f5; padding: 2px 12px; border-radius: 12px; font-size: 13px; color: #606266; }
.tree-line { width: 2px; height: 16px; background: #e4e7ed; margin-left: 21px; }
.level-0 { margin-left: 0; }
.level-1 { margin-left: 20px; }
.level-2 { margin-left: 40px; }
.level-3 { margin-left: 60px; }

.status-bar { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #f0f2f5; font-size: 14px; color: #606266; }
.status-bar:last-child { border-bottom: none; }
</style>
