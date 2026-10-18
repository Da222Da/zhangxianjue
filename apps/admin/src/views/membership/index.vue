<!-- src/views/membership/index.vue -->
<template>
  <el-main>
    <div class="header-actions">
      <el-select v-model="status" class="status-filter" placeholder="全部状态" clearable @change="handleFilterChange">
        <el-option label="待审核" value="pending" />
        <el-option label="已通过" value="approved" />
        <el-option label="已拒绝" value="rejected" />
      </el-select>
      <el-button type="primary" size="small" @click="handleFilterChange">刷新</el-button>
    </div>

    <el-table v-loading="loading" :data="applications" row-key="id" stripe border style="width: 100%">
      <el-table-column label="操作" width="180" align="center" fixed="left">
        <template #default="{ row }">
          <div v-if="row.status === 'pending'" class="action-buttons">
            <el-button link type="primary" size="small" @click="review(row, true)">通过</el-button>
            <el-button link type="danger" size="small" @click="review(row, false)">拒绝</el-button>
          </div>
          <span v-else class="empty-cell">已处理</span>
        </template>
      </el-table-column>
      <el-table-column prop="id" label="ID" width="70" align="center" />
      <el-table-column prop="username" label="申请人" min-width="140" show-overflow-tooltip />
      <el-table-column label="手机号" width="140">
        <template #default="{ row }">{{ row.phone || "—" }}</template>
      </el-table-column>
      <el-table-column label="当前角色" width="120">
        <template #default="{ row }">
          <el-tag size="small" type="info">{{ row.role_name || `#${row.role_id}` }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请状态" width="110" align="center">
        <template #default="{ row }">
          <el-tag size="small" :type="statusTagType(row.status)">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
      <el-table-column label="申请时间" width="172">
        <template #default="{ row }">{{ formatDateTime(row.createdAt) }}</template>
      </el-table-column>
      <el-table-column label="审核时间" width="172">
        <template #default="{ row }">{{ row.reviewed_at ? formatDateTime(row.reviewed_at) : "—" }}</template>
      </el-table-column>
    </el-table>

    <el-pagination
      v-model:current-page="page"
      v-model:page-size="pageSize"
      class="pagination"
      background
      layout="total, sizes, prev, pager, next"
      :page-sizes="[10, 20, 50]"
      :total="total"
      @current-change="fetchApplications"
      @size-change="handleFilterChange"
    />

    <p class="table-hint">通过后用户角色会立即变成「会员」，默认有效期 1 年并自动获得书库阅读权限；到期后自动降级为普通用户。拒绝只是标记状态。</p>
  </el-main>
</template>

<script lang="ts" setup>
import { onMounted, ref } from "vue";
import { ElMessage, ElMessageBox } from "element-plus";
import membershipService from "@/api/membershipService";
import type { MembershipApplicationItem, MembershipApplicationStatus } from "@/types/api";

const applications = ref<MembershipApplicationItem[]>([]);
const loading = ref(false);
const status = ref<MembershipApplicationStatus | null>(null);
const page = ref(1);
const pageSize = ref(10);
const total = ref(0);

const statusText = (value: MembershipApplicationStatus): string => {
  switch (value) {
    case "pending":
      return "待审核";
    case "approved":
      return "已通过";
    default:
      return "已拒绝";
  }
};

const statusTagType = (value: MembershipApplicationStatus): "warning" | "success" | "danger" => {
  switch (value) {
    case "pending":
      return "warning";
    case "approved":
      return "success";
    default:
      return "danger";
  }
};

const formatDateTime = (value: string): string => value.replace("T", " ").slice(0, 19);

const fetchApplications = async (): Promise<void> => {
  loading.value = true;
  try {
    const res = await membershipService.getApplications({
      status: status.value ?? undefined,
      page: page.value,
      pageSize: pageSize.value,
    });
    applications.value = res.data;
    total.value = res.total ?? res.data.length;
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : "获取会员申请失败");
  } finally {
    loading.value = false;
  }
};

const handleFilterChange = (): void => {
  page.value = 1;
  void fetchApplications();
};

const review = async (row: MembershipApplicationItem, approve: boolean): Promise<void> => {
  const action = approve ? "通过" : "拒绝";
  try {
    await ElMessageBox.confirm(
      approve
        ? `确定通过「${row.username}」的会员申请吗？通过后角色变成「会员」，有效期 1 年。`
        : `确定拒绝「${row.username}」的会员申请吗？`,
      `${action}申请`,
      { type: "warning", confirmButtonText: action, cancelButtonText: "取消" },
    );
  } catch {
    return;
  }

  try {
    await membershipService.reviewApplication(row.id, approve);
    ElMessage.success(`已${action}`);
    // 处理完当前页最后一条时回退一页，避免停在空白页
    if (applications.value.length === 1 && page.value > 1) {
      page.value -= 1;
    }
    await fetchApplications();
  } catch (error) {
    ElMessage.error(error instanceof Error ? error.message : `${action}失败`);
  }
};

onMounted(fetchApplications);
</script>

<style scoped lang="scss">
.header-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  margin-bottom: 16px;
}

.status-filter {
  width: 150px;
}

.pagination {
  margin-top: 16px;
  justify-content: flex-end;
}

.empty-cell {
  color: var(--el-text-color-placeholder);
}

.table-hint {
  margin-top: 12px;
  color: var(--el-text-color-secondary);
  font-size: 13px;
}

.action-buttons {
  display: flex;
  justify-content: center;
  gap: 2px;
}
</style>
