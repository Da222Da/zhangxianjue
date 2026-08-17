<template>
  <el-dialog v-model="visiable" :title="dialogTitle" width="80%" @close="handleColse" destroy-on-close>
    <el-input v-if="type !== 'view'" v-model="articleTitle" style="width: 240px; margin-bottom: 10px" placeholder="请输入文章标题" />
    <div style="height: 65vh">
      <Markdown :value="articles.content" :mode="markdownMode" ref="markdownRef" />
    </div>
    <template #footer>
      <div v-if="type === 'edit'">
        <el-button @click="handleColse">关闭</el-button>
        <el-button type="primary" @click="update"> 更新 </el-button>
      </div>
      <div v-else-if="type === 'add'">
        <el-button @click="handleColse">关闭</el-button>
        <el-button type="primary" @click="add"> 新增 </el-button>
      </div>
      <div v-else></div>
    </template>
  </el-dialog>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { ElMessage } from "element-plus";
import articleService from "@/api/articleService";

const props = defineProps({
  type: String, // 'edit' or 'view' or 'add'
  modelValue: Boolean,
  markdownMode: String,
  articles: Object,
});

const emit = defineEmits(["close", "update"]);
const visiable = ref(props.modelValue);
const articleTitle = computed({
  get() {
    return props.articles.title;
  },
  set(val) {
    props.articles.title = val;
  },
});
const dialogTitle = computed(() => {
  switch (props.type) {
    case "edit":
      return "编辑文章";
    case "view":
      return "查看文章";
    case "add":
      return "新增文章";
  }
});
const markdownRef = ref(null);

const handleColse = () => {
  emit("close");
  visiable.value = false;
};

const add = async () => {
  const { id, title } = props.articles;
  try {
    const res = await articleService.createArticle({ title: articleTitle.value, content: markdownRef.value.getMarkdownContent() });
    ElMessage.success("文章新增成功");
    handleColse();
    emit("update");
  } catch (err) {
    ElMessage.error("文章新增失败", err.message);
  }
};

const update = async () => {
  const { id, title } = props.articles;
  try {
    const res = await articleService.updateArticle(id, { title: articleTitle.value, content: markdownRef.value.getMarkdownContent() });
    ElMessage.success("文章更新成功");
    handleColse();
    emit("update");
  } catch (err) {
    ElMessage.error("文章更新失败", err.message);
  }
};

watch(
  () => props.modelValue,
  (newVal) => {
    if (newVal) {
      visiable.value = newVal;
    }
  },
);
</script>
