<template>
  <div class="login-page">
    <div class="login-container">
      <div class="login-card">
        <!-- Logo & Title -->
        <div class="login-header">
          <div class="logo-icon">
            <svg viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z"/></svg>
          </div>
          <h1 class="login-title">
            <span class="ai-badge">AI</span>食安
          </h1>
          <p class="login-subtitle">智慧食品安全管理平台</p>
        </div>

        <!-- Login Form -->
        <form @submit.prevent="handleLogin">
          <!-- 用户名 -->
          <div class="form-group">
            <label class="form-label">用户名</label>
            <div class="input-wrapper">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
              </svg>
              <input
                type="text"
                class="form-input"
                placeholder="请输入用户名"
                v-model="form.username"
                @input="clearError"
              />
            </div>
          </div>

          <!-- 密码 -->
          <div class="form-group">
            <label class="form-label">密码</label>
            <div class="input-wrapper">
              <svg class="input-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
              <input
                :type="showPassword ? 'text' : 'password'"
                class="form-input"
                placeholder="请输入密码"
                v-model="form.password"
                @input="clearError"
              />
              <button type="button" class="toggle-password" @click="showPassword = !showPassword">
                <!-- 眼睛开 -->
                <svg v-if="!showPassword" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/>
                  <circle cx="12" cy="12" r="3"/>
                </svg>
                <!-- 眼睛关 -->
                <svg v-else viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                  <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/>
                  <line x1="1" y1="1" x2="23" y2="23"/>
                </svg>
              </button>
            </div>
          </div>

          <!-- 错误提示 -->
          <div class="error-msg" v-if="errorMsg">
            <svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/></svg>
            {{ errorMsg }}
          </div>

          <!-- 记住密码 & 忘记密码 -->
          <div class="form-options">
            <label class="checkbox-wrapper">
              <input type="checkbox" v-model="form.remember" />
              <span class="custom-checkbox">
                <svg viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </span>
              <span class="checkbox-label">记住密码</span>
            </label>
            <a href="#" class="forgot-link">忘记密码？</a>
          </div>

          <!-- 登录按钮 -->
          <button type="submit" class="login-btn" :class="{ loading: loading }" :disabled="loading">
            <span class="btn-text">登 录</span>
            <span class="spinner"></span>
          </button>
        </form>

        <!-- 底部注册 -->
        <div class="login-footer">
          <span class="register-link">
            还没有账号？<a href="#" @click.prevent="goRegister">立即注册</a>
          </span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { ElMessage } from 'element-plus'
import request from '../utils/request'

const router = useRouter()
const loading = ref(false)
const showPassword = ref(false)
const errorMsg = ref('')

const form = reactive({
  username: '',
  password: '',
  remember: false
})

// 恢复记住的用户名
onMounted(() => {
  const saved = localStorage.getItem('ai_shian_username')
  if (saved) {
    form.username = saved
    form.remember = true
  }
})

const clearError = () => {
  errorMsg.value = ''
}

const handleLogin = async () => {
  clearError()

  if (!form.username) {
    errorMsg.value = '请输入用户名'
    return
  }
  if (!form.password) {
    errorMsg.value = '请输入密码'
    return
  }

  // 记住用户名
  if (form.remember) {
    localStorage.setItem('ai_shian_username', form.username)
  } else {
    localStorage.removeItem('ai_shian_username')
  }

  loading.value = true
  try {
    const res = await request.post('/auth/login', {
      username: form.username,
      password: form.password
    })
    localStorage.setItem('user', JSON.stringify(res.user))
    ElMessage.success(res.message)
    router.push('/dashboard')
  } catch {
    // 错误提示已在 request.js 拦截器中统一处理
  } finally {
    loading.value = false
  }
}

const goRegister = () => {
  router.push('/register')
}
</script>

<style scoped>
/* ===== 背景 ===== */
.login-page {
  min-height: 100vh;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f0f7ff 0%, #e8f4f8 30%, #f5f0ff 60%, #fff5f0 100%);
  position: relative;
  overflow: hidden;
}

.login-page::before,
.login-page::after {
  content: '';
  position: absolute;
  border-radius: 50%;
  opacity: 0.4;
  filter: blur(80px);
}
.login-page::before {
  width: 500px;
  height: 500px;
  background: #d4e8ff;
  top: -150px;
  right: -100px;
}
.login-page::after {
  width: 400px;
  height: 400px;
  background: #ffe4d6;
  bottom: -100px;
  left: -80px;
}

/* ===== 卡片 ===== */
.login-container {
  position: relative;
  z-index: 1;
  width: 100%;
  max-width: 420px;
  padding: 20px;
}

.login-card {
  background: rgba(255, 255, 255, 0.85);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border-radius: 20px;
  padding: 48px 40px;
  box-shadow:
    0 8px 32px rgba(0, 0, 0, 0.06),
    0 2px 8px rgba(0, 0, 0, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.6);
  transition: transform 0.3s ease, box-shadow 0.3s ease;
}

.login-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 12px 48px rgba(0, 0, 0, 0.08),
    0 4px 12px rgba(0, 0, 0, 0.04);
}

/* ===== Logo / 标题 ===== */
.login-header {
  text-align: center;
  margin-bottom: 36px;
}

.logo-icon {
  width: 56px;
  height: 56px;
  background: linear-gradient(135deg, #5b8def, #7eb6ff);
  border-radius: 16px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  margin-bottom: 16px;
  box-shadow: 0 4px 16px rgba(91, 141, 239, 0.3);
}

.logo-icon svg {
  width: 28px;
  height: 28px;
  fill: white;
}

.login-title {
  font-size: 26px;
  font-weight: 700;
  color: #1a1a2e;
  letter-spacing: -0.5px;
}

.ai-badge {
  display: inline-block;
  background: linear-gradient(135deg, #5b8def, #7eb6ff);
  color: white;
  font-size: 14px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  margin-right: 6px;
  vertical-align: middle;
  position: relative;
  top: -2px;
}

.login-subtitle {
  color: #8c8ca0;
  font-size: 14px;
  margin-top: 8px;
}

/* ===== 表单 ===== */
.form-group {
  margin-bottom: 20px;
}

.form-label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #4a4a5a;
  margin-bottom: 8px;
}

.input-wrapper {
  position: relative;
}

.input-icon {
  position: absolute;
  left: 14px;
  top: 50%;
  transform: translateY(-50%);
  width: 18px;
  height: 18px;
  color: #b0b0c0;
  transition: color 0.2s;
  pointer-events: none;
}

.form-input {
  width: 100%;
  height: 48px;
  padding: 0 16px 0 44px;
  box-sizing: border-box;
  border: 1.5px solid #e8e8f0;
  border-radius: 12px;
  font-size: 15px;
  color: #1a1a2e;
  background: rgba(255, 255, 255, 0.8);
  transition: all 0.2s ease;
  outline: none;
  font-family: inherit;
}

.form-input::placeholder {
  color: #c0c0cc;
}

.form-input:hover {
  border-color: #d0d0e0;
}

.form-input:focus {
  border-color: #5b8def;
  background: white;
  box-shadow: 0 0 0 3px rgba(91, 141, 239, 0.1);
}

.input-wrapper:focus-within .input-icon {
  color: #5b8def;
}

/* 密码可见切换 */
.toggle-password {
  position: absolute;
  right: 14px;
  top: 50%;
  transform: translateY(-50%);
  background: none;
  border: none;
  cursor: pointer;
  color: #b0b0c0;
  padding: 4px;
  transition: color 0.2s;
}

.toggle-password:hover {
  color: #5b8def;
}

.toggle-password svg {
  width: 18px;
  height: 18px;
}

/* ===== 错误提示 ===== */
.error-msg {
  font-size: 13px;
  color: #ff6b6b;
  margin-bottom: 16px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.error-msg svg {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}

/* ===== 记住密码 & 忘记密码 ===== */
.form-options {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 28px;
}

.checkbox-wrapper {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox-wrapper input[type="checkbox"] {
  display: none;
}

.custom-checkbox {
  width: 18px;
  height: 18px;
  border: 1.5px solid #d0d0e0;
  border-radius: 5px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
  flex-shrink: 0;
}

.custom-checkbox svg {
  width: 12px;
  height: 12px;
  opacity: 0;
  transform: scale(0);
  transition: all 0.2s;
}

.checkbox-wrapper input:checked + .custom-checkbox {
  background: #5b8def;
  border-color: #5b8def;
}

.checkbox-wrapper input:checked + .custom-checkbox svg {
  opacity: 1;
  transform: scale(1);
}

.checkbox-label {
  font-size: 13px;
  color: #6a6a7a;
}

.forgot-link {
  font-size: 13px;
  color: #5b8def;
  text-decoration: none;
  transition: color 0.2s;
}

.forgot-link:hover {
  color: #3a6fd8;
}

/* ===== 登录按钮 ===== */
.login-btn {
  width: 100%;
  height: 48px;
  box-sizing: border-box;
  border: none;
  border-radius: 12px;
  background: linear-gradient(135deg, #5b8def, #7eb6ff);
  color: white;
  font-size: 16px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.3s ease;
  position: relative;
  overflow: hidden;
}

.login-btn:hover {
  transform: translateY(-2px);
  box-shadow: 0 6px 24px rgba(91, 141, 239, 0.35);
}

.login-btn:active {
  transform: translateY(0);
}

.login-btn:disabled {
  opacity: 0.7;
  cursor: not-allowed;
  transform: none;
}

/* 按钮加载 */
.login-btn .spinner {
  display: none;
  width: 20px;
  height: 20px;
  border: 2px solid rgba(255,255,255,0.3);
  border-top-color: white;
  border-radius: 50%;
  animation: spin 0.6s linear infinite;
}

.login-btn.loading .btn-text { display: none; }
.login-btn.loading .spinner { display: inline-block; }

@keyframes spin {
  to { transform: rotate(360deg); }
}

/* ===== 底部 ===== */
.login-footer {
  text-align: center;
  margin-top: 28px;
  padding-top: 24px;
  border-top: 1px solid #eee;
}

.register-link {
  font-size: 14px;
  color: #8c8ca0;
}

.register-link a {
  color: #5b8def;
  text-decoration: none;
  font-weight: 500;
  margin-left: 4px;
}

.register-link a:hover {
  text-decoration: underline;
}

/* ===== 响应式 ===== */
@media (max-width: 480px) {
  .login-card {
    padding: 36px 28px;
  }
  .login-title {
    font-size: 22px;
  }
}
</style>
