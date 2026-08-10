<!-- src/views/roles/index.vue -->
<template>
  <div>
    <el-card>
      <el-table :data="articles">
        <el-table-column prop="title" label="标题" width="180" />
        <el-table-column prop="content" label="内容" />
        <el-table-column prop="createdAt" label="创建时间" width="250" />
        <el-table-column prop="updatedAt" label="更新时间" width="250" />
        <el-table-column fixed="right" label="操作" width="120">
          <template #default="{ row }">
            <el-button link type="primary" size="small" @click="handleArticlesDialog(row, 'preview')"> 详情 </el-button>
            <el-button link type="primary" size="small" @click="handleArticlesDialog(row, 'edit')">编辑</el-button>
          </template>
        </el-table-column>
      </el-table>
    </el-card>

    <ArticlesDialog :modelValue="articlesDialogVisible" :articles="articlesInfo" @close="articlesDialogVisible = false" />
  </div>
</template>

<script lang="ts" setup>
import { ref, reactive, onMounted } from "vue";
import { ElMessage } from "element-plus";
import { useRouter } from "vue-router";
import articleService from "@/api/articleService";
import ArticlesDialog from "./ArticlesDialog.vue";

const articles = ref([]);
const articlesDialogVisible = ref(false);
const articlesInfo = reactive({
  id: "",
  mode: "preview",
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

// 处理文章弹框
const handleArticlesDialog = (article, mode = "preview") => {
  const { title, content, id } = article;
  articlesDialogVisible.value = true;
  articlesInfo.id = id;
  articlesInfo.mode = mode;
  articlesInfo.title = title;
  articlesInfo.content = content;
};

// 在组件挂载时获取文章列表
onMounted(() => {
  fetchArticles();
});
</script>
