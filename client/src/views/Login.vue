<template>
  <div class="login-container">
    <el-card class="login-card">
      <h2>AI 食安 - 登录</h2>
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名">
          <el-input v-model="form.username" placeholder="请输入用户名" />
        </el-form-item>
        <el-form-item label="密码">
          <el-input v-model="form.password" type="password" placeholder="请输入密码" />
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="handleLogin" :loading="loading">登录</el-button>
          <el-button type="text" @click="goRegister">去注册</el-button>
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

// 登录表单
const form = reactive({
  username: '',
  password: ''
})

// 登录处理
const handleLogin = async () => {
  // 简单校验
  if (!form.username || !form.password) {
    ElMessage.warning('请输入用户名和密码')
    return
  }

  loading.value = true
  try {
    // 调用后端登录接口
    const res = await request.post('/auth/login', {
      username: form.username,
      password: form.password
    })

    // 登录成功：将用户信息存入 localStorage
    localStorage.setItem('user', JSON.stringify(res.user))
    ElMessage.success(res.message)
    router.push('/dashboard')
  } catch {
    // 错误提示已在 request.js 拦截器中统一处理
  } finally {
    loading.value = false
  }
}

// 跳转到注册页
const goRegister = () => {
  router.push('/register')
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background-color: #f5f5f5;
}
.login-card {
  width: 400px;
  max-width: 90vw;
}
.login-card h2 {
  text-align: center;
  margin-bottom: 20px;
}
</style>
