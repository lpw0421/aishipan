<template>
  <div class="chatbot-wrapper">
    <!-- 浮动按钮 -->
    <div class="chat-fab" @click="toggleChat" v-show="!visible">
      <el-icon :size="24"><ChatDotRound /></el-icon>
    </div>

    <!-- 聊天面板 -->
    <transition name="slide-up">
      <div class="chat-panel" v-if="visible">
        <div class="chat-header">
          <div class="chat-header-left">
            <el-icon :size="18"><MagicStick /></el-icon>
            <span>AI 食安助手</span>
          </div>
          <el-button link @click="visible = false">
            <el-icon :size="18"><Close /></el-icon>
          </el-button>
        </div>

        <div class="chat-body" ref="chatBody">
          <div class="chat-welcome" v-if="messages.length === 0">
            <div class="welcome-icon">🤖</div>
            <div class="welcome-text">你好！我是 AI 食安助手</div>
            <div class="welcome-hint">可以问我：</div>
            <div class="hint-list">
              <span class="hint-item" v-for="q in quickQuestions" :key="q" @click="sendMessage(q)">{{ q }}</span>
            </div>
          </div>

          <div v-for="(msg, i) in messages" :key="i" class="msg-row" :class="msg.role">
            <div class="msg-avatar">
              <el-icon v-if="msg.role === 'user'" :size="16"><UserFilled /></el-icon>
              <span v-else>🤖</span>
            </div>
            <div class="msg-bubble" v-text="msg.content"></div>
          </div>

          <div v-if="loading" class="msg-row assistant">
            <div class="msg-avatar">🤖</div>
            <div class="msg-bubble typing"><span></span><span></span><span></span></div>
          </div>
        </div>

        <div class="chat-footer">
          <el-input
            v-model="inputText"
            placeholder="输入问题..."
            @keyup.enter="sendMessage(inputText)"
            :disabled="loading"
            clearable
          >
            <template #append>
              <el-button :icon="Promotion" @click="sendMessage(inputText)" :loading="loading" type="primary" />
            </template>
          </el-input>
        </div>
      </div>
    </transition>
  </div>
</template>

<script setup>
import { ref, nextTick, watch } from 'vue'
import axios from 'axios'
import { ChatDotRound, MagicStick, Close, UserFilled, Promotion } from '@element-plus/icons-vue'

const visible = ref(false)
const inputText = ref('')
const messages = ref([])
const loading = ref(false)
const chatBody = ref(null)

const quickQuestions = [
  '原料验收需要检查哪些证件？',
  '肉类原料的储存温度标准是什么？',
  '客诉处理的基本流程是怎样的？',
  'HACCP关键控制点如何确定？',
  '食品添加剂的使用原则是什么？'
]

function toggleChat() { visible.value = !visible.value }

async function sendMessage(text) {
  const content = (text || inputText.value).trim()
  if (!content || loading.value) return

  messages.value.push({ role: 'user', content })
  inputText.value = ''
  loading.value = true

  await scrollToBottom()

  try {
    const history = messages.value.slice(0, -1).map(m => ({ role: m.role, content: m.content }))
    const { data } = await axios.post('/api/chat', { message: content, history })
    messages.value.push({ role: 'assistant', content: data.reply })
  } catch {
    messages.value.push({ role: 'assistant', content: 'AI 服务暂时不可用，请稍后再试。' })
  } finally {
    loading.value = false
    await scrollToBottom()
  }
}

async function scrollToBottom() {
  await nextTick()
  if (chatBody.value) chatBody.value.scrollTop = chatBody.value.scrollHeight
}

watch(visible, async (val) => { if (val) await scrollToBottom() })
</script>

<style scoped>
.chatbot-wrapper { position: fixed; right: 24px; bottom: 24px; z-index: 2000; }

/* 浮动按钮 */
.chat-fab {
  width: 52px; height: 52px; border-radius: 50%;
  background: #409eff; color: #fff; display: flex;
  align-items: center; justify-content: center;
  cursor: pointer; box-shadow: 0 4px 14px rgba(64,158,255,0.4);
  transition: transform 0.2s, box-shadow 0.2s;
}
.chat-fab:hover { transform: scale(1.08); box-shadow: 0 6px 20px rgba(64,158,255,0.5); }

/* 面板 */
.chat-panel {
  width: 400px; height: 560px; background: #fff; border-radius: 12px;
  box-shadow: 0 8px 40px rgba(0,0,0,0.15); display: flex; flex-direction: column;
  overflow: hidden;
}
.chat-header {
  display: flex; justify-content: space-between; align-items: center;
  padding: 16px 20px; background: #409eff; color: #fff; font-size: 15px; font-weight: 500;
}
.chat-header-left { display: flex; align-items: center; gap: 8px; }

/* 消息区 */
.chat-body { flex: 1; overflow-y: auto; padding: 16px; background: #f5f7fa; }
.chat-welcome { text-align: center; padding: 40px 0; }
.welcome-icon { font-size: 48px; margin-bottom: 12px; }
.welcome-text { font-size: 16px; font-weight: bold; color: #303133; margin-bottom: 16px; }
.welcome-hint { font-size: 13px; color: #909399; margin-bottom: 10px; }
.hint-list { display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; }
.hint-item {
  display: inline-block; padding: 6px 12px; background: #fff; border: 1px solid #e4e7ed;
  border-radius: 16px; font-size: 12px; color: #606266; cursor: pointer; transition: all 0.2s;
}
.hint-item:hover { border-color: #409eff; color: #409eff; background: #ecf5ff; }

.msg-row { display: flex; gap: 10px; margin-bottom: 16px; }
.msg-row.user { flex-direction: row-reverse; }
.msg-avatar {
  width: 32px; height: 32px; border-radius: 50%; background: #e4e7ed;
  display: flex; align-items: center; justify-content: center; flex-shrink: 0;
  font-size: 14px;
}
.msg-row.user .msg-avatar { background: #409eff; color: #fff; }
.msg-bubble {
  max-width: 75%; padding: 10px 14px; border-radius: 10px; font-size: 14px;
  line-height: 1.6; white-space: pre-wrap; word-break: break-word;
}
.msg-row.user .msg-bubble { background: #409eff; color: #fff; border-bottom-right-radius: 4px; }
.msg-row.assistant .msg-bubble { background: #fff; color: #303133; border-bottom-left-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.06); }

/* 打字动画 */
.typing { display: flex; gap: 4px; padding: 14px 18px; }
.typing span {
  width: 7px; height: 7px; border-radius: 50%; background: #c0c4cc;
  animation: typing 1.4s infinite ease-in-out;
}
.typing span:nth-child(2) { animation-delay: 0.2s; }
.typing span:nth-child(3) { animation-delay: 0.4s; }
@keyframes typing { 0%,60%,100% { transform: translateY(0); } 30% { transform: translateY(-6px); } }

/* 输入区 */
.chat-footer { padding: 12px 16px; border-top: 1px solid #ebeef5; }
.chat-footer :deep(.el-input-group__append) { padding: 0; }
.chat-footer :deep(.el-input-group__append .el-button) { border-radius: 0 6px 6px 0; height: 100%; }

/* 动画 */
.slide-up-enter-active, .slide-up-leave-active { transition: all 0.3s ease; }
.slide-up-enter-from, .slide-up-leave-to { opacity: 0; transform: translateY(20px) scale(0.95); }
</style>
