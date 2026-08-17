<template>
  <div class="page-scroll user-manage">
    <div class="page-header">
      <h2>用户管理</h2>
      <div class="actions">
        <el-input v-model="keyword" placeholder="搜索用户名/手机号" clearable style="width:220px" @keyup.enter="load" />
        <el-button type="primary" @click="load">查询</el-button>
        <el-button type="success" @click="openEdit()">添加用户</el-button>
      </div>
    </div>

    <div class="table-wrap panel-card">
      <el-table :data="list" stripe style="width:100%" v-loading="loading" height="100%">
        <el-table-column prop="id" label="ID" width="70" />
        <el-table-column prop="username" label="用户名" width="140" />
        <el-table-column prop="phone" label="手机号" width="140" />
        <el-table-column prop="role" label="角色" width="120">
          <template #default="{ row }">
            <el-tag :type="roleType(row.role)" size="small">{{ roleLabel(row.role) }}</el-tag>
          </template>
        </el-table-column>
        <el-table-column prop="created_at" label="创建时间" min-width="160" />
        <el-table-column label="操作" width="160" fixed="right">
          <template #default="{ row }">
            <el-button link type="primary" @click="openEdit(row)">编辑</el-button>
            <el-button link type="danger" @click="handleDelete(row)">删除</el-button>
          </template>
        </el-table-column>
      </el-table>
    </div>

    <div class="pager">
      <el-pagination
        v-model:current-page="page"
        v-model:page-size="pageSize"
        :total="total"
        layout="total, prev, pager, next"
        @current-change="load"
        @size-change="load"
      />
    </div>

    <el-dialog v-model="dialogVisible" :title="form.id ? '编辑用户' : '添加用户'" width="440px" destroy-on-close>
      <el-form :model="form" label-width="80px">
        <el-form-item label="用户名" required>
          <el-input v-model="form.username" />
        </el-form-item>
        <el-form-item :label="form.id ? '新密码' : '密码'" :required="!form.id">
          <el-input v-model="form.password" type="password" :placeholder="form.id ? '留空则不修改' : ''" show-password />
        </el-form-item>
        <el-form-item label="手机号">
          <el-input v-model="form.phone" maxlength="11" />
        </el-form-item>
        <el-form-item label="角色">
          <el-select v-model="form.role" style="width:100%">
            <el-option label="管理员" value="admin" />
            <el-option label="编辑" value="editor" />
            <el-option label="普通用户" value="user" />
          </el-select>
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

const list = ref([])
const total = ref(0)
const page = ref(1)
const pageSize = ref(10)
const keyword = ref('')
const loading = ref(false)
const dialogVisible = ref(false)
const saving = ref(false)

const form = reactive({ id: null, username: '', password: '', phone: '', role: 'user' })

function roleLabel(r) {
  return { admin: '管理员', editor: '编辑', user: '普通用户' }[r] || r
}
function roleType(r) {
  return { admin: 'danger', editor: 'warning', user: 'info' }[r] || 'info'
}

async function load() {
  loading.value = true
  try {
    const { data } = await api.get('/users', {
      params: { page: page.value, pageSize: pageSize.value, keyword: keyword.value }
    })
    list.value = data.list
    total.value = data.total
  } finally {
    loading.value = false
  }
}

function openEdit(row) {
  if (row) {
    Object.assign(form, { id: row.id, username: row.username, password: '', phone: row.phone, role: row.role })
  } else {
    Object.assign(form, { id: null, username: '', password: '', phone: '', role: 'user' })
  }
  dialogVisible.value = true
}

async function save() {
  if (!form.username) return ElMessage.warning('请填写用户名')
  if (!form.id && !form.password) return ElMessage.warning('请填写密码')
  saving.value = true
  try {
    if (form.id) {
      await api.put(`/users/${form.id}`, form)
    } else {
      await api.post('/users', form)
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
    await ElMessageBox.confirm(`确定删除用户 ${row.username}？`, '提示', { type: 'warning' })
    await api.delete(`/users/${row.id}`)
    ElMessage.success('已删除')
    load()
  } catch (e) {
    if (e !== 'cancel') { /* ignore cancel */ }
  }
}

onMounted(load)
</script>

<style scoped lang="scss">
.user-manage {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.page-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
  h2 { font-size: 20px; color: var(--primary-color); }
  .actions { display: flex; gap: 8px; align-items: center; }
}
.table-wrap {
  flex: 1;
  min-height: 400px;
  overflow: hidden;
}
.pager {
  margin-top: 16px;
  display: flex;
  justify-content: flex-end;
  padding-bottom: 20px;
}
</style>
