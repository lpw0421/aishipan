<template>
  <div class="mobile-form">
    <div class="mf-hd">
      <div class="mf-logo">🍽️ AI食安</div>
      <div class="mf-title">员工信息录入</div>
    </div>
    <div class="mf-body" v-if="!submitted">
      <div class="mf-item"><label>姓名 *</label><input v-model="form.name" placeholder="请输入姓名" /></div>
      <div class="mf-item"><label>部门</label><input v-model="form.department" placeholder="如：后厨部" /></div>
      <div class="mf-item"><label>职位</label><input v-model="form.position" placeholder="如：厨师" /></div>
      <div class="mf-item"><label>电话</label><input v-model="form.phone" type="tel" placeholder="手机号" /></div>
      <div class="mf-item"><label>入职日期</label><input v-model="form.entry_date" type="date" /></div>
      <div class="mf-item"><label>健康证到期</label><input v-model="form.health_cert_expiry" type="date" /></div>
      <div class="mf-item"><label>资质附件</label><input type="file" accept="image/*,.pdf" @change="onFileChange" style="padding:8px" /></div>
      <div v-if="uploading" style="font-size:12px;color:#378ADD;margin-bottom:10px">上传中...</div>
      <div class="mf-item"><label>状态</label>
        <select v-model="form.status"><option value="在职">在职</option><option value="试用期">试用期</option><option value="离职">离职</option></select>
      </div>
      <button class="mf-btn" @click="submit" :disabled="saving || !form.name">{{ saving ? '提交中...' : '保存' }}</button>
    </div>
    <div class="mf-body mf-ok" v-else>
      <div class="mf-check">✅</div>
      <div class="mf-msg">录入成功！</div>
      <div class="mf-name">{{ form.name }}</div>
      <button class="mf-btn mf-btn-outline" @click="addAnother">继续录入</button>
    </div>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import axios from 'axios'

const form = reactive({ name: '', department: '', position: '', phone: '', entry_date: '', health_cert_expiry: '', status: '在职' })
const saving = ref(false), submitted = ref(false), uploading = ref(false)
const userId = ref(''), uploadFile = ref(null)

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  userId.value = params.get('user_id') || ''
})

const onFileChange = (e) => { uploadFile.value = e.target.files[0] }

const submit = async () => {
  if (!form.name) return
  saving.value = true
  try {
    // 先上传附件
    if (uploadFile.value) {
      uploading.value = true
      const fd = new FormData()
      fd.append('file', uploadFile.value)
      const upRes = await axios.post('/api/upload', fd)
      form.file_path = upRes.data.filename
      uploading.value = false
    }
    await axios.post('/api/personnel', { ...form, user_id: userId.value })
    submitted.value = true
  } catch (e) {
    alert(e.response?.data?.message || '提交失败')
  } finally {
    saving.value = false; uploading.value = false
  }
}

const addAnother = () => {
  Object.assign(form, { name: '', department: '', position: '', phone: '', entry_date: '', health_cert_expiry: '', status: '', file_path: '' })
  uploadFile.value = null; submitted.value = false
}
</script>

<style scoped>
* { box-sizing: border-box; margin: 0; padding: 0; }
.mobile-form { max-width: 480px; min-height: 100vh; background: #f5f7fa; font-family: -apple-system, sans-serif; }
.mf-hd { background: linear-gradient(135deg, #378ADD, #1a5fa8); color: #fff; padding: 28px 20px 24px; text-align: center; }
.mf-logo { font-size: 14px; opacity: 0.85; margin-bottom: 6px; }
.mf-title { font-size: 20px; font-weight: 600; }
.mf-body { padding: 20px 16px; }
.mf-item { margin-bottom: 14px; }
.mf-item label { display: block; font-size: 13px; color: #666; margin-bottom: 4px; }
.mf-item input, .mf-item select { width: 100%; height: 42px; border: 1px solid #ddd; border-radius: 8px; padding: 0 12px; font-size: 15px; background: #fff; -webkit-appearance: none; }
.mf-item input:focus, .mf-item select:focus { outline: none; border-color: #378ADD; }
.mf-btn { width: 100%; height: 46px; background: #378ADD; color: #fff; border: none; border-radius: 8px; font-size: 16px; font-weight: 500; margin-top: 8px; cursor: pointer; }
.mf-btn:disabled { opacity: 0.6; }
.mf-btn-outline { background: #fff; color: #378ADD; border: 1px solid #378ADD; }
.mf-ok { text-align: center; padding-top: 60px; }
.mf-check { font-size: 64px; margin-bottom: 16px; }
.mf-msg { font-size: 18px; color: #333; font-weight: 500; }
.mf-name { font-size: 14px; color: #888; margin: 8px 0 32px; }
</style>
