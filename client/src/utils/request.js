import axios from 'axios'
import { ElMessage } from 'element-plus'

// 创建 Axios 实例，配置基础路径（Vite 代理会转发 /api 到后端）
const request = axios.create({
  baseURL: '/api',
  timeout: 10000
})

// 响应拦截器：统一处理错误
request.interceptors.response.use(
  // 成功响应：直接返回数据
  (response) => {
    return response.data
  },
  // 失败响应：弹出错误提示
  (error) => {
    const msg = error.response?.data?.message || '网络请求失败，请稍后重试'
    ElMessage.error(msg)
    return Promise.reject(error)
  }
)

export default request
