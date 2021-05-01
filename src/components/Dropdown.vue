<template>
  <button @click="shown = !shown">
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
  props: {
    "icon_name": String,
    "dropdown_title": String
  },
  data() {
    return {
      shown: false
    }
  }
})
export default class Dropdown extends Vue {}
</script>

<style scoped>

</style>