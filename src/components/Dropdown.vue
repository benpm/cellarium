<template>
  <button class="options-button" v-bind:style="{'background-color': shown ? '#555555' : ''}" @click="$emit('hide-all'); clicked = true;">
    <span class="material-icons">{{ icon_name }}</span>
    <transition name="fade">
      <div @click.stop="" class="rounded dropdown" v-if="shown">
        <h1>{{ dropdown_title }}</h1>
        <slot></slot>
      </div>
    </transition>
  </button>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';

@Options({
  props: ["icon_name", "dropdown_title", "vd"],
  emits: [
    "hide-all"
  ],
  data() {
    return {
      shown: false,
      clicked: false
    }
  },
  watch: {
    vd() {
      this.shown = this.clicked;
      this.clicked = false;
    }
  },
  mounted() {
    document.getElementById("glCanvas")?.addEventListener("mousedown", () => {
      this.shown = false;
    })
  }
})
export default class Dropdown extends Vue {}
</script>

<style scoped>

</style>