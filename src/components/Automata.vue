<template>
  <canvas id="glCanvas" ref="glCanvas"></canvas>
  <div ref="automataWindow" class="automataWindow grid items-start justify-center">
    <div id="tooltip"><p style="visibility: hidden"></p></div>
    <div id="ui-container" class="grid overflow-visible justify-center grid-flow-col-dense place-items-center p-2 gap-2">
      <dropdown icon_name="edit" dropdown_title="Pen Settings" @hide-all="hideall = !hideall" :vd="hideall">
        <!-- Pen size -->
        <div class="dropdown-item value-slider" @mouseenter="setTooltip('pen size')">
          <span class="material-icons">line_weight</span>
          <input type="range" min="1" max="200" v-model="simulator.pen.size">
          <span class="label">{{ simulator.pen.size }}</span>
        </div>
        <!-- Pen cell state -->
        <div class="dropdown-item value-slider" @mouseenter="setTooltip('pen cell state')">
          <span class="material-icons">palette</span>
          <input type="range" min="1" :max="simulator.states - 1" v-model="simulator.pen.state">
          <span class="label">{{ simulator.pen.state }}</span>
        </div>
      </dropdown>

      <dropdown icon_name="video_settings" dropdown_title="Simulation Settings" @hide-all="hideall = !hideall" :vd="hideall">
        <!-- Simulation steps per frame -->
        <div class="dropdown-item value-slider" @mouseenter="setTooltip('simulated steps per frame')">
          <span class="material-icons">speed</span>
          <input type="range" min="1" max="16" v-model="simulator.stepsPerFrame">
          <span class="label">{{ simulator.stepsPerFrame }}</span>
        </div>
        <!-- Simulation size -->
        <div class="dropdown-item value-slider" @mouseenter="setTooltip('simulation size')">
          <span class="material-icons">crop_free</span>
          <input type="range" min="8" max="12" :value="Math.floor(Math.log2(simulator.simSize))"
            @input="simulator.simSize = 2**Number($event.target.value)">
          <span class="label">{{ simulator._simSize }}x</span>
        </div>
      </dropdown> 

      <dropdown icon_name="edit_note" dropdown_title="Rule Settings" @hide-all="presetsShow = false; hideall = !hideall" :vd="hideall">
        <!-- Rule Preset -->
        <div class="dropdown-item menu" @mouseenter="setTooltip('rule preset')">
          <span class="material-icons">toc</span>
          <div class="text">{{ simulator.preset }}</div>
          <button class="menu-open" @mousedown="presetsShow = !presetsShow" @mousedown.once="simulator.populatePresets($event.target)">
            <span class="material-icons">arrow_drop_down_circle</span>
            <div class="menu-items" id="presets-menu-items" v-show="presetsShow">
            </div>
          </button>
        </div>
        <!-- Number of States Slider -->
        <div class="dropdown-item value-slider" @mouseenter="setTooltip('number of rule states')">
          <span class="material-icons">style</span>
          <input type="range" name="nstates" id="nstates-slider" min="2" max="14" v-model.number="simulator.states">
          <span class="label">{{ simulator.states }}</span>
        </div>
        <!-- Import Rule -->
        <div class="dropdown-item button-group" @mouseenter="setTooltip('import rule from text')">
          <span class="material-icons">file_download</span>
          <menu-button @mousedown="importDialogue=true">import rule</menu-button>
        </div>
        <!-- Export Rule -->
        <div class="dropdown-item button-group" @mouseenter="setTooltip('export rule to text')">
          <span class="material-icons">file_upload</span>
          <menu-button @mousedown="simulator.export()">export to clipboard</menu-button>
        </div>
      </dropdown>

      <ui-button-toggle label="Pause / Play Sim" :action="() => simulator.pause = !simulator.pause"
        :condition="() => simulator ? simulator.pause : false"
        iconNameOn="play_arrow"
        iconNameOff="pause"/>

      <ui-button label="Step Forward One" :action="() => simulator.step()" iconName="skip_next" />

      <ui-button label="New Random Rule" :action="() => simulator.newRule()" iconName="casino" />

      <ui-button label="Mutate Current Rule" :action="() => simulator.mutate()" iconName="shuffle" />

      <dropdown icon_name="settings_suggest" dropdown_title="Rule Generation Settings" @hide-all="hideall = !hideall" :vd="hideall">
        <!-- Zero State Slider -->
        <div class="dropdown-item value-slider" @mouseenter="setTooltip('rule generation chance of zero state')">
          <span class="material-icons">battery_charging_full</span>
          <input type="range" name="nstates" id="nstates-slider"
            min="0.1" max="2.0" step="0.01" v-model.number="simulator.zeroChanceMultiplier">
          <span class="label">{{ simulator.zeroChanceMultiplier }}</span>
        </div>
        <!-- Mutate Multiplier Slider -->
        <div class="dropdown-item value-slider" @mouseenter="setTooltip('rule mutate amount')">
          <span class="material-icons">leaderboard</span>
          <input type="range" name="nstates" id="nstates-slider"
            min="0.1" max="5.0" step="0.1" v-model.number="simulator.mutateRate">
          <span class="label">{{ simulator.mutateRate }}</span>
        </div>
      </dropdown>

      <ui-button label="Random Fill Sim" :action="fillRandom" iconName="format_color_fill" />

      <ui-button label="Clear Sim" :action="() => simulator.clear()" iconName="clear" />
    </div>

    <transition name="growtl">
      <div class="textbox" v-if="importDialogue">
        <p>paste rule string or config:</p>
        <span class="material-icons" @mousedown="importDialogue=false">cancel</span>
        <textarea ref="input-area" cols="76" rows="14"></textarea>
        <menu-button ref="import-button" style="{ margin: 1rem; margin-left: auto; }" @mousedown="importRule()">import</menu-button>
      </div>
    </transition>
  </div>
</template>

<script lang="ts">
import { Options, Vue } from 'vue-class-component';
import { Sim, randomizeDataBuffer, RuleSpec } from '../sim'
import Dropdown from './Dropdown.vue';
import MenuButton from './MenuButton.vue';
import UIButton from './UIButton.vue';
import UIButtonToggle from './UIButtonToggle.vue';

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
    "dropdown": Dropdown,
    "menu-button": MenuButton,
    "ui-button": UIButton,
    "ui-button-toggle": UIButtonToggle
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
      hideall: true,
      importDialogue: false
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
    },
    importRule() {
      const inpString = this.$refs["input-area"].value as string;
      let input: string | RuleSpec = inpString;
      if (inpString[0] == "{") {
        input = JSON.parse(inpString) as RuleSpec;
      }
      let success = false;
      try {
        success = this.simulator.importRule(input);
      } catch (error) {
        success = false;
      }
      if (success) {
        this.importDialogue = false;
        this.hideall = true;
        this.simulator.preset = "(imported)";
      } else {
        this.$refs["import-button"].anim = "button-error";
      }
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
    overflow: show;
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
    /* TODO: maybe remove this? */
    transform: scaleY(-1);
    z-index: -2;
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
