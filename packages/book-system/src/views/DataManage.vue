<template>
  <div class="page-scroll data-manage">
    <div class="page-header">
      <h2>图书数据管理</h2>
      <div class="actions">
        <el-input v-model="keyword" placeholder="搜索书名/作者/ISBN" clearable style="width:220px" @clear="load" @keyup.enter="load" />
        <el-select v-model="category" placeholder="分类" clearable style="width:120px" @change="load">
          <el-option v-for="c in categories" :key="c" :label="c" :value="c" />
        </el-select>
        <el-button type="primary" @click="load">查询</el-button>
        <el-button type="success" @click="openEdit()" v-if="userStore.isEditor">新增</el-button>
        <el-button @click="handleExport" v-if="userStore.isEditor">导出</el-button>
        <el-upload
          v-if="userStore.isEditor"
          :show-file-list="false"
          :http-request="handleImport"
          accept=".xlsx,.xls,.csv"
        >
          <el-button>导入</el-button>
        </el-upload>
      </div>
    </div>

    <div class="table-wrap panel-card">
      <el-table :data="list" stripe style="width:100%" v-loading="loading" height="100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="title" label="书名" min-width="140" show-overflow-tooltip />
        <el-table-column prop="author" label="作者" width="100" />
        <el-table-column prop="category" label="分类" width="90" />
        <el-table-column prop="publisher" label="出版社" width="140" show-overflow-tooltip />
        <el-table-column prop="rating" label="评分" width="70" />
        <el-table-column prop="recommend_score" label="推荐分" width="80" />
        <el-table-column prop="price" label="价格" width="70" />
        <el-table-column prop="stock" label="库存" width="70" />
        <el-table-column prop="publish_year" label="年份" width="70" />
        <el-table-column label="操作" width="160" fixed="right" v-if="userStore.isEditor">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)" v-if="userStore.isAdmin">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        :page-sizes="[10, 20, 50]"
        layout="total, sizes, prev, pager, next"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑图书' : '新增图书'" width="560px" destroy-on-close>
      <el-form :model="form" label-width="90px">
        <el-form-item label="书名" required>
          <el-input v-model="form.title" />
        </el-form-item>
        <el-form-item label="作者">
          <el-input v-model="form.author" />
        </el-form-item>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="分类">
              <el-input v-model="form.category" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出版社">
              <el-input v-model="form.publisher" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="ISBN">
              <el-input v-model="form.isbn" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="出版年">
              <el-input-number v-model="form.publish_year" :min="1900" :max="2030" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="8">
            <el-form-item label="评分">
              <el-input-number v-model="form.rating" :min="0" :max="5" :step="0.1" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="推荐分">
              <el-input-number v-model="form.recommend_score" :min="0" :max="100" :step="0.1" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="8">
            <el-form-item label="价格">
              <el-input-number v-model="form.price" :min="0" :step="0.1" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-row :gutter="12">
          <el-col :span="12">
            <el-form-item label="页数">
              <el-input-number v-model="form.pages" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
          <el-col :span="12">
            <el-form-item label="库存">
              <el-input-number v-model="form.stock" :min="0" style="width:100%" />
            </el-form-item>
          </el-col>
        </el-row>
        <el-form-item label="简介">
          <el-input v-model="form.description" type="textarea" :rows="3" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="dialogVisible = false">取消</el-button>
        <el-button type="primary" @click="save" :loading="saving">保存</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
import { ref, reactive, onMounted } from 'vue'
import { ElMessage, ElMessageBox } from 'element-plus'
import api from '@/api'
import { useUserStore } from '@/stores'

const userStore = useUserStore()
const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(20)
const keyword = ref('')
const category = ref('')
const loading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)
const categories = ['文学', '科技', '历史', '哲学', '艺术', '经济', '教育', '生活', '少儿', '计算机']

const form = reactive({
  id: null, title: '', author: '', category: '', publisher: '', isbn: '',
  rating: 4, recommend_score: 70, description: '', publish_year: 2024, pages: 300, price: 49, stock: 100
})

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/books', {
      params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value, category: category.value }
    })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function openEdit(row) {
  if (row) {
    Object.assign(form, row)
  } else {
    Object.assign(form, {
      id: null, title: '', author: '', category: '文学', publisher: '', isbn: '',
      rating: 4, recommend_score: 70, description: '', publish_year: 2024, pages: 300, price: 49, stock: 100
    })
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.title) return ElMessage.warning('请填写书名')
  saving.value = true
  try {
    if (form.id) {
      await api.put(`/books/${form.id}`, form)
    } else {
      await api.post('/books', form)
    }
    ElMessage.success('保存成功')
    dialogVisible.value = false
    load()
  } finally {
    saving.value = false
  }
}

async function handleDelete(row) {
  try {
    await ElMessageBox.confirm(`确定删除《${row.title}》？`, '提示', { type: 'warning' })
    await api.delete(`/books/${row.id}`)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel') { /* ignore cancel */ }
  }
}

async function handleExport() {
  const res = await api.get('/data/export', { responseType: 'blob' })
  const url = URL.createObjectURL(res.data)
  const a = document.createElement('a')
  a.href = url
  a.download = 'books.xlsx'
  a.click()
  URL.revokeObjectURL(url)
}

async function handleImport({ file }) {
  const fd = new FormData()
  fd.append('file', file)
  const { data } = await api.post('/data/import', fd)
  ElMessage.success(data.message)
  load()
}

onMounted(load)
</script>

<style scoped lang="scss">
.data-manage {
  display: flex;
  flex-direction: column;
  height: 100%;
  max-height: 100%;
}

.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;

  h2 {
    font-size: 20px;
    color: var(--primary-color);
  }
  .actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
    align-items: center;
  }
}

.table-wrap {
  flex: 1;
  min-height: 400px;
  overflow: hidden;
  display: flex;
  flex-direction: column;

  :deep(.el-table) {
    flex: 1;
  }
}

.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  padding-bottom: 20px;
}
</style>
