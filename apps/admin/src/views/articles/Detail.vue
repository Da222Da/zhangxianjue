<template>
  <div>
    <el-button @click="goBack" style="margin-bottom: 20px">返回列表</el-button>
    <div>
      <h1>{{ article.title }}</h1>
      <div>{{ article.content }}</div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import { useRouter, useRoute } from "vue-router";
import articleService from "@/api/articleService";

const router = useRouter();
const route = useRoute();
const article = ref({});

const goBack = () => router.go(-1);

onMounted(async () => {
  try {
    const { data } = await articleService.getArticleDetail(route.params.id);
    if (data.status) {
      article.value = data.data;
    }
  } catch (error) {
    console.error("获取文章详情失败:", error);
  }
});
</script>
