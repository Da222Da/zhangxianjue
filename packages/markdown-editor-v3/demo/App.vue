<template>
  <div class="app">
    <el-card class="box-card">
      <el-radio-group v-model="mode" fill="#409eff">
        <el-radio-button label="预览模式" value="previewOnly" />
        <el-radio-button label="编辑模式" value="edit&preview" />
        <el-radio-button label="编辑只读模式" value="editOnly" />
      </el-radio-group>
    </el-card>
    <el-card class="box-markmap">
      <Markdown :modelValue="initValue" :mode="mode" @update:modelValue="handleUpdate" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const mode = ref("edit&preview");

const initValue = `
# markmap

## Links

- [Website](https://markmap.js.org/)
- [GitHub](https://github.com/gera2ld/markmap)


Markdown content here
`;

const handleUpdate = (value: string) => {
  console.log("处理内容更新", value);
};
</script>

<style scoped>
.app {
  width: 100%;
  height: 100%;
}
.box-card {
  width: 100%;
  height: 80px;
}
.box-markmap {
  width: 100%;
  height: calc(100% - 80px);
}
</style>
