<!-- src/views/roles/index.vue -->
<template>
  <div>
    <div style="margin-bottom: 10px; display: flex; justify-content: flex-end">
      <el-button type="primary" size="small" @click="openDialog('add')"> 新增 </el-button>
    </div>
    <el-card>
      <el-table :data="articles">
        <el-table-column prop="title" label="标题" width="180" />
        <el-table-column prop="content" label="内容" />
        <el-table-column prop="createdAt" label="创建时间" width="250" />
        <el-table-column prop="updatedAt" label="更新时间" width="250" />
        <el-table-column fixed="right" label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="openDialog('view', row)"> 详情 </el-button>
            <el-button link type="primary" size="small" @click="openDialog('edit', row)">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <ArticlesDialog :type="dialogType" :markdownMode="markdownMode" :modelValue="articlesAddDialogVisible" :articles="articlesInfo" @close="articlesAddDialogVisible = false" @update="fetchArticles" />
    <ArticlesDialog :type="dialogType" :markdownMode="markdownMode" :modelValue="articlesDetailsDialogVisible" :articles="articlesInfo" @close="articlesDetailsDialogVisible = false" />
    <ArticlesDialog :type="dialogType" :markdownMode="markdownMode" :modelValue="articlesEditDialogVisible" :articles="articlesInfo" @close="articlesEditDialogVisible = false" @update="fetchArticles" />
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import articleService from "@/api/articleService";
import ArticlesDialog from "./ArticlesDialog.vue";

const articles = ref([]);
const dialogType = ref("view");
const articlesAddDialogVisible = ref(false); // 新增文章
const articlesDetailsDialogVisible = ref(false); // 查看文章
const articlesEditDialogVisible = ref(false); // 编辑文章
const markdownMode = ref("preview"); // Markdown 模式
const articlesDialogVisible = ref(false);
let articlesInfo = reactive({
  id: "",
  title: "",
  content: "",
});
const router = useRouter();

// 获取文章列表
const fetchArticles = async () => {
  try {
    const res = await articleService.getArticle();
    articles.value = res.data;
  } catch (error: any) {
    ElMessage.error(error.message);
  }
};

// 打开弹框
const openDialog = (type, row) => {
  dialogType.value = type;

  switch (type) {
    case "add":
      articlesAddDialogVisible.value = true;
      markdownMode.value = "add";
      articlesInfo = {
        id: "",
        title: "",
        content: "",
      };
      break;
    case "view":
      articlesDetailsDialogVisible.value = true;
      markdownMode.value = "preview";
      articlesInfo = row;
      break;
    case "edit":
      articlesEditDialogVisible.value = true;
      markdownMode.value = "edit";
      articlesInfo = row;
      break;
  }
};

// 在组件挂载时获取文章列表
onMounted(() => {
  fetchArticles();
});
</script>
