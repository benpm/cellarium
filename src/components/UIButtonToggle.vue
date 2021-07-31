<template>
  <button
    class="options-button"
    @mouseenter="setTooltip(label)"
    @mouseleave="setTooltip()"
    @mousedown="action()"
    @keydown.stop=""
    >
    <span v-if="condition()" class="material-icons">{{ iconNameOn }}</span>
    <span v-if="!condition()" class="material-icons">{{ iconNameOff }}</span>
  </button>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
  props: {
    label: String,
    iconNameOn: String,
    iconNameOff: String,
    condition: Function,
    action: Function
  }
})
export default class MenuButton extends Vue {}
</script>

<style scoped>

</style>