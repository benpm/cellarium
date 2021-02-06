<template>
  <div class="automataWindow">
    <canvas id="glCanvas" ref="glCanvas"></canvas>
    <p id="rtinfo">{{ frameRate }} </p>
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
    window.addEventListener("resize", this.simulator.resize.bind(this.simulator));
    this.simulator.resize();
    window.addEventListener("mousemove", this.simulator.mouseHandler.bind(this.simulator));
    window.addEventListener("mousedown", this.simulator.clickOn.bind(this.simulator));
    window.addEventListener("mouseup", this.simulator.clickOff.bind(this.simulator));
    window.addEventListener("wheel", this.simulator.onScrollWheel.bind(this.simulator));
    window.addEventListener("keydown", this.simulator.onKey.bind(this.simulator));
    window.addEventListener("keyup", this.simulator.onKeyUp.bind(this.simulator));
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

  .automataWindow {
    margin: 0px;
    padding: 0px;
    overflow: hidden;
  }

  #glCanvas {
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    image-rendering: optimizeSpeed;
    transform: scaleY(-1);
  }

  #info {
    position: absolute;
    left: 0px;
    bottom: 0px;
    background: black;
    color: white;
    font-family: Consolas, monospace;
    padding: 4px;
    font-size: 12px;
  }

  #rtinfo {
    position: absolute;
    left: 0px;
    top: 0px;
    background: black;
    color: white;
    font-family: Consolas, monospace;
    padding: 4px;
    font-size: 12px;
    margin: 0px;
  }

  #viewer-window {
    position: absolute;
    bottom: 1px;
    right: 1px;
    width: 512px;
    height: 512px;
    overflow: hidden;
    background: magenta;
    border: white 1px solid;
  }
</style>
