<template>
  <div class="automataWindow">
    <p>{{ frameRate }} </p>
    <canvas id="glCanvas" ref="glCanvas"></canvas>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import { Sim } from '../sim'
// import colormap_code from '!raw!../shaders/colormap.glsl';
const shaders = {
  "colormap": require('../shaders/colormap.glsl').default,
  "drawing": require('../shaders/drawing.glsl').default,
  "simulate": require('../shaders/simulate.glsl').default,
  "vertex": require('../shaders/vertex.glsl').default
};

@Options({
  props: {
  },
  data() {
    return {
      simulator: null,
      frameRate: String
    }
  },
  watch: {
    simulator: function() {
      if(Date.now() - this.simulator.lastFPSSample >= 1000) {
        this.frameRate = `${this.simulator.frames} frames/sec per ${this.simulator.steps} steps/sec`
      }
    }
  },
  methods: {
  },
  mounted() {
    // console.log(this.$refs["glCanvas"])
    this.simulator = new Sim({canvas: this.$refs["glCanvas"], shaders});
  }
})
export default class HelloWorld extends Vue {}

/* 
import this shit
put a watcher on lastFPSSample
  this watcher should change that content if Date.now() - this.lastFPSSample >= 1000
start executing it 
*/

</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>
</style>
