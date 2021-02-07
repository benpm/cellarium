<template>
  <div class="automataWindow grid items-start justify-center">
    <div id="ui-container" class="grid overflow-visible justify-center grid-flow-col-dense place-items-center p-2 gap-2">
      <button @click="penSettingsShow = !penSettingsShow">
        <span class="material-icons">edit</span>
        <transition name="fade">
          <div class="rounded dropdown" v-if="penSettingsShow">
            <h1>Pen Settings</h1>
          </div>
        </transition>
      </button>

      <button @click="simSettingsShow = !simSettingsShow">
        <span class="material-icons">video_settings</span>
        <transition name="fade">
          <div class="rounded dropdown" v-if="simSettingsShow">
            <h1>Simulation Settings</h1>
          </div>
        </transition>
      </button>

      <button @click="simulator.pause = !simulator.pause">
        <span v-if="simulator ? simulator.pause : false" class="material-icons">play_arrow</span>
        <span v-if="simulator ? !simulator.pause : true" class="material-icons">pause</span>
      </button>

      <button>
        <span @click="simulator.step()" class="material-icons">skip_next</span>
      </button>

      <button>
        <span @click="simulator.newRule()" class="material-icons">casino</span>
      </button>

      <button>
        <span @click="simulator.fillRandom()" class="material-icons">format_color_fill</span>
      </button>

      <button>
        <span @click="simulator.clear()" class="material-icons">clear</span>
      </button>
    </div>
    <canvas id="glCanvas" ref="glCanvas"></canvas>
    <p id="rtinfo" class="front absolute top-0 left-0 p-1 m-0 text-light bg-dark text-sm">{{ frameRate }} </p>

  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import { Sim } from '../sim'

const shaders = {
  "colormap": require('../shaders/colormap.glsl').default,
  "drawing": require('../shaders/drawing.glsl').default,
  "simulate": require('../shaders/simulate.glsl').default,
  "vertex": require('../shaders/vertex.glsl').default
};

const presets = {
  "[3] glider city": `%Cn9a´ģ]!!!ĵ"!#!!"!1!"1!!!#"10!1!"!D"A6!!B!1"I!"1!Ĵ%#!!1#!113!!2!!2!!A!!!!!`
};

@Options({
  props: {
  },
  data() {
    return {
      simulator: null,
      frameRate: "",
      penSettingsShow: false,
      simSettingsShow: false,
    }
  },
  watch: {
    'simulator.fps': function() {
      this.frameRate = `${this.simulator.frames} frames/sec per ${this.simulator.steps} steps/sec`;
      this.simulator.frames = 0;
      this.simulator.steps = 0;
    }
  },
  methods: {
    changePenSize() {
      this.simulator.clear()
    }
  },
  mounted() {
    this.$refs["glCanvas"].addEventListener("contextmenu", (e: Event) => e.preventDefault());
    this.simulator = new Sim(this.$refs["glCanvas"] as HTMLCanvasElement, presets, shaders);
    this.simulator.resize();
    window.addEventListener("resize", this.simulator.resize.bind(this.simulator));
    window.addEventListener("mousemove", this.simulator.mouseHandler.bind(this.simulator));
    this.$refs["glCanvas"].addEventListener("mousedown", this.simulator.clickOn.bind(this.simulator));
    this.$refs["glCanvas"].addEventListener("mouseup", this.simulator.clickOff.bind(this.simulator));
    window.addEventListener("wheel", this.simulator.onScrollWheel.bind(this.simulator));
    window.addEventListener("keydown", this.simulator.onKey.bind(this.simulator));
    window.addEventListener("keyup", this.simulator.onKeyUp.bind(this.simulator));
    this.simulator.animateScene();
  }
})
export default class HelloWorld extends Vue {}
</script>

<!-- Add "scoped" attribute to limit CSS to this component only -->
<style scoped>

  .automataWindow {
    margin: 0px;
    padding: 0px;
    overflow: hidden;
  }

  #glCanvas {
    position: absolute;
    top: 0px;
    left: 0px;
    width: 100vw;
    height: 100vh;
    margin: 0;
    padding: 0;
    overflow: hidden;
    image-rendering: optimizeSpeed;
    transform: scaleY(-1);
    z-index: 1;
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
