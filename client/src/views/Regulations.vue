<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>法规库</h2>
    </div>

    <el-card>
      <el-tabs v-model="activeTab">
        <el-tab-pane label="食品安全法" name="law">
          <div class="reg-detail">
            <h3>中华人民共和国食品安全法</h3>
            <p>现行有效 · 2022年修订版</p>
            <el-divider />
            <p>《中华人民共和国食品安全法》是食品行业的基本法律，确立了食品安全风险监测和评估、食品安全标准、食品生产经营、食品检验、食品进出口、食品安全事故处置、监督管理、法律责任等基本制度。</p>
          </div>
        </el-tab-pane>
        <el-tab-pane label="GB 7718" name="gb7718">
          <div class="reg-detail">
            <h3>GB 7718-2025 预包装食品标签通则</h3>
            <p>现行有效 · 2025年修订版</p>
            <el-divider />
            <p>规定了预包装食品标签的基本要求，包括食品名称、配料表、净含量和规格、生产者和（或）经销者的名称地址和联系方式、生产日期和保质期、贮存条件、食品生产许可证编号、产品标准代号及其他需要标示的内容。</p>
          </div>
        </el-tab-pane>
        <el-tab-pane label="GB 28050" name="gb28050">
          <div class="reg-detail">
            <h3>GB 28050-2025 预包装食品营养标签通则</h3>
            <p>现行有效 · 2025年修订版</p>
            <el-divider />
            <p>规定了预包装食品营养标签的营养成分表、营养声称和营养成分功能声称的基本要求，强制标示能量、核心营养素的含量值及其占营养素参考值（NRV）的百分比。</p>
          </div>
        </el-tab-pane>
      </el-tabs>
    </el-card>
  </div>
</template>

<script setup>
import { ref } from 'vue'

const activeTab = ref('law')
</script>

<style scoped>
.toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
}
.toolbar h2 {
  margin: 0;
  color: #303133;
}
.reg-detail h3 {
  margin: 0 0 8px;
}
.reg-detail > p {
  color: #909399;
  font-size: 13px;
  margin: 0 0 8px;
}
.reg-detail p:last-child {
  color: #303133;
  line-height: 1.8;
}
</style>
