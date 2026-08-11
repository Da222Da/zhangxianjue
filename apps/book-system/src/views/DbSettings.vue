<template>
  <div class="page-scroll db-settings">
    <h2 class="page-title">数据库连接设置</h2>

    <div class="panel-card section">
      <div class="panel-title">当前连接</div>
      <el-form label-width="120px" style="max-width:640px">
        <el-form-item label="数据库路径">
          <el-input v-model="dbPath" placeholder="SQLite 文件路径" />
        </el-form-item>
        <el-form-item label="状态">
          <el-tag :type="connected ? 'success' : 'danger'">{{ connected ? '已连接' : '未连接' }}</el-tag>
        </el-form-item>
        <el-form-item>
          <el-button type="primary" @click="connect" :loading="connecting">重新连接</el-button>
          <el-button @click="checkHealth">检测状态</el-button>
        </el-form-item>
      </el-form>
    </div>

    <div class="panel-card section">
      <div class="panel-title">数据表浏览</div>
      <div class="table-tabs">
        <el-radio-group v-model="currentTable" @change="loadTable">
          <el-radio-button v-for="t in tables" :key="t.name" :value="t.name">{{ t.name }}</el-radio-button>
        </el-radio-group>
      </div>
      <div class="table-wrap" v-if="currentTable">
        <el-table :data="tableData" stripe style="width:100%" max-height="420" v-loading="tableLoading">
          <el-table-column
            v-for="col in columns"
            :key="col.name"
            :prop="col.name"
            :label="col.name"
            :min-width="col.name.length > 8 ? 140 : 100"
            show-overflow-tooltip
          />
        </el-table>
        <div class="pager">
          <el-pagination
            v-model:current-page="tablePage"
            :total="tableTotal"
            :page-size="20"
            layout="total, prev, pager, next"
            @current-change="loadTable"
          />
        </div>
      </div>
    </div>

    <div class="panel-card section">
      <div class="panel-title">说明</div>
      <ul class="tips">
        <li>系统默认使用本地 SQLite 数据库存储用户、图书、评分与推荐日志。</li>
        <li>可指定自定义路径切换数据库文件，路径需服务器可访问。</li>
        <li>管理员可通过「图书管理」进行数据增删改查与 Excel 导入导出。</li>
      </ul>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue'
import { ElMessage } from 'element-plus'
import api from '@/api'

const dbPath = ref('')
const connected = ref(false)
const connecting = ref(false)
const tables = ref([])
const currentTable = ref('')
const tableData = ref([])
const columns = ref([])
const tablePage = ref(1)
const tableTotal = ref(0)
const tableLoading = ref(false)

async function checkHealth() {
  try {
    const { data } = await api.get('/health')
    connected.value = data.ok
    ElMessage.success(data.ok ? '数据库连接正常' : '数据库未连接')
  } catch {
    connected.value = false
  }
}

async function loadInfo() {
  const { data } = await api.get('/db/info')
  dbPath.value = data.path
  await checkHealth()
  await loadTables()
}

async function connect() {
  connecting.value = true
  try {
    await api.post('/db/connect', { dbPath: dbPath.value })
    ElMessage.success('连接成功')
    connected.value = true
    await loadTables()
  } finally {
    connecting.value = false
  }
}

async function loadTables() {
  try {
    const { data } = await api.get('/data/tables')
    tables.value = data
    if (data.length && !currentTable.value) {
      currentTable.value = data[0].name
      loadTable()
    }
  } catch {
    tables.value = []
  }
}

async function loadTable() {
  if (!currentTable.value) return
  tableLoading.value = true
  try {
    const { data } = await api.get(`/data/table/${currentTable.value}`, {
      params: { page: tablePage.value, pageSize: 20 }
    })
    tableData.value = data.list
    tableTotal.value = data.total
    columns.value = data.columns
  } finally {
    tableLoading.value = false
  }
}

onMounted(loadInfo)
</script>

<style scoped lang="scss">
.page-title {
  font-size: 20px;
  color: var(--primary-color);
  margin-bottom: 20px;
}
.section {
  margin-bottom: 20px;
}
.table-tabs {
  margin-bottom: 16px;
}
.table-wrap {
  overflow-x: auto;
}
.pager {
  margin-top: 12px;
  display: flex;
  justify-content: flex-end;
}
.tips {
  padding-left: 20px;
  line-height: 2;
  color: rgba(232, 240, 248, 0.7);
  font-size: 14px;
}
</style>
