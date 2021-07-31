<template>
  <button
    class="options-button"
    @mouseenter="setTooltip(label)"
    @mouseleave="setTooltip()"
    @mousedown="action()"
    @keydown.stop=""
    >
    <span class="material-icons">{{ iconName }}</span>
  </button>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
  props: {
    label: String,
    iconName: String,
    condition: Function,
    action: Function
  }
})
export default class MenuButton extends Vue {}
</script>

<style scoped>

</style>