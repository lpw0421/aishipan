<template>
  <div class="page-container">
    <div class="toolbar">
      <h2>产品管理</h2>
    </div>

    <el-tabs v-model="activeTab" class="main-tabs">
      <!-- ==================== Tab 1: 产品标准 ==================== -->
      <el-tab-pane label="产品标准" name="standards">
        <div class="toolbar sub-toolbar">
          <span></span>
          <el-button type="primary" @click="openAdd">新增标准</el-button>
        </div>

        <el-card class="filter-card">
          <el-input v-model="keyword" placeholder="搜索标准名称/编号" style="width:220px" clearable @change="fetchStandards">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="filterType" placeholder="标准类型" style="width:130px" clearable @change="fetchStandards">
            <el-option label="国标/行标" value="国标/行标" /><el-option label="企标" value="企标" /><el-option label="客户标准" value="客户标准" /><el-option label="内控标准" value="内控标准" />
          </el-select>
          <el-select v-model="filterStatus" placeholder="状态" style="width:130px" clearable @change="fetchStandards">
            <el-option label="现行有效" value="现行有效" /><el-option label="修订中" value="修订中" /><el-option label="已废止" value="已废止" />
          </el-select>
          <el-button @click="fetchStandards">查询</el-button>
        </el-card>

        <el-card>
          <el-table :data="standardsList" v-loading="standardsLoading" stripe @row-click="openDetail">
            <el-table-column prop="standard_number" label="标准编号" width="100" />
            <el-table-column prop="standard_name" label="标准名称" min-width="150" />
            <el-table-column prop="standard_type" label="标准类型" width="110"><template #default="{row}"><el-tag size="small">{{ row.standard_type }}</el-tag></template></el-table-column>
            <el-table-column prop="standard_code" label="标准号" width="140" />
            <el-table-column prop="applicable_products" label="适用产品" min-width="120" />
            <el-table-column prop="effective_date" label="生效日期" width="110" />
            <el-table-column prop="status" label="状态" width="100">
              <template #default="{row}"><el-tag :type="row.status==='现行有效'?'success':row.status==='修订中'?'warning':'info'" size="small">{{ row.status }}</el-tag></template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{row}">
                <el-button size="small" @click.stop="openEdit(row)">编辑</el-button>
                <el-button size="small" type="danger" @click.stop="deleteStandard(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
        </el-card>

        <!-- 新增/编辑标准对话框 -->
        <el-dialog :title="editingId ? '编辑标准' : '新增标准'" v-model="showForm" width="550px" @close="resetForm">
          <el-form :model="form" label-width="100px">
            <el-form-item label="标准名称"><el-input v-model="form.standard_name" /></el-form-item>
            <el-row :gutter="12">
              <el-col :span="12"><el-form-item label="标准类型"><el-select v-model="form.standard_type" style="width:100%"><el-option label="国标/行标" value="国标/行标" /><el-option label="企标" value="企标" /><el-option label="客户标准" value="客户标准" /><el-option label="内控标准" value="内控标准" /></el-select></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="标准号"><el-input v-model="form.standard_code" placeholder="如 GB/T 20981" /></el-form-item></el-col>
            </el-row>
            <el-form-item label="适用产品"><el-input v-model="form.applicable_products" /></el-form-item>
            <el-row :gutter="12">
              <el-col :span="12"><el-form-item label="生效日期"><el-date-picker v-model="form.effective_date" type="date" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="有效期至"><el-date-picker v-model="form.expiry_date" type="date" style="width:100%" /></el-form-item></el-col>
            </el-row>
            <el-form-item label="状态"><el-select v-model="form.status" style="width:200px"><el-option label="现行有效" value="现行有效" /><el-option label="修订中" value="修订中" /><el-option label="已废止" value="已废止" /></el-select></el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showForm = false">取消</el-button>
            <el-button type="primary" @click="save">保存</el-button>
          </template>
        </el-dialog>

        <!-- 标准详情 + 指标管理对话框 -->
        <el-dialog title="标准详情" v-model="showDetail" width="800px" top="30px">
          <div v-if="currentStandard">
            <el-descriptions :column="2" border>
              <el-descriptions-item label="标准编号">{{ currentStandard.standard_number }}</el-descriptions-item>
              <el-descriptions-item label="标准名称">{{ currentStandard.standard_name }}</el-descriptions-item>
              <el-descriptions-item label="标准类型">{{ currentStandard.standard_type }}</el-descriptions-item>
              <el-descriptions-item label="标准号">{{ currentStandard.standard_code }}</el-descriptions-item>
              <el-descriptions-item label="适用产品">{{ currentStandard.applicable_products }}</el-descriptions-item>
              <el-descriptions-item label="状态">{{ currentStandard.status }}</el-descriptions-item>
            </el-descriptions>
            <div class="sub-header mt20">
              <h4>指标明细</h4>
              <el-button size="small" type="primary" @click="showAddIndicator = true">添加指标</el-button>
            </div>
            <el-table :data="indicators" stripe>
              <el-table-column prop="indicator_category" label="指标类别" width="80"><template #default="{row}"><el-tag size="small">{{ row.indicator_category }}</el-tag></template></el-table-column>
              <el-table-column prop="indicator_name" label="指标名称" width="140" />
              <el-table-column prop="requirement" label="要求" />
              <el-table-column prop="test_method" label="检验方法" width="120" />
              <el-table-column prop="internal_control" label="内控标准" width="120" />
              <el-table-column label="操作" width="80"><template #default="{row}"><el-button size="small" type="danger" @click="deleteIndicator(row)">删除</el-button></template></el-table-column>
            </el-table>
          </div>
        </el-dialog>

        <!-- 添加指标对话框 -->
        <el-dialog title="添加指标" v-model="showAddIndicator" width="500px" append-to-body>
          <el-form :model="indicatorForm" label-width="100px">
            <el-form-item label="指标类别"><el-select v-model="indicatorForm.indicator_category" style="width:100%"><el-option label="感官" value="感官" /><el-option label="理化" value="理化" /><el-option label="微生物" value="微生物" /><el-option label="净含量" value="净含量" /></el-select></el-form-item>
            <el-form-item label="指标名称"><el-input v-model="indicatorForm.indicator_name" /></el-form-item>
            <el-form-item label="要求"><el-input v-model="indicatorForm.requirement" /></el-form-item>
            <el-form-item label="检验方法"><el-input v-model="indicatorForm.test_method" placeholder="如 GB 5009.3" /></el-form-item>
            <el-form-item label="内控标准"><el-input v-model="indicatorForm.internal_control" /></el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showAddIndicator = false">取消</el-button>
            <el-button type="primary" @click="saveIndicator">保存</el-button>
          </template>
        </el-dialog>

        <el-divider />
        <h4 class="section-title">标准变更记录</h4>
        <StandardChanges />
      </el-tab-pane>

      <!-- ==================== Tab 2: 检验记录 ==================== -->
      <el-tab-pane label="检验记录" name="inspections">
        <!-- 统计卡片 -->
        <el-row :gutter="16" class="stat-row">
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-num">{{ inspStats.total }}</div>
              <div class="stat-label">检验总批次</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card">
              <div class="stat-num" style="color:#67c23a">{{ inspStats.qualified }}</div>
              <div class="stat-label">合格</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card stat-danger">
              <div class="stat-num danger">{{ inspStats.unqualified }}</div>
              <div class="stat-label">不合格</div>
            </el-card>
          </el-col>
          <el-col :span="6">
            <el-card shadow="hover" class="stat-card stat-info">
              <div class="stat-num info">{{ inspStats.todayCount }}</div>
              <div class="stat-label">今日检验</div>
            </el-card>
          </el-col>
        </el-row>

        <!-- 搜索筛选 -->
        <el-card class="filter-card">
          <el-input v-model="inspKeyword" placeholder="搜索产品名称/批次/检验员" style="width:240px" clearable @change="fetchInspections">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="inspFilterConclusion" placeholder="检验结论" style="width:130px" clearable @change="fetchInspections">
            <el-option label="合格" value="合格" /><el-option label="不合格" value="不合格" />
          </el-select>
          <el-select v-model="inspFilterType" placeholder="检验类型" style="width:130px" clearable @change="fetchInspections">
            <el-option label="出厂检验" value="出厂检验" /><el-option label="型式检验" value="型式检验" /><el-option label="委托检验" value="委托检验" />
          </el-select>
          <el-button @click="fetchInspections">查询</el-button>
        </el-card>

        <el-card>
          <el-table :data="inspectionsList" v-loading="inspLoading" stripe>
            <el-table-column prop="product_name" label="产品名称" min-width="130" />
            <el-table-column prop="product_batch" label="产品批号" width="120" />
            <el-table-column prop="inspection_date" label="检验日期" width="110">
              <template #default="{row}">{{ row.inspection_date?.slice(0,10) }}</template>
            </el-table-column>
            <el-table-column prop="inspection_type" label="检验类型" width="100">
              <template #default="{row}"><el-tag size="small" type="info">{{ row.inspection_type }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="inspector" label="检验员" width="80" />
            <el-table-column prop="conclusion" label="结论" width="90">
              <template #default="{row}">
                <el-tag :type="row.conclusion==='合格'?'success':'danger'" size="small">{{ row.conclusion || '待判定' }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column prop="unqualified_items" label="不合格项" min-width="120" show-overflow-tooltip />
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{row}">
                <el-button size="small" @click="openInspDetail(row)">详情</el-button>
                <el-button size="small" type="danger" @click="deleteInspection(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!inspLoading && inspectionsList.length === 0" description="暂无检验记录" />
        </el-card>

        <!-- 新增/编辑检验记录对话框 -->
        <el-dialog :title="inspEditingId ? '编辑检验记录' : '新增检验记录'" v-model="showInspForm" width="700px" @close="resetInspForm">
          <el-form :model="inspForm" label-width="100px">
            <el-row :gutter="12">
              <el-col :span="12"><el-form-item label="产品名称"><el-input v-model="inspForm.product_name" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="产品批号"><el-input v-model="inspForm.product_batch" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12"><el-form-item label="生产日期"><el-date-picker v-model="inspForm.production_date" type="date" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="检验日期"><el-date-picker v-model="inspForm.inspection_date" type="date" style="width:100%" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="12"><el-form-item label="检验员"><el-input v-model="inspForm.inspector" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="检验类型"><el-select v-model="inspForm.inspection_type" style="width:100%"><el-option label="出厂检验" value="出厂检验" /><el-option label="型式检验" value="型式检验" /><el-option label="委托检验" value="委托检验" /></el-select></el-form-item></el-col>
            </el-row>
            <el-form-item label="抽样数量"><el-input v-model="inspForm.sample_quantity" /></el-form-item>

            <!-- 感官检查 -->
            <el-divider content-position="left">感官检查</el-divider>
            <el-row :gutter="12">
              <el-col :span="8"><el-form-item label="色泽"><el-input v-model="inspForm.sensory_check.色泽" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="气味"><el-input v-model="inspForm.sensory_check.气味" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="组织状态"><el-input v-model="inspForm.sensory_check.组织状态" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="8"><el-form-item label="滋味口感"><el-input v-model="inspForm.sensory_check.滋味口感" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="杂质"><el-input v-model="inspForm.sensory_check.杂质" /></el-form-item></el-col>
            </el-row>

            <!-- 理化检查 -->
            <el-divider content-position="left">理化指标</el-divider>
            <el-row :gutter="12">
              <el-col :span="8"><el-form-item label="水分(%)"><el-input v-model="inspForm.理化_check.水分" placeholder="%" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="盐分(%)"><el-input v-model="inspForm.理化_check.盐分" placeholder="%" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="脂肪(%)"><el-input v-model="inspForm.理化_check.脂肪" placeholder="%" /></el-form-item></el-col>
            </el-row>
            <el-row :gutter="12">
              <el-col :span="8"><el-form-item label="蛋白质(%)"><el-input v-model="inspForm.理化_check.蛋白质" placeholder="%" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="过氧化值"><el-input v-model="inspForm.理化_check.过氧化值" /></el-form-item></el-col>
            </el-row>

            <!-- 微生物检查 -->
            <el-divider content-position="left">微生物指标</el-divider>
            <el-row :gutter="12">
              <el-col :span="8"><el-form-item label="菌落总数"><el-input v-model="inspForm.micro_check.菌落总数" placeholder="CFU/g" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="大肠菌群"><el-input v-model="inspForm.micro_check.大肠菌群" placeholder="MPN/g" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="致病菌"><el-input v-model="inspForm.micro_check.致病菌" /></el-form-item></el-col>
            </el-row>

            <!-- 净含量 -->
            <el-divider content-position="left">净含量</el-divider>
            <el-row :gutter="12">
              <el-col :span="8"><el-form-item label="标准净含量"><el-input v-model="inspForm.net_weight_check.标准净含量" /></el-form-item></el-col>
              <el-col :span="8"><el-form-item label="实测偏差"><el-input v-model="inspForm.net_weight_check.实测偏差" /></el-form-item></el-col>
            </el-row>

            <el-form-item label="检验结论"><el-radio-group v-model="inspForm.conclusion"><el-radio value="合格">合格</el-radio><el-radio value="不合格">不合格</el-radio></el-radio-group></el-form-item>
            <el-form-item label="不合格项"><el-input v-model="inspForm.unqualified_items" placeholder="如有不合格项，请注明" /></el-form-item>
            <el-form-item label="备注"><el-input v-model="inspForm.remarks" type="textarea" :rows="2" /></el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showInspForm = false">取消</el-button>
            <el-button type="primary" @click="saveInspection" :loading="inspSaving">保存</el-button>
          </template>
        </el-dialog>

        <!-- 检验记录详情对话框 -->
        <el-dialog title="检验记录详情" v-model="showInspDetail" width="750px">
          <div v-if="currentInspection">
            <el-descriptions :column="2" border class="mb20">
              <el-descriptions-item label="产品名称">{{ currentInspection.product_name }}</el-descriptions-item>
              <el-descriptions-item label="产品批号">{{ currentInspection.product_batch }}</el-descriptions-item>
              <el-descriptions-item label="检验日期">{{ currentInspection.inspection_date?.slice(0,10) }}</el-descriptions-item>
              <el-descriptions-item label="检验类型">{{ currentInspection.inspection_type }}</el-descriptions-item>
              <el-descriptions-item label="检验员">{{ currentInspection.inspector }}</el-descriptions-item>
              <el-descriptions-item label="检验结论">
                <el-tag :type="currentInspection.conclusion==='合格'?'success':'danger'">{{ currentInspection.conclusion || '待判定' }}</el-tag>
              </el-descriptions-item>
            </el-descriptions>

            <h4 class="mb10">感官检查</h4>
            <el-table :data="sensoryTableData" stripe size="small" class="mb20">
              <el-table-column prop="key" label="检查项" /><el-table-column prop="value" label="结果" />
            </el-table>

            <h4 class="mb10">理化指标</h4>
            <el-table :data="理化TableData" stripe size="small" class="mb20">
              <el-table-column prop="key" label="指标" /><el-table-column prop="value" label="结果" />
            </el-table>

            <h4 class="mb10">微生物指标</h4>
            <el-table :data="microTableData" stripe size="small" class="mb20">
              <el-table-column prop="key" label="指标" /><el-table-column prop="value" label="结果" />
            </el-table>

            <h4 class="mb10">净含量</h4>
            <el-table :data="netWeightTableData" stripe size="small">
              <el-table-column prop="key" label="项目" /><el-table-column prop="value" label="结果" />
            </el-table>
          </div>
        </el-dialog>
      </el-tab-pane>

      <!-- ==================== Tab 3: 检验报告 ==================== -->
      <el-tab-pane label="检验报告" name="reports">
        <div class="toolbar sub-toolbar">
          <span></span>
          <el-button type="primary" @click="openReportAdd">新增报告</el-button>
        </div>

        <el-card class="filter-card">
          <el-input v-model="reportKeyword" placeholder="搜索产品名称/批号/报告编号" style="width:240px" clearable @change="fetchReports">
            <template #prefix><el-icon><Search /></el-icon></template>
          </el-input>
          <el-select v-model="reportFilterType" placeholder="报告类型" style="width:140px" clearable @change="fetchReports">
            <el-option label="微生物检测" value="微生物检测" /><el-option label="理化检测" value="理化检测" /><el-option label="全项检测" value="全项检测" /><el-option label="委托检测" value="委托检测" />
          </el-select>
          <el-select v-model="reportFilterConclusion" placeholder="结论" style="width:100px" clearable @change="fetchReports">
            <el-option label="合格" value="合格" /><el-option label="不合格" value="不合格" />
          </el-select>
          <el-button @click="fetchReports">查询</el-button>
        </el-card>

        <el-card>
          <el-table :data="reportsList" v-loading="reportsLoading" stripe>
            <el-table-column prop="report_number" label="报告编号" width="120" />
            <el-table-column prop="product_name" label="产品名称" min-width="130" />
            <el-table-column prop="product_batch" label="产品批号" width="120" />
            <el-table-column prop="report_type" label="报告类型" width="110">
              <template #default="{row}"><el-tag size="small" type="info">{{ row.report_type }}</el-tag></template>
            </el-table-column>
            <el-table-column prop="test_date" label="检测日期" width="110" />
            <el-table-column prop="agency_name" label="检测机构" min-width="120" show-overflow-tooltip />
            <el-table-column prop="conclusion" label="结论" width="80">
              <template #default="{row}">
                <el-tag :type="row.conclusion==='合格'?'success':'danger'" size="small">{{ row.conclusion }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column label="操作" width="160" fixed="right">
              <template #default="{row}">
                <el-button size="small" @click="openReportEdit(row)">编辑</el-button>
                <el-button size="small" type="danger" @click="deleteReport(row)">删除</el-button>
              </template>
            </el-table-column>
          </el-table>
          <el-empty v-if="!reportsLoading && reportsList.length === 0" description="暂无检验报告" />
        </el-card>

        <!-- 新增/编辑报告对话框 -->
        <el-dialog :title="reportEditingId ? '编辑报告' : '新增报告'" v-model="showReportForm" width="550px" @close="resetReportForm">
          <el-form :model="reportForm" label-width="100px">
            <el-form-item label="产品名称"><el-input v-model="reportForm.product_name" /></el-form-item>
            <el-row :gutter="12">
              <el-col :span="12"><el-form-item label="产品批号"><el-input v-model="reportForm.product_batch" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="报告编号"><el-input v-model="reportForm.report_number" /></el-form-item></el-col>
            </el-row>
            <el-form-item label="报告类型"><el-select v-model="reportForm.report_type" style="width:100%"><el-option label="微生物检测" value="微生物检测" /><el-option label="理化检测" value="理化检测" /><el-option label="全项检测" value="全项检测" /><el-option label="委托检测" value="委托检测" /></el-select></el-form-item>
            <el-row :gutter="12">
              <el-col :span="12"><el-form-item label="检测日期"><el-date-picker v-model="reportForm.test_date" type="date" style="width:100%" /></el-form-item></el-col>
              <el-col :span="12"><el-form-item label="有效期至"><el-date-picker v-model="reportForm.expiry_date" type="date" style="width:100%" /></el-form-item></el-col>
            </el-row>
            <el-form-item label="检测机构"><el-input v-model="reportForm.agency_name" /></el-form-item>
            <el-form-item label="结论"><el-radio-group v-model="reportForm.conclusion"><el-radio value="合格">合格</el-radio><el-radio value="不合格">不合格</el-radio></el-radio-group></el-form-item>
            <el-form-item label="不合格项"><el-input v-model="reportForm.unqualified_items" placeholder="如无则留空" /></el-form-item>
          </el-form>
          <template #footer>
            <el-button @click="showReportForm = false">取消</el-button>
            <el-button type="primary" @click="saveReport" :loading="reportSaving">保存</el-button>
          </template>
        </el-dialog>
      </el-tab-pane>

      <el-tab-pane label="不合格品" name="nonconforming">
        <NonConforming v-if="activeTab === 'nonconforming'" source-type="成品检验" />
      </el-tab-pane>

      <el-tab-pane label="留样管理" name="samples">
        <Samples v-if="activeTab === 'samples'" sample-type="成品留样" />
      </el-tab-pane>

      <el-tab-pane label="客诉管理" name="complaint">
        <ComplaintWrapper v-if="activeTab === 'complaint'" />
      </el-tab-pane>
    </el-tabs>
  </div>
</template>

<script setup>
import { ref, reactive, computed, onMounted, watch } from 'vue'
import axios from 'axios'
import { ElMessage, ElMessageBox } from 'element-plus'
import { Search } from '@element-plus/icons-vue'
import NonConforming from './NonConforming.vue'
import Samples from './Samples.vue'
import StandardChanges from './StandardChanges.vue'
import ComplaintWrapper from './ComplaintWrapper.vue'

const user = JSON.parse(localStorage.getItem('user') || '{}')
const activeTab = ref('standards')

// ==================== 产品标准 ====================
const standardsList = ref([])
const standardsLoading = ref(false)
const keyword = ref('')
const filterType = ref('')
const filterStatus = ref('')
const showForm = ref(false)
const showDetail = ref(false)
const showAddIndicator = ref(false)
const editingId = ref(null)
const currentStandard = ref(null)
const indicators = ref([])

const form = reactive({
  standard_name: '', standard_type: '企标', standard_code: '', applicable_products: '',
  effective_date: '', expiry_date: '', status: '现行有效'
})

const indicatorForm = reactive({
  indicator_category: '感官', indicator_name: '', requirement: '', test_method: '', internal_control: ''
})

async function fetchStandards() {
  standardsLoading.value = true
  try {
    const params = { user_id: user.id }
    if (keyword.value) params.keyword = keyword.value
    if (filterType.value) params.standard_type = filterType.value
    if (filterStatus.value) params.status = filterStatus.value
    const { data } = await axios.get('/api/product-standards', { params })
    standardsList.value = data.list
  } finally { standardsLoading.value = false }
}

function openAdd() { editingId.value = null; resetForm(); showForm.value = true }
function openEdit(row) {
  editingId.value = row.id
  Object.assign(form, { standard_name: row.standard_name, standard_type: row.standard_type, standard_code: row.standard_code, applicable_products: row.applicable_products, effective_date: row.effective_date, expiry_date: row.expiry_date, status: row.status })
  showForm.value = true
}

async function deleteStandard(row) {
  try { await ElMessageBox.confirm('确定删除该标准吗？', '提示', { type: 'warning' }) } catch { return }
  await axios.delete(`/api/product-standards/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchStandards()
}

async function save() {
  if (!form.standard_name) return ElMessage.warning('请填写标准名称')
  const payload = { user_id: user.id, ...form }
  if (editingId.value) {
    await axios.put(`/api/product-standards/${editingId.value}`, payload)
    ElMessage.success('更新成功')
  } else {
    await axios.post('/api/product-standards', payload)
    ElMessage.success('添加成功')
  }
  showForm.value = false
  fetchStandards()
}

async function openDetail(row) {
  currentStandard.value = row
  const { data } = await axios.get(`/api/product-standards/${row.id}/indicators`)
  indicators.value = data.list
  showDetail.value = true
}

async function saveIndicator() {
  if (!indicatorForm.indicator_name) return ElMessage.warning('请填写指标名称')
  await axios.post(`/api/product-standards/${currentStandard.value.id}/indicators`, { user_id: user.id, ...indicatorForm })
  ElMessage.success('指标添加成功')
  showAddIndicator.value = false
  Object.assign(indicatorForm, { indicator_category: '感官', indicator_name: '', requirement: '', test_method: '', internal_control: '' })
  openDetail(currentStandard.value)
}

async function deleteIndicator(row) {
  await axios.delete(`/api/product-standards/indicators/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  openDetail(currentStandard.value)
}

function resetForm() {
  Object.assign(form, { standard_name: '', standard_type: '企标', standard_code: '', applicable_products: '', effective_date: '', expiry_date: '', status: '现行有效' })
}

// ==================== 检验记录 ====================
const inspectionsList = ref([])
const inspLoading = ref(false)
const inspSaving = ref(false)
const inspKeyword = ref('')
const inspFilterConclusion = ref('')
const inspFilterType = ref('')
const showInspForm = ref(false)
const showInspDetail = ref(false)
const inspEditingId = ref(null)
const currentInspection = ref(null)

const inspForm = reactive({
  product_name: '', product_batch: '', production_date: '', inspection_date: '', inspector: '',
  inspection_type: '出厂检验', sample_quantity: '',
  sensory_check: { 色泽: '', 气味: '', 组织状态: '', 滋味口感: '', 杂质: '' },
  理化_check: { 水分: '', 盐分: '', 脂肪: '', 蛋白质: '', 过氧化值: '' },
  micro_check: { 菌落总数: '', 大肠菌群: '', 致病菌: '' },
  net_weight_check: { 标准净含量: '', 实测偏差: '' },
  conclusion: '', unqualified_items: '', remarks: ''
})

const inspStats = reactive({ total: 0, qualified: 0, unqualified: 0, todayCount: 0 })

// 详情展示用的表格数据
const sensoryTableData = computed(() => {
  if (!currentInspection.value) return []
  const data = typeof currentInspection.value.sensory_check === 'string' ? JSON.parse(currentInspection.value.sensory_check || '{}') : (currentInspection.value.sensory_check || {})
  return Object.entries(data).map(([k, v]) => ({ key: k, value: v }))
})
const 理化TableData = computed(() => {
  if (!currentInspection.value) return []
  const data = typeof currentInspection.value.理化_check === 'string' ? JSON.parse(currentInspection.value.理化_check || '{}') : (currentInspection.value.理化_check || {})
  return Object.entries(data).map(([k, v]) => ({ key: k, value: v }))
})
const microTableData = computed(() => {
  if (!currentInspection.value) return []
  const data = typeof currentInspection.value.micro_check === 'string' ? JSON.parse(currentInspection.value.micro_check || '{}') : (currentInspection.value.micro_check || {})
  return Object.entries(data).map(([k, v]) => ({ key: k, value: v }))
})
const netWeightTableData = computed(() => {
  if (!currentInspection.value) return []
  const data = typeof currentInspection.value.net_weight_check === 'string' ? JSON.parse(currentInspection.value.net_weight_check || '{}') : (currentInspection.value.net_weight_check || {})
  return Object.entries(data).map(([k, v]) => ({ key: k, value: v }))
})

async function fetchInspections() {
  inspLoading.value = true
  try {
    const params = { user_id: user.id }
    if (inspKeyword.value) params.keyword = inspKeyword.value
    if (inspFilterConclusion.value) params.conclusion = inspFilterConclusion.value
    if (inspFilterType.value) params.inspection_type = inspFilterType.value
    const { data } = await axios.get('/api/product-inspections', { params })
    inspectionsList.value = data.list
  } finally { inspLoading.value = false }
}

async function fetchInspStats() {
  const { data } = await axios.get('/api/product-inspections/stats', { params: { user_id: user.id } })
  Object.assign(inspStats, data)
}

function openInspAdd() {
  inspEditingId.value = null
  resetInspForm()
  showInspForm.value = true
}

function openInspDetail(row) { currentInspection.value = row; showInspDetail.value = true }

async function deleteInspection(row) {
  try { await ElMessageBox.confirm('确定删除该检验记录吗？', '提示', { type: 'warning' }) } catch { return }
  await axios.delete(`/api/product-inspections/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchInspections()
  fetchInspStats()
}

async function saveInspection() {
  if (!inspForm.product_name) return ElMessage.warning('请填写产品名称')
  inspSaving.value = true
  try {
    const payload = { user_id: user.id, ...inspForm }
    if (inspEditingId.value) {
      await axios.put(`/api/product-inspections/${inspEditingId.value}`, payload)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/product-inspections', payload)
      ElMessage.success('添加成功')
    }
    showInspForm.value = false
    fetchInspections()
    fetchInspStats()
  } finally { inspSaving.value = false }
}

function resetInspForm() {
  Object.assign(inspForm, {
    product_name: '', product_batch: '', production_date: '', inspection_date: '', inspector: '',
    inspection_type: '出厂检验', sample_quantity: '',
    sensory_check: { 色泽: '', 气味: '', 组织状态: '', 滋味口感: '', 杂质: '' },
    理化_check: { 水分: '', 盐分: '', 脂肪: '', 蛋白质: '', 过氧化值: '' },
    micro_check: { 菌落总数: '', 大肠菌群: '', 致病菌: '' },
    net_weight_check: { 标准净含量: '', 实测偏差: '' },
    conclusion: '', unqualified_items: '', remarks: ''
  })
}

// ==================== 检验报告 ====================
const reportsList = ref([])
const reportsLoading = ref(false)
const reportSaving = ref(false)
const reportKeyword = ref('')
const reportFilterType = ref('')
const reportFilterConclusion = ref('')
const showReportForm = ref(false)
const reportEditingId = ref(null)

const reportForm = reactive({
  product_name: '', product_batch: '', report_number: '', report_type: '微生物检测',
  agency_name: '', test_date: '', expiry_date: '', conclusion: '合格', unqualified_items: ''
})

async function fetchReports() {
  reportsLoading.value = true
  try {
    const params = { user_id: user.id }
    if (reportKeyword.value) params.keyword = reportKeyword.value
    if (reportFilterType.value) params.report_type = reportFilterType.value
    if (reportFilterConclusion.value) params.conclusion = reportFilterConclusion.value
    const { data } = await axios.get('/api/product-reports', { params })
    reportsList.value = data.list
  } finally { reportsLoading.value = false }
}

function openReportAdd() { reportEditingId.value = null; resetReportForm(); showReportForm.value = true }

function openReportEdit(row) {
  reportEditingId.value = row.id
  Object.assign(reportForm, {
    product_name: row.product_name, product_batch: row.product_batch, report_number: row.report_number,
    report_type: row.report_type, agency_name: row.agency_name, test_date: row.test_date,
    expiry_date: row.expiry_date, conclusion: row.conclusion, unqualified_items: row.unqualified_items
  })
  showReportForm.value = true
}

async function deleteReport(row) {
  try { await ElMessageBox.confirm('确定删除该报告吗？', '提示', { type: 'warning' }) } catch { return }
  await axios.delete(`/api/product-reports/${row.id}`, { data: { user_id: user.id } })
  ElMessage.success('已删除')
  fetchReports()
}

async function saveReport() {
  if (!reportForm.product_name) return ElMessage.warning('请填写产品名称')
  reportSaving.value = true
  try {
    const payload = { user_id: user.id, ...reportForm }
    if (reportEditingId.value) {
      await axios.put(`/api/product-reports/${reportEditingId.value}`, payload)
      ElMessage.success('更新成功')
    } else {
      await axios.post('/api/product-reports', payload)
      ElMessage.success('添加成功')
    }
    showReportForm.value = false
    fetchReports()
  } finally { reportSaving.value = false }
}

function resetReportForm() {
  Object.assign(reportForm, {
    product_name: '', product_batch: '', report_number: '', report_type: '微生物检测',
    agency_name: '', test_date: '', expiry_date: '', conclusion: '合格', unqualified_items: ''
  })
}

// ==================== Tab 切换时加载数据 ====================
watch(activeTab, (val) => {
  if (val === 'inspections') { fetchInspections(); fetchInspStats() }
  if (val === 'reports') { fetchReports() }
})

onMounted(fetchStandards)
</script>

<style scoped>
.page-container{padding:0}
.toolbar{display:flex;justify-content:space-between;align-items:center;margin-bottom:16px}
.toolbar h2{margin:0;color:#303133}

.main-tabs{margin-top:0}
.main-tabs :deep(.el-tabs__header){margin-bottom:0}
.sub-toolbar{margin-top:0;margin-bottom:16px}

/* 统计卡片 */
.stat-row{margin-bottom:16px}
.stat-card{cursor:pointer;text-align:center;transition:transform 0.2s}
.stat-card:hover{transform:translateY(-2px)}
.stat-num{font-size:28px;font-weight:bold;color:#303133}
.stat-num.danger{color:#f56c6c}
.stat-num.info{color:#909399}
.stat-label{font-size:13px;color:#909399;margin-top:4px}

/* 筛选区 */
.filter-card{margin-bottom:16px;display:flex;gap:12px;align-items:center}
.filter-card :deep(.el-card__body){display:flex;gap:12px;align-items:center;flex-wrap:wrap}

.mt20{margin-top:20px}
.mb10{margin-bottom:10px}
.mb20{margin-bottom:20px}
.section-title{color:#303133;margin:12px 0}
.sub-header{display:flex;justify-content:space-between;align-items:center;margin-bottom:12px}
.sub-header h4{margin:0;color:#303133}
</style>
