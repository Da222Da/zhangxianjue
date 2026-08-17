<template>
  <div class="scene-switcher">
    <button
      v-for="s in scenes"
      :key="s.id"
      type="button"
      :class="{ active: modelValue === s.id }"
      @click="$emit('update:modelValue', s.id)"
    >
      {{ s.name }}
    </button>
  </div>
</template>

<script setup>
defineProps({
  modelValue: { type: String, required: true },
  scenes: { type: Array, default: () => [] }
})
defineEmits(['update:modelValue'])
</script>

<style scoped lang="scss">
.scene-switcher {
  display: flex;
  gap: 8px;
  background: rgba(10, 30, 55, 0.75);
  padding: 6px 10px;
  border-radius: 24px;
  border: 1px solid rgba(201, 162, 39, 0.3);

  button {
    padding: 6px 16px;
    border: none;
    background: transparent;
    color: rgba(232, 240, 248, 0.55);
    font-size: 13px;
    border-radius: 16px;
    cursor: pointer;
    font-family: inherit;
    &.active {
      background: rgba(201, 162, 39, 0.28);
      color: var(--primary-color);
    }
  }
}
</style>
