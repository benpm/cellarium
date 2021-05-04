<template>
  <button :class="anim" ref="button" @mousedown="anim=''" @mouseup="anim='button-anim'"><slot></slot></button>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
  data() {
    return {
      anim: ""
    }
  },
  methods: {
    onClick() {
      this.$refs.button.class = "";
      this.$refs.button.class = "button-anim";
    }
  }
})
export default class MenuButton extends Vue {}
</script>

<style scoped>

</style>