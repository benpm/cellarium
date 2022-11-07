/* eslint-disable @typescript-eslint/no-non-null-assertion */
import lz4 from "lz4js";
import { rule } from "postcss";

function factorial(m: number) {
    let n = 1;
    for (let i = 2; i <= m; i++) {
        n *= i;
    }
    return n;
}

function binomial(n: number, k: number) {
    return Math.floor(factorial(n) / (factorial(k) * factorial(n - k)));
}

function ruleSubIndices(states: number) {
    return binomial(states + 8 - 1, states - 1);
}

function fmod(a: number, b: number) {
    return a - b * Math.floor(a / b);
}

//From https://gist.github.com/ssippe/1f92625532eef28be6974f898efb23ef#gistcomment-3364149
function cartesianProduct<T>(...allEntries: T[][]): T[][] {
    return allEntries.reduce<T[][]>(
        (results, entries) =>
            results
                .map(result => entries.map(entry => result.concat([entry])))
                .reduce((subResults, result) => subResults.concat(result), []),
        [[]]
    )
}

//Enumerates 
function ruleSubIndex(x: number, y: number, n: number[]) {
    let Z = 0;
    for (let i = 1; i < n.length; i++) {
        const v = n[i];
        if (v > 0) {
            Z += binomial(y + x - 1, x - 1) - binomial(y - v + x - 1, x - 1);
        }
        x -= 1;
        y -= v;
    }
    return Z;
}

function ruleLength(states: number) {
    return states * ruleSubIndices(states);
}

//Returns the number of states needed to represent the given rule length
function minStates(length: number) {
    //Infer the number of states this must have
    for (let i = 3; i <= 14; i++) {
        if (ruleLength(i) > length) {
            return i - 1;
        }
    }
}

const pchars = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſƀƁƂƃƄƅƆƇƈƉƊƋƌƍƎƏƐƑƒƓƔƕƖƗƘƙƚƛƜƝƞƟƠơƢƣƤƥƦƧƨƩƪƫƬƭƮƯưƱƲƳƴƵƶƷƸƹƺƻƼƽƾƿǀǁǂ";
// Map from pchar codes back to indices
const pcharMap: Record<string, number> = {};
for (let i = 0; i < pchars.length; i++) {
    pcharMap[pchars.charCodeAt(i)] = i;
}

export interface RuleSpec {
    states: number;
    rules: Array<{in: number; out: number; alt?: number; N?: Record<number, Array<number>>}>;
}

//This has to live outside of the class otherwise it's really slow for some reason
const texDataBuffer = new Uint8Array(4096**2*4);

export function randomizeDataBuffer(m: number) {
    console.time("Randomizing data buffer");
    for (let i = 0; i < texDataBuffer.length; i+= 4) {
        texDataBuffer[i+0] = Math.floor(Math.random()*255);
        texDataBuffer[i+1] = Math.floor(Math.random()*255);
        texDataBuffer[i+2] = Math.floor(Math.random()*255);
        texDataBuffer[i+3] = Math.floor(Math.random() * m);
    }
    console.timeEnd("Randomizing data buffer")

    console.log(texDataBuffer.slice(0, 4))
}

export class Sim {
    gl: WebGL2RenderingContext;                 // WebGL2 rendering context, passed into constructor
    simProgram?: WebGLProgram;                  // WebGL program for simulating cellular automata
    colorProgram?: WebGLProgram;                // WebGL program for drawing CA state in correct colors
    drawProgram?: WebGLProgram;                 // WebGL program for drawing CA state in correct colors
    simUniforms: Record<                        // Uniforms for simProgram
        string,
        {loc: WebGLUniformLocation}> = {};
    colorUniforms: any;                         // Uniforms for colorProgram
    drawUniforms: any;                          // Uniforms for colorProgram
    _simSize = 1024;                             // Size of simulation texture in pixels
    ruleData = new Uint8Array(1024**2);         // Raw bytes of rule data
    ruleTex?: WebGLTexture;                     // WebGL texture containing rule data
    colorMapTex?: WebGLTexture;                 // State to color map texture
    binomialTex?: WebGLTexture;                 // State to binomial map texture
    colorMap = new Uint8Array([                 // Mapping from state to color
        // 1, 22, 39,
        // 246, 247, 248,
        // 255, 51, 102,
        // 32, 164, 243,
        // 42, 96, 65,
        // 46, 196, 182,
        // 243, 222, 138,
        // 126, 127, 154,
        // 254, 198, 1,
        // 234, 115, 23,

        /* 0  */ 20, 20, 20,
        /* 1  */ 220, 220, 220,
        /* 2  */ 220, 50, 50,
        /* 3  */ 50, 220, 50,
        /* 4  */ 50, 50, 220,
        /* 5  */ 220, 220, 50,
        /* 6  */ 50, 220, 220,
        /* 7  */ 220, 50, 220,
        /* 8  */ 220, 50, 175,
        /* 9  */ 50, 220, 175,
        /* 10 */ 175, 50, 220,
        /* 11 */ 220, 220, 175,
        /* 12 */ 175, 220, 50,
        /* 13 */ 50, 175, 220
    ]);
    nStateMap: Map<number, number> = new Map(); // Mapping from rule length to number of states
    _states = 2;                                // Number of cellular automata states
    nSubIndices = ruleSubIndices(this._states); // Number of subindices in current rule
    pen = {                                     // Pen properties
        state: 1,
        size: 50
    };
    _preset = "game of life";                   // Current rule preset selection
    doStep = false;                             // Indicates that a simulation step should be performed
    pause = true;                              // Simulation is paused
    stepsPerFrame = 1;                          // Simulation steps per rendered frame
    flip = false;                               // Indicates framebuffer flip
    private fbA?: WebGLFramebuffer;                     // First framebuffer
    private fbB?: WebGLFramebuffer;                     // Second framebuffer
    private texA?: WebGLTexture;
    private texB?: WebGLTexture;
    steps = 0;                                  // Simulation steps so far
    frames = 0;                                 // Rendered frames so far
    lastFPSSample = Date.now();                 // Millisecond timestap of last FPS sample
    fps = 0;                                    // Frames per second
    cam = {
        x: 0,
        y: 0,
        zoom: 1,
        zoomLevel: 0,
        zoomLevels: [1, 2, 3, 4, 6, 8, 12, 16],
        panstartcam: {x:0, y:0},
        panstartmouse: {x:0, y:0},
        panning: false,
        move: {x:0, y:0}
    };
    mouse = { x: 0, y: 0 };
    zeroChanceMultiplier = 0.5;
    mutateRate = 1.0;
    keysPressed = new Set<string>();
    renderStatesElsePaints = true;
    
    constructor(
        private canvas: HTMLCanvasElement,
        private presets: Record<string, string>,
        shaders: Record<string, string>) {
        this.gl = this.canvas.getContext("webgl2", {
            premultipliedAlpha: false
        })!;
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        for (let i = 2; i <= 14; i++) {
            this.nStateMap.set(ruleLength(i), i);
        }
        this.webGlSetup(shaders);
        // randomizeDataBuffer(this._states);
        this.resetSim();
        //Create clipboard node
        if (!document.getElementById("_clipboard")) {
            const clipboardNode = document.createElement("input");
            clipboardNode.id = "_clipboard";
            clipboardNode.type = "text";
            document.body.appendChild(clipboardNode);
        }
    }
    get preset(): string {
        return this._preset;
    }
    set preset(val: string) {
        this._preset = val;
        if (this.presets[val]) {
            this.importRule(this.presets[val]);
        }
    }
    get simSize(): number {
        return this._simSize;
    }
    set simSize(val: number) {
        this._simSize = val;
        if (this.fbA && this.fbB) {
            this.clear();
            this.texSetup();
        }
    }
    populatePresets() {
        const menuItems = document.getElementById("presets-menu-items");
        for (const preset of Object.entries(this.presets)) {
            const item = document.createElement("span");
            item.innerHTML = preset[0];
            item.className = "menu-item";
            item.addEventListener("mousedown", () => {
                this.preset = preset[0];
            });
            menuItems?.appendChild(item);
        }
    }
    screenToWorld(pos: number) {
        return Math.floor(fmod((
            this.cam.x + Math.floor(pos) / this.cam.zoom), this.simSize)) / this.simSize;
    }
    mouseHandler(e: MouseEvent) {
        this.updateMousepos(Math.floor(e.pageX), Math.floor(e.pageY));
    }
    updateMousepos(x: number, y: number) {
        this.mouse.x = x;
        this.mouse.y = y;
        this.drawUniforms.mouse.val[0] = (Math.floor(fmod((
            this.cam.x + (x) / this.cam.zoom), this.simSize)) / this.simSize);
        this.drawUniforms.mouse.val[1] = (Math.floor(fmod((
            this.cam.y + (y) / this.cam.zoom), this.simSize)) / this.simSize);
        if (this.cam.panning) {
            this.cam.x = fmod(this.cam.panstartcam.x + (this.cam.panstartmouse.x - x)
                / this.cam.zoom, this.simSize * 2);
            this.cam.y = fmod(this.cam.panstartcam.y + (this.cam.panstartmouse.y - y)
                / this.cam.zoom, this.simSize * 2);
        }
    }
    clickOn(e: MouseEvent) {
        switch (e.button) {
            case 0: // Left click
                this.drawUniforms.mouse.val[2] = this.pen.state;
                break;
            case 1: // Middle click
                this.cam.panning = true;
                this.cam.panstartmouse.x = this.mouse.x;
                this.cam.panstartmouse.y = this.mouse.y;
                this.cam.panstartcam.x = this.cam.x;
                this.cam.panstartcam.y = this.cam.y;
                this.canvas.style.cursor = "move";
                break;
            case 2: // Right click
                this.drawUniforms.mouse.val[2] = 0;
                break;
        }
    }
    clickOff(e: MouseEvent) {
        switch (e.button) {
            case 0: // Left click
            case 2: // Right click
                this.drawUniforms.mouse.val[2] = -1;
                break;
            case 1: // Middle click
                this.cam.panning = false;
                this.canvas.style.cursor = "";
                break;
        }
    }
    onScrollWheel(e: WheelEvent) {
        const scroll = (e.deltaY < 0 ? 1 : -1);
        if (this.keysPressed.has("shift")) {
            const scrollAmount = Math.ceil(this.pen.size / 16);
            this.pen.size = Math.max(1, this.pen.size + scroll * scrollAmount);
        } else {
            const z = this.cam.zoom;
            this.cam.zoomLevel = Math.max(0,
                Math.min(this.cam.zoomLevel + scroll, this.cam.zoomLevels.length - 1)
            );
            this.cam.zoom = this.cam.zoomLevels[this.cam.zoomLevel]
    
            const spX = this.mouse.x;
            const spY = this.mouse.y;
            const wpX = this.drawUniforms.mouse.val[0] * this.simSize;
            const wpY = this.drawUniforms.mouse.val[1] * this.simSize;
            this.cam.x = wpX - Math.floor(spX / this.cam.zoom);
            this.cam.y = wpY - Math.floor(spY / this.cam.zoom);
            this.updateMousepos(spX, spY);
        }
    }
    randomRule() {
        const length = ruleLength(this.numStates);
        const rule = new Uint8Array(length);
        const zeroChance = Math.max(1 - (1 / Math.pow(this.numStates, this.zeroChanceMultiplier)), this.zeroChanceMultiplier);
        for (let i = 0; i < length; i++) {
            if (Math.random() < zeroChance) {
                rule[i] = 0;
            } else {
                rule[i] = Math.floor(Math.random() * this.numStates);
            }
        }
        return rule;
    }
    newRule() {
        this.setRule(this.randomRule());
        this._preset = "...random";
    }
    //Returns the 1D index into the rule binary string
    ruleIndex(state: number, neighbors: number[]) {
        let subIndex = 0;
        //The number of
        let x = this.numStates;
        //The number of neighbors unaccounted for
        let y = 8;
        for (let i = 1; i < neighbors.length; i++) {
            const v = neighbors[i];
            if (v > 0) {
                subIndex += binomial(y + x - 1, x - 1) - binomial(y - v + x - 1, x - 1);
            }
            x -= 1;
            y -= v;
        }
        return state * this.nSubIndices + subIndex;
    }
    //Exports rule to unicode string
    exportRule(rule: Uint8Array): string {
        console.info(`exporting rule length ${rule.length}`);
        //Treat each value in the rule as a 4-bit slice of a 16-bit number
        const values = [];
        for (let i = 0; i < rule.length; i += 4) {
            let value = 0;
            for (let j = 0; j < 4 && i + j < rule.length; j++) {
                value |= rule[i + j] << (j * 4);
            }
            values.push(value);
        }
        const x = new Uint16Array(values);
        const v = new Uint8Array(x.buffer);
        const compbytes = new Uint16Array(lz4.compress(v));
        let string = "";
        compbytes.forEach((v) => string += pchars[v]);
        
        return string;
    }
    //Imports rule from compressed code string or a rule spec JSON object
    importRule(r: string | RuleSpec) {
        if (typeof(r) == "string") {
            //Decompress rule string
            let compbytes = new Uint8Array(r.length);
            compbytes = compbytes.map((_, i) => { return pcharMap[r.charCodeAt(i)]});
            let x;
            try {
                x = lz4.decompress(compbytes);
            }
            catch {
                console.error("invalid rule string");
                return false;
            }
            const values = new Uint16Array(x.buffer);
            //Extract values from decompressed values
            let z = 0;
            for (let i = 0; i < values.length; i++) {
                for (let j = 0; j < 4; j++) {
                    this.ruleData[z] = (values[i] >> (j * 4)) & 0xF;
                    z += 1;
                }
            }
            //Infer the number of states this must have
            this.numStates = minStates(z)!;
        } else if (typeof(r) == "object") {
            console.assert(r.states <= 14 && r.states >= 2);
            this.numStates = r.states;
            //By default states will transition to themselves
            for (let s = 0; s < r.states; s++) {
                //This is the first index of the rules that have <s> as an input state
                const j = this.ruleIndex(s, []);
                //Fill values within the entire subindex range
                this.ruleData.fill(s, j, j + this.nSubIndices);
            }
            for (const rl of r.rules) {
                if (rl.N && Object.keys(rl.N).length > 0) {
                    //All possible configurations of neighbor counts specified
                    const neighborGroups = cartesianProduct(...Array.from(Object.values(rl.N)))
                        .filter((v,i) => v.reduce(((p,c) => p+c)) <= 8);
                    //States which are specified
                    const T = Object.keys(rl.N).map((v) => parseInt(v));
                    for (const neighbors of neighborGroups) {
                        //Neighbor counts for only specified states
                        const N = Array<number>(r.states);
                        T.forEach((v,i) => N[v]=neighbors[i]);
                        //Unspecified states
                        const nT = Array<number>(r.states).fill(0).map((v,i) => i);
                        T.forEach((v) => nT.splice(nT.indexOf(v), 1))
                        //Max sum of state counts for unspecified states
                        const maxSum = 8 - N.reduce((p,c) => p+c);
                        //Range of state counts
                        const Nr = Array<number>(maxSum + 1).fill(0).map((v,i) => i);
                        //All state counts which sum to max sum
                        const NS = cartesianProduct(...Array<number[]>(r.states - T.length).fill(Nr))
                            .filter((v,i) => v.reduce(((p,c) => p+c)) == maxSum);
                        //Loop through all possible unspecified neighbor counts
                        for (const Nn of NS) {
                            //Make a copy of the neighbors array which contains specified states
                            const Ni = [...N];
                            //Fill in unspecified states
                            nT.forEach((v,i) => Ni[v]=Nn[i]);
                            //Set value in rule array
                            const indx = this.ruleIndex(rl.in, Ni);
                            if (this.ruleData[indx] == rl.in)
                                this.ruleData[indx] = rl.out;
                        }
                    }
                } else {
                    //All with state <in> will change to state <out>
                    const j = this.ruleIndex(rl.in, []);
                    this.ruleData.fill(rl.out, j, j + this.nSubIndices);
                }
            }
        } else {
            console.error("error importing rule: argument is wrong type");
        }
        this.regenRuleTex();
        return true;
    }
    customRule() {
        const string = prompt("input some text:");
        if (string) {
            const states = minStates(string.length);
            const rule = new Uint8Array(ruleLength(this.numStates));
            rule.fill(0);
            for (let i = 0; i < string.length; i++) {
                rule[i] = string.charCodeAt(i) % this.numStates;
            }
            this.setRule(rule);
        }
    }
    clear() {
        this.flip = false;
        texDataBuffer.fill(0);
    }
    germinate() {
        // Clear with a single spot in the center
        this.clear();
        const i = (this.simSize * (this.simSize / 2))*3;
        texDataBuffer[i+3] = this.pen.state;
        texDataBuffer[i] = 255; // Let's make the starting cell RED
        this.texSetup();
    }
    resetSim() {
        this.clear();
        this.texSetup();
    }
    import() {
        document.querySelector<HTMLInputElement>("#_clipboard")?.select();
        document.querySelector<HTMLInputElement>("#_clipboard")?.focus();
        document.execCommand("insertText");
        document.execCommand("paste");
        this.importRule(document.querySelector<HTMLInputElement>("#_clipboard")?.value!);
        this._preset = "...from clipboard";
    }
    export() {
        document.querySelector<HTMLInputElement>("#_clipboard")!.value = this.exportRule(this.ruleData.slice(0, ruleLength(this.numStates)));
        document.querySelector<HTMLInputElement>("#_clipboard")?.select();
        document.querySelector<HTMLInputElement>("#_clipboard")?.focus();
        document.execCommand("copy");
    }
    step() {
        this.pause = true;
        this.doStep = true;
    }
    mutate() {
        const length = ruleLength(this.numStates);
        const nMutate = Math.ceil((length / 20) * this.mutateRate);
        for (let i = 0; i < nMutate; i++) {
            const j = Math.floor(Math.random() * length);
            this.ruleData[j] = Math.floor(Math.random() * this.numStates);
        }
        this.regenRuleTex();
    }
    onKey(e: KeyboardEvent) {
        const key = e.key.toLowerCase();
        this.keysPressed.add(key);
        switch(key) {
            case " ":
            case "space":
            case "spacebar":
                this.pause = !this.pause;
                break;
            case "s":
                this.step();
                break;
            case "r":
                this.newRule();
                break;
            case "g":
                this.germinate();
                break;
            case "f":
                randomizeDataBuffer(this._states);
                this.texSetup();
                break;
            case "m":
                this.mutate();
                break;
            case "c":
            case "backspace":
            case "delete":
                this.resetSim();
                break;
            case "arrowleft":
                this.cam.move.x = -3;
                break;
            case "arrowright":
                this.cam.move.x = 3;
                break;
            case "arrowup":
                this.cam.move.y = -3;
                break;
            case "arrowdown":
                this.cam.move.y = 3;
                break;
            default:
                if (!isNaN(parseInt(key))) {
                    const n = parseInt(key);
                    if (n >= 1 && n < this.numStates) {
                        this.pen.state = n;
                    }
                }
                break;
        }
    }
    onKeyUp(e: KeyboardEvent) {
        const key = e.key.toLowerCase();
        this.keysPressed.delete(key);
        switch(key) {
            case "arrowleft":
            case "arrowright":
                this.cam.move.x = 0;
                break;
            case "arrowup":
            case "arrowdown":
                this.cam.move.y = 0;
                break;
        }
    }
    texSetup() {
        //Framebuffer A
        this.fbA = this.fbA || this.gl.createFramebuffer()!;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbA);
        
        //Texture A
        this.texA = this.texA || this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texA);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA8UI, this.simSize, this.simSize,
            0, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_BYTE, texDataBuffer.subarray(0, this.simSize**2*4));
        this.texConfig(this.gl.REPEAT);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texA, 0);
        
        //////////////////////////////////////////////////////////

        //Framebuffer B
        this.fbB = this.fbB || this.gl.createFramebuffer()!;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbB);

        //Texture B
        this.texB = this.texB || this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texB);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA8UI, this.simSize, this.simSize,
            0, this.gl.RGBA_INTEGER, this.gl.UNSIGNED_BYTE, null);
        this.texConfig(this.gl.REPEAT);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texB, 0);
    
        //Pass new simulation size to shaders
        this.gl.useProgram(this.simProgram!);
        this.gl.uniform2fv(this.simUniforms.size.loc, [this.simSize, this.simSize]);
        this.gl.useProgram(this.colorProgram!);
        this.gl.uniform2fv(this.colorUniforms.simSize.loc, [this.simSize, this.simSize]);
        this.gl.useProgram(this.drawProgram!);
        this.gl.uniform2fv(this.drawUniforms.size.loc, [this.simSize, this.simSize]);
    }
    animateScene() {
        this.gl.viewport(0, 0, this.simSize, this.simSize);
    
        /* Simulation */
        if (!this.pause || this.doStep) {
            this.gl.useProgram(this.simProgram!);
            //Set simUniforms
            this.gl.activeTexture(this.gl.TEXTURE1);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.ruleTex!);
            this.gl.activeTexture(this.gl.TEXTURE2);
            this.gl.bindTexture(this.gl.TEXTURE_2D, this.binomialTex!);
            //Simulate N steps
            for (let i = 0; i < this.stepsPerFrame; i++) {
                this.flip = !this.flip;
                //Simulate and render to framebuffer
                this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, (this.flip ? this.fbB : this.fbA)!);
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.bindTexture(this.gl.TEXTURE_2D, (this.flip ? this.texA : this.texB)!);
                this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
                this.steps += 1;
                if (this.doStep) {
                    this.doStep = false;
                    break;
                }
            }
        }
    
        /* Drawing */
        this.flip = !this.flip;
        this.gl.useProgram(this.drawProgram!);
        this.drawUniforms.mouse.val[3] = this.pen.size;
        this.gl.uniform4fv(this.drawUniforms.mouse.loc, this.drawUniforms.mouse.val);
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, (this.flip ? this.fbB : this.fbA)!);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, (this.flip ? this.texA : this.texB)!);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    
        /* Colormapping */
        this.gl.viewport(0, 0, this.canvas.width, this.canvas.height);
        this.gl.useProgram(this.colorProgram!);
        //Colormap uniforms
        this.cam.x += this.cam.move.x;
        this.cam.y += this.cam.move.y;
        this.gl.uniform3fv(this.colorUniforms.cam.loc, [this.cam.x, this.cam.y, this.cam.zoom]);
        this.colorUniforms.renderSeP.val = this.renderStatesElsePaints;
        this.gl.uniform1i(this.colorUniforms.renderSeP.loc, this.colorUniforms.renderSeP.val ? 1 : 0);
        //Colormap and render to canvas
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, null);
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.bindTexture(this.gl.TEXTURE_2D, (this.flip ? this.texB : this.texA)!);
        this.gl.activeTexture(this.gl.TEXTURE1);
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.colorMapTex!);
        this.gl.drawArrays(this.gl.TRIANGLES, 0, 6);
    
        //Next frame
        this.frames += 1;
        if (Date.now() - this.lastFPSSample >= 1000) {
            this.fps = this.frames;
            this.lastFPSSample = Date.now();
        }
        window.requestAnimationFrame(this.animateScene.bind(this));
    }
    buildBinomial() {
        console.info("Building binomial coefficient tex...");
        const data = new Uint32Array(32 * 32);
        data.fill(0);
        for (let n = 0; n < 32; n++) {
            for (let k = 0; k < 32; k++) {
                const value = binomial(n, k);
                const index = k * 32 + n;
                data[index] = value;
            }
        }
        this.binomialTex = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.binomialTex);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R32UI, 32, 32, 0, this.gl.RED_INTEGER, this.gl.UNSIGNED_INT, data);
        this.texConfig();
    }
    compileShader(name: string, code: string, type: number): WebGLShader | null {
        const shader: WebGLShader | null = this.gl.createShader(type);
      
        if (shader) {
            this.gl.shaderSource(shader, code);
            this.gl.compileShader(shader);
            if (!this.gl.getShaderParameter(shader, this.gl.COMPILE_STATUS)) {
                console.error(`Error compiling ${type === this.gl.VERTEX_SHADER ? "vertex" : "fragment"} shader "${name}":`);
                console.log(this.gl.getShaderInfoLog(shader));
            }
        } else {
            console.error(`shader ${name} not compiled`);
        }
      
        return shader;
    }
    buildShaderProgram(shaderInfo: any) {
        const program = this.gl.createProgram();

        if (program) {
            for (const info of shaderInfo) {
                const shader = this.compileShader(info.name, info.code, info.type);
        
                if (shader) {
                    this.gl.attachShader(program, shader);
                }
            }
        
            this.gl.linkProgram(program)
            if (!this.gl.getProgramParameter(program, this.gl.LINK_STATUS)) {
                console.error("Error linking shader program:");
                console.info(this.gl.getProgramInfoLog(program));
            }
        }
    
        return program;
    }
    regenRuleTex() {
        //Rule texture
        this.gl.useProgram(this.simProgram!);
        this.ruleTex = this.ruleTex || this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.ruleTex);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R8UI, 1024, 1024, 0, this.gl.RED_INTEGER, this.gl.UNSIGNED_BYTE, this.ruleData);
        this.texConfig();
        
        this.gl.uniform1i(this.simUniforms.numStates.loc, this.numStates);
        this.gl.uniform1i(this.simUniforms.subindices.loc, this.nSubIndices);
    }
    set numStates(states: number) {
        if (states != this._states) {
            if (states >= 2 && states < 14) {
                this._states = states;
                if (this.pen.state >= this._states) {
                    this.pen.state = this._states - 1;
                }
                this.nSubIndices = ruleSubIndices(this._states);
                this.regenRuleTex();
            } else {
                states = this._states;
            }
        }
    }
    get numStates() {
        return this._states;
    }
    setRule(rule: Array<number> | Uint8Array) {
        //Check if rule is valid
        if (!rule || !this.nStateMap.has(rule.length)) {
            console.error("invalid rule:", rule);
            return;
        }
        this.numStates = this.nStateMap.get(rule.length) || 2;
        this.ruleData.set(rule);
        this.regenRuleTex();
    }
    webGlSetup(shaders: Record<string, string>) {
        //Create vertices for quad
        const vertexArray = new Float32Array([
            -1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
        ]);
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexArray, this.gl.STATIC_DRAW);
    
        /* --- Simulator Shader Program --- */
        //Build simulator shader program
        this.simProgram = this.buildShaderProgram([
            {type: this.gl.FRAGMENT_SHADER, name: "simulate", code: shaders["simulate"]},
            {type: this.gl.VERTEX_SHADER, name: "vertex", code: shaders["vertex"]}
        ])!;
    
        //Simulation uniforms
        this.gl.useProgram(this.simProgram);
        this.buildBinomial();
        this.simUniforms = {
            size:       {loc: this.gl.getUniformLocation(this.simProgram, "uSize")!},
            states:     {loc: this.gl.getUniformLocation(this.simProgram, "uStates")!},
            rule:       {loc: this.gl.getUniformLocation(this.simProgram, "uRule")!},
            binomial:   {loc: this.gl.getUniformLocation(this.simProgram, "uBinomial")!},
            numStates:  {loc: this.gl.getUniformLocation(this.simProgram, "uNumStates")!},
            subindices: {loc: this.gl.getUniformLocation(this.simProgram, "uSubIndices")!}
        };

        //Vertex position attribute
        let aVertexPosition = this.gl.getAttribLocation(this.simProgram, "aVertexPosition");
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(aVertexPosition);
    
        //Rule texture
        this.setRule([
            0,0,0,1,0,0,0,0,0,
            0,0,1,1,0,0,0,0,0]);
    
        //Initialize uniforms
        this.gl.uniform1i(this.simUniforms.states.loc, 0);
        this.gl.uniform1i(this.simUniforms.rule.loc, 1);
        this.gl.uniform1i(this.simUniforms.binomial.loc, 2);

    
        /* --- Colormap Shader Program --- */
        //Build program
        this.colorProgram = this.buildShaderProgram([
            {type: this.gl.FRAGMENT_SHADER, name: "colormap", code: shaders["colormap"]},
            {type: this.gl.VERTEX_SHADER, name: "vertex", code: shaders["vertex"]}
        ])!;
        this.gl.useProgram(this.colorProgram);

        //Color map
        this.colorMapTex = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.colorMapTex);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, 14, 1, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.colorMap);
        this.texConfig();
    
        //Uniforms
        this.colorUniforms = {
            states:    {loc: this.gl.getUniformLocation(this.colorProgram, "uStates")},
            colormap:   {loc: this.gl.getUniformLocation(this.colorProgram, "uColorMap")},
            cam:        {loc: this.gl.getUniformLocation(this.colorProgram, "uCam")},
            screen:     {loc: this.gl.getUniformLocation(this.colorProgram, "uScreen")},
            simSize:    {loc: this.gl.getUniformLocation(this.colorProgram, "uSimSize")},
            // mouse:      {loc: this.gl.getUniformLocation(this.colorProgram, "uMouse"), val: [0, 0, -1, 50]},
            renderSeP:  {loc: this.gl.getUniformLocation(this.colorProgram, "uRenderSeP"), val: 1},
        };
    
        //Vertex position attribute
        aVertexPosition = this.gl.getAttribLocation(this.colorProgram, "aVertexPosition");
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(aVertexPosition);
    
        //Set these uniforms once
        this.gl.uniform1i(this.colorUniforms.states.loc, 0);
        this.gl.uniform1i(this.colorUniforms.colormap.loc, 1);
        this.gl.uniform2fv(this.colorUniforms.screen.loc, [this.canvas.width, this.canvas.height]);
    
        /* --- Draw Shader Program --- */
        //Build shader program
        this.drawProgram = this.buildShaderProgram([
            {type: this.gl.FRAGMENT_SHADER, name: "drawing", code: shaders["drawing"]},
            {type: this.gl.VERTEX_SHADER, name: "vertex", code: shaders["vertex"]}
        ])!;
        this.gl.useProgram(this.drawProgram);
    
        //Uniforms
        this.drawUniforms = {
            size:       {loc: this.gl.getUniformLocation(this.drawProgram, "uSize")},
            states:    {loc: this.gl.getUniformLocation(this.drawProgram, "uStates")},
            mouse:      {loc: this.gl.getUniformLocation(this.drawProgram, "uMouse"), val: [0, 0, -1, 50]},
        };

        
    
        //Vertex position attribute
        aVertexPosition = this.gl.getAttribLocation(this.drawProgram, "aVertexPosition");
        this.gl.activeTexture(this.gl.TEXTURE0);
        this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);
        this.gl.enableVertexAttribArray(aVertexPosition);
    
        //Set these uniforms once
        this.gl.uniform1i(this.drawUniforms.states.loc, 0);
    }
    texConfig(wrap: number = this.gl.CLAMP_TO_EDGE) {
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, wrap);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, wrap);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAX_LEVEL, 0);
    }
    resize() {
        this.gl.useProgram(this.colorProgram!);
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.uniform2fv(this.colorUniforms.screen.loc, [this.canvas.width, this.canvas.height]);
    }
}