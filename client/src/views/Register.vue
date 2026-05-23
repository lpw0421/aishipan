<template>
  <div class="register-container">
    <el-card class="register-card">
      <h2>AI 食安 - 注册</h2>
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码（至少6位）" />
        </el-form-item>
        <el-form-item label="确认密码">
          <el-input v-model="form.confirmPassword" type="password" placeholder="请再次输入密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleRegister" :loading="loading">注册</el-button>
          <el-button type="text" @click="goLogin">返回登录</el-button>
        </el-form-item>
      </el-form>
    </el-card>
  </div>
</template>

<script setup>
import { reactive, ref } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../utils/request'

const router = useRouter()
const loading = ref(false)

// 注册表单
const form = reactive({
  username: '',
  password: '',
  confirmPassword: ''
})

// 注册处理
const handleRegister = async () => {
  // 前端校验
  if (!form.username || !form.password) {
    ElMessage.warning('用户名和密码不能为空')
    return
  }
  if (form.password.length < 6) {
    ElMessage.warning('密码长度不能少于6位')
    return
  }
  if (form.password !== form.confirmPassword) {
    ElMessage.warning('两次输入的密码不一致')
    return
  }

  loading.value = true
  try {
    // 调用后端注册接口
    const res = await request.post('/auth/register', {
      username: form.username,
      password: form.password
    })

    ElMessage.success(res.message)
    // 注册成功，跳回登录页
    router.push('/login')
  } catch {
    // 错误提示已在 request.js 拦截器中统一处理
  } finally {
    loading.value = false
  }
}

// 返回登录页
const goLogin = () => {
  router.push('/login')
}
</script>

<style scoped>
.register-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f5f5;
}
.register-card {
  width: 400px;
  max-width: 90vw;
}
.register-card h2 {
  text-align: center;
  margin-bottom: 20px;
}
</style>
