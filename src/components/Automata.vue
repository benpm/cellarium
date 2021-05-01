<template>
  <div class="automataWindow grid items-start justify-center">
    <div id="ui-container" class="grid overflow-visible justify-center grid-flow-col-dense place-items-center p-2 gap-2">
      <dropdown icon_name="edit" dropdown_title="Pen Settings">
        <div class="value-slider">
          <span class="material-icons">line_weight</span>
          <input type="range" name="pen-size" id="pen-size-slider" min="1" max="200" v-model="simulator.pen.size">
          <span class="label">{{ simulator.pen.size }}</span>
        </div>
      </dropdown>

      <dropdown icon_name="video_settings" dropdown_title="Simulation Settings">
        <div class="value-slider">
          <span class="material-icons">speed</span>
          <input type="range" name="pen-size" id="pen-size-slider" min="1" max="16" v-model="simulator.stepsPerFrame">
          <span class="label">{{ simulator.stepsPerFrame }}</span>
        </div>
        <div class="value-slider">
          <span class="material-icons">crop_free</span>
          <input type="range" name="sim-size" id="sim-size-slider" min="8" max="12" value="10"
            @change="simulator.simSize = 2**Number($event.target.value)">
          <span class="label">{{ simulator._simSize }}x</span>
        </div>
      </dropdown>

      <dropdown icon_name="edit_note" dropdown_title="Rule Settings">
        <div class="value-slider">
          <span class="material-icons">style</span>
          <input type="range" name="nstates" id="nstates-slider" min="2" max="14" v-model.number="simulator.states">
          <span class="label">{{ simulator.states }}</span>
        </div>
      </dropdown>

      <button @click="simulator.pause = !simulator.pause">
        <span v-if="simulator ? simulator.pause : false" class="material-icons">play_arrow</span>
        <span v-if="simulator ? !simulator.pause : true" class="material-icons">pause</span>
      </button>

      <button @click="simulator.step()">
        <span class="material-icons">skip_next</span>
      </button>

      <button @click="simulator.newRule()">
        <span class="material-icons">casino</span>
      </button>

      <button @click="simulator.fillRandom()">
        <span class="material-icons">format_color_fill</span>
      </button>

      <button @click="simulator.clear()">
        <span class="material-icons">clear</span>
      </button>
    </div>
    <canvas id="glCanvas" ref="glCanvas"></canvas>
    <p id="rtinfo" class="front absolute top-0 left-0 p-1 m-0 text-light bg-dark text-sm">{{ frameRate }} </p>

  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import { Sim } from '../sim'
import Dropdown from './Dropdown.vue';

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
  components: {
    "dropdown": Dropdown
  },
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
export default class Automata extends Vue {}
</script>

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
