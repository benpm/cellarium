<template>
  <button
    ref="button"
    class="menu-button" :class="anim"
    @mousedown="anim=''"
    @mouseup="anim='button-anim'"
    >
    <slot></slot>
  </button>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
  data() {
    return {
      anim: ""
    }
  }
})
export default class MenuButton extends Vue {}
</script>

<style scoped>

</style>