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
          <button @click="presetsShow = !presetsShow" @click.once="simulator.populatePresets($event.target)">
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

const presets = {
  "game of life":        `%Cn9a´ģ+!!Ä!1!!!1"!!!!!!!`,
  "worms":               `%Cn9a´ģ+!!Ä1!11"!122!!!!!`,
  "hilbert":             `%Cn9a´ģ+!!Ä1!!!!2222!!!!!`,
  "tricircuit":          `%Cn9a´ģ+!!Ä2"!!"22"1!!!!!`,
  "sierpinski1":         `%Cn9a´ģ+!!Ä1!!!!2122!!!!!`,
  "complex maze":        `%Cn9a´ģ+!!Ä!1!!!12""!!!!!`,
  "glider city":         `%Cn9a´ģ]!!!ĵ"!#!!"!1!"1!!!#"10!1!"!D"A6!!B!1"I!"1!Ĵ%#!!1#!113!!2!!2!!A!!!!!`,
  "complex gliders":     `%Cn9a´ģQ"!!ĵG!!$!"A$!!!A!!C!#AQ"A1Q!TQQ4$Q1$14##!1C!!!#T4#!A1!!1#!"!!U!ĵ,!AA!!!QD"!RAR11Q##2!!!1$QTv!ĤQ!Q!3A1!Q##!!QW!b31Q!a!ÄRR#!1T!T7!!U!A!3'!£R!1!11t!BA!£!QQ$CÝ!!ê!Q!"QÄ!Ĵ+#1#$!!D"$!1"$Q##!""3#!$$!8!Ķ#$$C2!QSR!!!"$!!$R^!B"!b!!M!!*!Ĵ&$1$#"4!#!"!$QA!"#$$$¹!Ķ$!$!C!"!Q$3A$!A#!QCð!´CT!A"AQü!bQQ2BÝ!1$R"Ĕ"1!DA!C#QQ"!C!!!!`,
  "matrix":              `%Cn9a´ģW"!!1!"!Ĵ6D!""!A!!T!RSA#!!4"S!Q!!C!!!A!B$4A!"QI!Ĵ>1"!"!"$C!Q1$!!S1AS1!D!"33!!"!S!!!$!"!!#D!"Q4.!Ĵ$AQ1!!TS$!#!"$!1"!1J!b!1Q"o!Ĵ%AAQA"!!S!#3#$AQAQ$"W!!º!Ĵ&QS!!C"11!!#QRA!$$1!!b!ÄA$!!14!$ã!QQ!!j!ą#!!A#1D!"#B19!rA!A!$¤!ABBĚ!´2$!#R4C|!!â!!ì!!z!A!1ñ!A!Ql!Ä!$T32!A$Y!a$Q!#ď!Ĵ$SQ!"4"1Q!Q$!!"A1#3/"Ä!!QQS!##^!!ä!ä2A$!!B!!"#!!!!`,
  "city lights":         `%Cn9a´ģ{%!!Ĵ+!!!!ac!1a1A$!$"#T#!!!A"!d:!Ĵ"Q"!!5!!!CQ1$"b%Q5!Ĵ3#T!A!!ba!A11!DA$!#%#Q!Qa#!!$A!#$!b!ô!!%!QDA!!A%U!Q!!$V!Ĵ)!1QT!a%S!#B!!!1!!211#!!x!1"H!Ĥa!Q$AaA!%A!11a4!Ĵ&a"!"!QU!$!!Q1%!2"!a!¤!Ĥ"#B!"A!aQ!!Q5%c!Ĕa!#aa4d!T""!bn!£###QAS+!Ôe"#!a!aA2Ð!1#s!Ĵ'1#Q!Aa5!!a!AdA1!$$%!QË!!Ó!Q$Q1r!Ĵ&R!1%!!b"!Q1A!"a!!$QdÂ!A!$ķ!Ķ!C"!%!!1Q%!!5""Qĸ!Ä1"#!%"Qe¹!"%!£AQ!A!DŁ!Ĵ"D!#"S!a!BR!S!#!#ł!Q!C1G!qTQ"1aę!Ĵ.%!2A#!a#1A!a!"!!$"U%$1!!%$14J!1AP!Aa!ú!qS!d$37"Ä!!%%!1QSö!B$!U"a!Q!UP!R!!3(!AQ!L"Õ%a1!!1#T!a"Äa%$!TU!RB!A"A®"ĵ($$$A!!11#A1QRA!"#EA#!#¼!ô!%!B1Q!#%B#ĕ"AS%ä!Ć2!A$##A!!U%QÜ"ô"1"#Q##1%%S¢!!ĵ"rE!!1aÓ"1C®!!¿!Q1"1(!!0!q$!!%RQ#ä%!!%24"#"UV!ĄU$5!E%A#S!!Aě!q"41#CU!QASQ(!A#"ô!"-"AAA2!q%5!5#Ŀ!A$"í"Ô$$!!!A#!1Ĕ!1"}!Aa%?!1E¸!"%!b##A"È#1SÁ#!P!"8!a!!"Sñ!q%!!Qb«"!Å!q!R1"#Ĝ"A$$¯"Ô!!Ce!1!AQŁ"!ĺ"a$A!Qĩ#1Qć"!K#aeA#AO#a!a1!6$ĥQE"2!1B!!Q$$1!É!£1!"#2#b#!Ö#ÔQ!%1a1Q!3>!´C#"Ua!!G"1#đ!A#%º$110#µ#!$e"!#,!aA"1a¡$q!Aa1aÚ#1#ŀ"£%!!#R"Í!a!B!%Ð$´Q!C!1"A2$´#b!5%!"½#aa##c|"¤"!T"%e4!Ä5Qa!A"1$&$1!Ø"1"8"ÄQ!adA$$1ı#!;!Q"$$ĩ$1TÁ"A!a×$Ĵ$""Q$d1AQQ1cb1!R!e1Y!1!ö#ĵ#cU5T!a!%$#!Ab%#!$7"1!Į#1$Ê!!Ķ!Ĵ7AQdQD!!Qa!!aE!aA!A"AQaC#dQ#!%S#1!BQa%N!#û#1$Ł!"ã%B!!Ā"!ü"Ĵ&%Q""#53$!%d%5d!S!a#"!!!!`,
  "circuit city":        `%Cn9a´ģ©%!!a!QQ!"!a31aS)!Ĵ8#a!!%Q#%!!"!AD"Q!!1#!a!UR#!Aa%!!#"!5$UK!ĕ!!E!a"Aa%b%%Q=!q"!a!A<!ĵN$%!!!TD%QQ!QS"!$!"!"!1a#1$a$!!aT!!!caQ!"!!!$!1S"%#!b1!!ab%!ad!ca$UAÜ!1A·!!p!Å!"!$2!11¥!ôQ!!Ua$a1#$"Ą!A#!ó!b!bBAü!Ĵ%!!A1A%Aa!#b#!!Qa!2!n!¤#Aa!!1y!Ĵ)1%"QD#"a$#"!a1A!!!DA!"CÀ!Ĵ/cU"!S$R!!"QA!!%!A!$!!!A""Q$R1h!AR!Ç!ôe#!1!a"!#!$ø!aR!1!î!!ė!ä!a!Q!A1$$!)"Ĵ51$Q!#!BA!4!!$aA%""a"4#e#!U!$"!%Q!#cP!Ĵ"!3Q%!$Aa$!cB!T!S¾"ĄQ!$%AA!D!aA4É!å!!#%!"ad$3/!qS%1!"I!aa!"!D"1Ač!£!$A#!3¶"Q%13Ñ"Q5!%Ń!Ä%!#e!1$a4!Ĵ"1!d!Qa$%!"cA1"!!6!acQ3!ĕ!Q%1!Đ!QC!!ë"1Ut!c1%#QF!£!5R%%!³"1QY!q!!U1"O!ĔA!#!"%!"AA41"á!B1eG!#]"!·!!?"£A2!$!1}"A4!ľ"!}#!ü!1!~!!a"Ä4!URQ!"dR!£1%A!!QJ!å!!ea#!"Aa1Ī"">!Ķ$!A!AbA"!EAR!!aa""Tû!ö!A$1!!S!QDA2!22ġ!´!1Qa!C"Ġ!A$Sè"Q"2!B!£%$1%QA|#14ę!´!U!A!S!q"r2!!!5æ#Ĵ9e"C"C!#Q!%!U#"!dd!%!T!b%!"b#!A$!$BT$#!#1#R!Q"T!1#«#´eDc$$!#Þ""Q$RQ%$¹!Q$!$s$qQ51#%>!Q!!AÀ!!_"1"í"Ĵ&AB$!$d!U3%#$Q!"#2RQa¼#b!A"A¿#q"2!"Q{"qDAa%%Å#´BdR%!Acã#1"E"1"K"Ĵ*B!%5!!B!Aa"b%aA!!1"$AaB$é$!$"Ą2%!%"Ac2a#TEĺ$ĤQ1"%"!#B!%SQ!!Ė!1$<#ĔQ!!%#$#aT#!d#é"´$#"3!##ą"´Q%!c!!B¦$!/$Ô!1#QQ!Be4Q$ĵ!%!###%!RSR!!!41þ!Ĥa#!bCa!#a!dD#CĻ"Ĵ!Q#B#A$#!!"Q#!!cĚ!1Q{!Q1Q1µ"ä#1Q12S!#aCµ!ôa!!D$!!4!E!ß!Ĵ-1"#!!E"1!#%aaA!c!T!a"!!#TE$!!!!`,
  "chaosbox":            '%Cn9a´ģ¥%!!Ĵ)!!!Q!3#bC!$!!A1!#!S#AA!/!ĵ)RAd!!1!T!c!B!!DQ%A"!%!!%!Ĵ$!!QADQ#!1T1Q!!AQ!#%!Ô5"!Qa$%#Av!Ĵ!"!!!!Aa1!!$#!#bX!ĔS#aAQ1!S!!%a$@!£"!51Q#+!ĄA%!QQ#A"A$$$Î!"¬!Ĕa!c#A!A"1!!1TÐ!1aL!"&!Ĵ8!"$C!a!#1!!Q5A!$%C!A"!!5Q!"!!a!!$"!#!bP!ħ#Q!"%B1T3!B!""9!´D!A#!!3u!Q#!AH!R!!#Z!´!!!$%"!`!£!!U!AE2!"w!ôAa!Aa!"Q!5AN!R$!cZ!RA%!¸!Å1A#!$a!Qs"q!!!CA,!ÖD1S!!!UU5§!õ!T%$"S!#A"aj"Ôa$51R!Q2$ħ!ĵ,!D1!"!A%%QA%%3"!!"#Q$"e2TQr"õ!!!#"!aQd#1½!Ė1#!A%$!a!"c!B½!Ĵ"AQ5$!#!"#$S!!c!5ċ"!Ĝ!ĵ"!"%A!%1$$1!1!$4#5!bU4!!|"B3!ľ!aa!2!Ē"ôQ"$R1!!"A%%ß"ĵ("!!11!Q%!4!1A!%!"cD#!%É"qR$$3"ģ"£!CA$%1Ă!Ĵ9"a!$B!!!E!1%!%Q!Q!Aa%#a"5B##$Q1$C!!##Q%¤#Ĵ*aAa"1!#"A!#!#Q!U#%A!!4a!ą!q!!51!Õ#Ab%à!aa!4!ø!Ĵ+"3$4A!Q2!A""!%S$!%RA!a!aD>!!³"r$U$!Q¾#"´"å1!$c3$Q"!1Ğ!£##!Q!2ě"Q1!$Ö"1%Ĭ!!Ð!ĵ"!Qb!aEA"Aa!aAS1Tģ!´e!bQ!%#î#!Ó##¹"ä1A!Q1!ab!RÁ#qQA!Q%B!1Rē"aQ1!!Ï!ä%#"!"$!Sd#*$1#g"A!%é#q#$RB"|#Ĵ#QE2!$aQ!C!SAd"a%5N#ĄB!A!aA!ca"A!Ù#Ĵ!""1!1aaA#!!%2Q$ÿ"õAa##SS%!!QRĥ!a!!T!?#2B§!Ä"A#R#!a2R!1cN#Ĵ"!EQ51E"Q!AEU#$b!T#1"Ĺ!3aF"bC$!$ě!ÄUeaA!%eAă#ôQCU!!%"QU#!+%!¦$´!!Qe!4a$%AQC="a1"#%ğ$aQQ!1Ĥ!a%Q#!õ"a%!bTu#Ĥ"DE!AA3!!S!Q#"s%AEaä"Ĥa!%Q%1a$!3!1b$Õ$!/"!ĺ!Ä1a!!e#Q"ă"q%%!SSĶ$q%%""!f#1!Ģ$£"1$!%cļ!1$À!r!S#!!m#Ĵ#41"c#a$1!"A!$!$!!!!!!',
  "metastable":          `%Cn9a´ģY"!!ĵ9!!A!RA"A!!!#!"!#!C1B!A!!$!!11!!1!!!D!!Q$!£#$!T!34!!6!£#A!R!Q#!£#!C!!CM!Ĵ.11ADQQA"!1!S1R"!32#A!1QQ!!!"Y!Ô$!#!!Q#R#}!ĔAQ!AT!!"4!R41¶!1A¹!aT1#17!q"!!Q2Î!B"CÁ!!Ö!Ĥ!!"$A!#$3!##!CO!ĴAS!"!TQ#!!"!!!R##T!QTQ!"!QQ!1#T!!4BAR""Q!AC!!1TQI!Ĥ#A""$"#1!!Q1!!S!´A#!$!"1&"a1"Q"ĺ!a3$A!2"£$!!$"4!"Ĕ!#!1!A$$C!"QBÄ!Ĵ"!"#S$""!2!!T!TQ1!!!!`,
  "chaotic growth":      `%Cn9a´ģc!!!Ķ(#!!#!!!A!#!A#A1A"A##""1!1!:!Ĥ""!C!1C13!#"AAG!Ĵ#!!AC#2"A1B1#C!!A!!!!!`,
};

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
