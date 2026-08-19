<template>
  <div class="app">
    <el-card class="box-card">
      <el-radio-group v-model="type" fill="#409eff">
        <el-radio-button label="编辑模式" value="edit" />
        <el-radio-button label="预览模式" value="preview" />
      </el-radio-group>
      <el-switch style="padding-top: 10px; padding-left: 5px" v-model="enableToolbar" inline-prompt active-text="开启工具栏" inactive-text="关闭工具栏" />
    </el-card>
    <el-card class="box-markmap">
      <Markmap :type="type" :value="initValue" :enableToolbar="enableToolbar" />
    </el-card>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from "vue";

const type = ref("edit");
const enableToolbar = ref(true);

const initValue = `
# markmap

## Links

- [Website](https://markmap.js.org/)
- [GitHub](https://github.com/gera2ld/markmap)


Markdown content here
`;
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
