<template>
  <link href="https://fonts.googleapis.com/icon?family=Material+Icons" rel="stylesheet">
  <div>
    <Automata/>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import Automata from './components/Automata.vue';

@Options({
  components: {
    Automata,
  },
  data() {
    return {
    }
  },
  methods: {
  }
})
export default class App extends Vue {}
</script>

<style>
#app {
  font-family: Avenir, Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin: 0px;
  padding: 0px;
  overflow: hidden;
}
body {
  margin: 0px;
  padding: 0px;
  overflow: hidden;
}
</style>
