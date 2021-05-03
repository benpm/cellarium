<template>
  <div class="automataWindow grid items-start justify-center">
    <div id="ui-container" class="grid overflow-visible justify-center grid-flow-col-dense place-items-center p-2 gap-2">
      <dropdown icon_name="edit" dropdown_title="Pen Settings" @hide-all="hideall = !hideall" :vd="hideall">
        <div class="dropdown-item value-slider">
          <span class="material-icons">line_weight</span>
          <input type="range" min="1" max="200" v-model="simulator.pen.size">
          <span class="label">{{ simulator.pen.size }}</span>
        </div>
        <div class="dropdown-item value-slider">
          <span class="material-icons">palette</span>
          <input type="range" min="1" max="14" v-model="simulator.pen.state">
          <span class="label">{{ simulator.pen.state }}</span>
        </div>
      </dropdown>

      <dropdown icon_name="video_settings" dropdown_title="Simulation Settings" @hide-all="hideall = !hideall" :vd="hideall">
        <div class="dropdown-item value-slider">
          <span class="material-icons">speed</span>
          <input type="range" min="1" max="16" v-model="simulator.stepsPerFrame">
          <span class="label">{{ simulator.stepsPerFrame }}</span>
        </div>
        <div class="dropdown-item value-slider">
          <span class="material-icons">crop_free</span>
          <input type="range" min="8" max="12" value="10"
            @change="simulator.simSize = 2**Number($event.target.value)">
          <span class="label">{{ simulator._simSize }}x</span>
        </div>
      </dropdown> 

      <dropdown icon_name="edit_note" dropdown_title="Rule Settings" @hide-all="hideall = !hideall" :vd="hideall">
        <div class="dropdown-item menu">
          <span class="material-icons">toc</span>
          <input type="text" name="preset" id="preset-menu" v-model="simulator.preset">
          <button class="menu-button" @click="presetsShow = !presetsShow" @click.once="simulator.populatePresets($event.target)">
            <span class="material-icons">arrow_drop_down_circle</span>
            <div class="menu-items" id="presets-menu-items" v-show="presetsShow">
            </div>
          </button>
        </div>
        <div class="dropdown-item value-slider">
          <span class="material-icons">style</span>
          <input type="range" name="nstates" id="nstates-slider" min="2" max="14" v-model.number="simulator.states">
          <span class="label">{{ simulator.states }}</span>
        </div>
      </dropdown>

      <button class="options-button" @click="simulator.pause = !simulator.pause">
        <span v-if="simulator ? simulator.pause : false" class="material-icons">play_arrow</span>
        <span v-if="simulator ? !simulator.pause : true" class="material-icons">pause</span>
      </button>

      <button class="options-button" @click="simulator.step()">
        <span class="material-icons">skip_next</span>
      </button>

      <button class="options-button" @click="simulator.newRule()">
        <span class="material-icons">casino</span>
      </button>

      <button class="options-button" @click="fillRandom()">
        <span class="material-icons">format_color_fill</span>
      </button>

      <button class="options-button" @click="simulator.clear()">
        <span class="material-icons">clear</span>
      </button>
    </div>
    <canvas id="glCanvas" ref="glCanvas"></canvas>
    <p id="rtinfo" class="front absolute top-0 left-0 p-1 m-0 text-light bg-dark text-sm">{{ frameRate }} </p>

  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import { Sim, randomizeDataBuffer } from '../sim'
import Dropdown from './Dropdown.vue';

const shaders = {
  "colormap": require('../shaders/colormap.glsl').default,
  "drawing": require('../shaders/drawing.glsl').default,
  "simulate": require('../shaders/simulate.glsl').default,
  "vertex": require('../shaders/vertex.glsl').default
};

// Process the presets stored inside rules.txt
const presetsRaw: string = require('../rules.txt').default;
const presets: Record<string, string> = {};
for (const line of presetsRaw.split("\n")) {
  const split = line.split(":: ");
  presets[split[0].trim()] = split[1];
}

@Options({
  components: {
    "dropdown": Dropdown
  },
  props: {
  },
  emits: [
    "hide-menu"
  ],
  data() {
    return {
      simulator: null,
      frameRate: "",
      presetsShow: false,
      hideall: true
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
    blah() {
      console.debug("blah");
    },
    fillRandom() {
      randomizeDataBuffer(this.simulator.states);
      this.simulator.resetSim();
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
    this.$refs["glCanvas"].addEventListener("wheel", this.simulator.onScrollWheel.bind(this.simulator));
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
