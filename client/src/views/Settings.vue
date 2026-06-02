<template>
  <div class="settings-page">
    <h2>⚙️ 账户设置</h2>

    <!-- 基本信息 -->
    <el-card class="section-card">
      <template #header><span class="card-title">👤 基本信息</span></template>
      <el-form :model="profile" label-width="100px">
        <el-form-item label="用户名">
          <el-input v-model="profile.username" placeholder="用户名" />
        </el-form-item>
        <el-form-item label="显示名称">
          <el-input v-model="profile.name" placeholder="你的姓名" />
        </el-form-item>
        <el-form-item label="角色">
          <el-tag :type="profile.role === 'admin' ? 'danger' : 'info'">{{ profile.role === 'admin' ? '管理员' : '成员' }}</el-tag>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="saveProfile" :loading="saving">保存</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 修改密码 -->
    <el-card class="section-card">
      <template #header><span class="card-title">🔒 修改密码</span></template>
      <el-form :model="pwdForm" label-width="100px">
        <el-form-item label="原密码">
          <el-input v-model="pwdForm.oldPassword" type="password" placeholder="输入原密码" />
        </el-form-item>
        <el-form-item label="新密码">
          <el-input v-model="pwdForm.newPassword" type="password" placeholder="至少6位" />
        </el-form-item>
        <el-form-item label="确认新密码">
          <el-input v-model="pwdForm.confirmPassword" type="password" placeholder="再次输入" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="changePassword" :loading="changing">修改密码</el-button>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 手机号 -->
    <el-card class="section-card">
      <template #header><span class="card-title">📱 手机号</span></template>
      <el-form label-width="100px">
        <el-form-item label="绑定手机">
          <span v-if="profile.phone" style="color:#16a34a">{{ profile.phone.replace(/(\d{3})\d{4}(\d{4})/, '$1****$2') }} ✅</span>
          <span v-else style="color:#9ca3af">未绑定</span>
        </el-form-item>
      </el-form>
    </el-card>

    <!-- 团队信息 -->
    <el-card class="section-card">
      <template #header><span class="card-title">🏢 团队信息</span></template>
      <div v-if="teamInfo" class="team-info">
        <div class="team-row">
          <span>团队名称</span>
          <div v-if="editingTeam" style="display:flex;gap:6px">
            <el-input v-model="teamName" size="small" style="width:180px" />
            <el-button size="small" type="primary" @click="saveTeamName" :loading="teamSaving">保存</el-button>
            <el-button size="small" @click="editingTeam = false">取消</el-button>
          </div>
          <div v-else>
            <strong>{{ teamInfo.name }}</strong>
            <el-button v-if="profile.role === 'admin'" link size="small" @click="editingTeam = true; teamName = teamInfo.name">✏️</el-button>
          </div>
        </div>
        <div class="team-row"><span>邀请码</span>
          <code class="invite-code">{{ teamInfo.invite_code }}</code>
          <el-button v-if="profile.role === 'admin'" link size="small" @click="regenerateCode" :loading="codeRegenerating">🔄 重置</el-button>
        </div>
        <div class="team-row"><span>成员数</span><strong>{{ teamMembers.length }} 人</strong></div>
        <div class="member-list" v-if="teamMembers.length">
          <div class="member-item" v-for="m in teamMembers" :key="m.id">
            <span>{{ m.name || m.username }}</span>
            <el-tag size="small" :type="m.role === 'admin' ? 'danger' : ''">{{ m.role === 'admin' ? '管理员' : '成员' }}</el-tag>
          </div>
        </div>
      </div>
    </el-card>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import axios from 'axios'
import request from '../utils/request'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const saving = ref(false)
const changing = ref(false)
const teamInfo = ref(null)
const teamMembers = ref([])
const editingTeam = ref(false)
const teamName = ref('')
const teamSaving = ref(false)
const codeRegenerating = ref(false)

const profile = reactive({
  username: user.username || '',
  name: user.name || '',
  role: user.role || 'user',
  phone: user.phone || ''
})

const pwdForm = reactive({ oldPassword: '', newPassword: '', confirmPassword: '' })

onMounted(async () => {
  try {
    const res = await request.get('/team/info', { params: { user_id: user.id } })
    if (res.team) {
      teamInfo.value = res.team
      teamMembers.value = res.members || []
    }
  } catch {}
})

const saveProfile = async () => {
  if (!profile.username) return ElMessage.warning('用户名不能为空')
  saving.value = true
  try {
    await axios.put('/api/user/profile', { user_id: user.id, username: profile.username, name: profile.name })
    user.username = profile.username
    user.name = profile.name
    localStorage.setItem('user', JSON.stringify(user))
    ElMessage.success('已保存')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '保存失败')
  } finally { saving.value = false }
}

const changePassword = async () => {
  if (!pwdForm.oldPassword) return ElMessage.warning('请输入原密码')
  if (!pwdForm.newPassword || pwdForm.newPassword.length < 6) return ElMessage.warning('新密码至少6位')
  if (pwdForm.newPassword !== pwdForm.confirmPassword) return ElMessage.warning('两次密码不一致')
  changing.value = true
  try {
    await axios.put('/api/user/password', { user_id: user.id, oldPassword: pwdForm.oldPassword, newPassword: pwdForm.newPassword })
    ElMessage.success('密码已修改')
    pwdForm.oldPassword = ''; pwdForm.newPassword = ''; pwdForm.confirmPassword = ''
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '修改失败')
  } finally { changing.value = false }
}

const saveTeamName = async () => {
  if (!teamName.value) return
  teamSaving.value = true
  try {
    await axios.put('/api/team/' + teamInfo.value.id, { user_id: user.id, name: teamName.value })
    teamInfo.value.name = teamName.value
    editingTeam.value = false
    ElMessage.success('团队名称已更新')
  } catch (e) {
    ElMessage.error(e.response?.data?.message || '修改失败')
  } finally { teamSaving.value = false }
}

const regenerateCode = async () => {
  codeRegenerating.value = true
  try {
    const res = await axios.post('/api/team/' + teamInfo.value.id + '/reset-code', { user_id: user.id })
    teamInfo.value.invite_code = res.invite_code
    ElMessage.success('新邀请码: ' + res.invite_code)
  } catch (e) {
    ElMessage.error('重置失败')
  } finally { codeRegenerating.value = false }
}
</script>

<style scoped>
.settings-page { padding: 0; max-width: 700px; }
.settings-page h2 { margin: 0 0 20px 0; color: #1a1a2e; }
.section-card { margin-bottom: 16px; }
.card-title { font-weight: 600; color: #303133; }
.team-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; font-size: 14px; }
.team-row span { color: #909399; }
.invite-code { font-size: 16px; font-weight: 700; color: #5b8def; background: #f0f5ff; padding: 3px 10px; border-radius: 4px; letter-spacing: 1px; }
.member-list { margin-top: 10px; }
.member-item { display: flex; justify-content: space-between; padding: 6px 10px; background: #f9fafb; border-radius: 6px; margin-bottom: 4px; font-size: 13px; }
</style>
