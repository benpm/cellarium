<template>
  <button ref="button" class="options-button" v-bind:style="{'background-color': shown ? '#555555' : ''}" @click="onClick()">
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
      this.$refs.button.blur();
    }
  },
  mounted() {
    document.getElementById("glCanvas")?.addEventListener("mousedown", () => {
      this.shown = false;
    })
  },
  methods: {
    onClick() {
      this.$emit('hide-all');
      if (!this.shown) {
        this.clicked = true;
      }
      this.$refs.button.blur();
    }
  }
})
export default class Dropdown extends Vue {}
</script>

<style scoped>

</style>