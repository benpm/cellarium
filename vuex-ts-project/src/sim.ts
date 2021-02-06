import * as lz4 from "./lz4";

export interface SimConfig {
    presets?: Record<string, string>;
    canvas: HTMLCanvasElement;
    shaders: Record<string, string>;
}

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

export class Sim {
    canvas: HTMLCanvasElement;                  // Canvas being drawn to
    gl: WebGL2RenderingContext;                 // WebGL2 rendering context, passed into constructor
    simProgram?: WebGLProgram;                  // WebGL program for simulating cellular automata
    colorProgram?: WebGLProgram;                // WebGL program for drawing CA state in correct colors
    drawProgram?: WebGLProgram;                 // WebGL program for drawing CA state in correct colors
    simUniforms: any;                           // Uniforms for simProgram
    colorUniforms: any;                         // Uniforms for colorProgram
    drawUniforms: any;                          // Uniforms for colorProgram
    simSize = 1024;                             // Size of simulation texture in pixels
    ruleData: Uint8Array = new Uint8Array(this.simSize * this.simSize); // Raw bytes of rule data
    ruleTex?: WebGLTexture;                     // WebGL texture containing rule data
    colorMapTex?: WebGLTexture;                 // State to color map texture
    binomialTex?: WebGLTexture;                 // State to binomial map texture
    colorMap = new Uint8Array([                 // Mapping from state to color
        /* 0  */ 0, 0, 0,
        /* 1  */ 255, 255, 255,
        /* 2  */ 255, 50, 50,
        /* 3  */ 50, 255, 50,
        /* 4  */ 50, 50, 255,
        /* 5  */ 255, 255, 50,
        /* 6  */ 50, 255, 255,
        /* 7  */ 255, 50, 255,
        /* 8  */ 255, 50, 175,
        /* 9  */ 50, 255, 175,
        /* 10 */ 175, 50, 255,
        /* 11 */ 255, 255, 175,
        /* 12 */ 175, 255, 50,
        /* 13 */ 50, 175, 255
    ]);
    nStateMap: Map<number, number> = new Map(); // Mapping from rule length to number of states
    _states = 2;                                // Number of cellular automata states
    nSubIndices: number = ruleSubIndices(this._states); // Number of subindices in current rule
    pen = {                                     // Pen properties
        state: 1,
        size: 50
    };
    presets: Record<string, string>;            // Rule presets as strings
    preset = "game of life";                    // Current rule preset selection
    doStep = false;                             // Indicates that a simulation step should be performed
    pause = false;                              // Simulation is paused
    stepsPerFrame = 1;                          // Simulation steps per rendered frame
    flip = false;                               // Indicates framebuffer flip
    fbA?: WebGLFramebuffer;                     // First framebuffer
    fbB?: WebGLFramebuffer;                     // Second framebuffer
    texA?: WebGLTexture;
    texB?: WebGLTexture;
    steps = 0;                                  // Simulation steps so far
    frames = 0;                                 // Rendered frames so far
    lastFPSSample = 0;                          // Millisecond timestap of last FPS sample
    cam = {
        x: 0,
        y: 0,
        zoom: 1,
        panstartcam: {x:0, y:0},
        panstartmouse: {x:0, y:0},
        panning: false,
        move: {x:0, y:0}
    };
    
    constructor(config: SimConfig) {
        this.canvas = config.canvas;
        this.gl = this.canvas?.getContext("webgl2")!;
        this.presets = config.presets || {};
        this.webGlSetup(config);
        window.requestAnimationFrame(this.animateScene.bind(this));
    }

    mouseHandler(e: MouseEvent) {
        this.drawUniforms.mouse.val[0] = (Math.floor(fmod((
            this.cam.x + Math.floor(e.pageX - 2) / this.cam.zoom), this.simSize)) / this.simSize);
        this.drawUniforms.mouse.val[1] = (Math.floor(fmod((
            this.cam.y + Math.floor(e.pageY - 2) / this.cam.zoom), this.simSize)) / this.simSize);
        this.colorUniforms.mouse.val[0] = Math.floor(e.pageX);
        this.colorUniforms.mouse.val[1] = Math.floor(e.pageY);
        if (this.cam.panning) {
            this.cam.x = fmod(this.cam.panstartcam.x + (this.cam.panstartmouse.x - e.pageX)
                / this.cam.zoom, this.simSize * 2);
            this.cam.y = fmod(this.cam.panstartcam.y + (this.cam.panstartmouse.y - e.pageY)
                / this.cam.zoom, this.simSize * 2);
        }
    
        this.gl.useProgram(this.drawProgram!);
        this.gl.uniform4fv(this.drawUniforms.mouse.loc, this.drawUniforms.mouse.val);
    
        this.gl.useProgram(this.colorProgram!);
        this.colorUniforms.mouse.val[2] = this.pen.state;
        this.colorUniforms.mouse.val[3] = this.drawUniforms.mouse.val[3];
        this.gl.uniform4fv(this.colorUniforms.mouse.loc, this.colorUniforms.mouse.val);
    }
    clickOn(e: MouseEvent) {
        switch (e.button) {
            case 0: // Left click
                this.drawUniforms.mouse.val[2] = this.pen.state;
                break;
            case 1: // Middle click
                this.cam.panning = true;
                this.cam.panstartmouse.x = e.pageX;
                this.cam.panstartmouse.y = e.pageY;
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
    
    onPenSize() {
        this.drawUniforms.mouse.val[3] = this.pen.size;
    }
    
    onScrollWheel(e: WheelEvent) {
        const z = this.cam.zoom;
        this.cam.zoom = Math.max(Math.min(this.cam.zoom + (e.deltaY < 0 ? 1 : -1), 32), 1);
        this.cam.x += this.canvas.width / (2 * z) - this.canvas.width / (2 * this.cam.zoom);
        this.cam.y += this.canvas.height / (2 * z) - this.canvas.height / (2 * this.cam.zoom);
    }
    randomRule() {
        const length = ruleLength(this.states);
        const rule = new Uint8Array(length);
        const zeroChance = Math.max(1 - (1 / Math.pow(this.states, 0.50)), 0.50);
        for (let i = 0; i < length; i++) {
            if (Math.random() < zeroChance) {
                rule[i] = 0;
            } else {
                rule[i] = Math.floor(Math.random() * this.states);
            }
        }
        return rule;
    }

    newRule() {
        this.setRule(this.randomRule());
    }

    //Exports rule to unicode string
    exportRule(rule: Uint8Array) {
        console.info(`exporting rule length ${rule.length}`);
        //Treat each value in the rule as a 4-bit slice of a 16-bit number
        let values = [];
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

    //Imports rule from unicode string directly into current rule buffer, setting rule to given
    importRule(string: string) {
        let compbytes = new Uint8Array(string.length);
        compbytes = compbytes.map((_, i) => { return pcharMap[string.charCodeAt(i)]});
        const x = lz4.decompress(compbytes);
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
        this.states = minStates(z)!;
        this.regenRuleTex();
    }

    customRule() {
        const string = prompt("input some text:");
        if (string) {
            const states = minStates(string.length);
            const rule = new Uint8Array(ruleLength(this.states));
            rule.fill(0);
            for (let i = 0; i < string.length; i++) {
                rule[i] = string.charCodeAt(i) % this.states;
            }
            this.setRule(rule);
        }
    }

    clear() {
        this.flip = false;
        if (this.fbA && this.fbB) {
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbA);
            this.gl.clearColor(0, 0, 0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
            this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbB);
            this.gl.clearColor(0, 0, 0, 1.0);
            this.gl.clear(this.gl.COLOR_BUFFER_BIT);
        }
    }

    germinate() {
        // Clear with a single spot in the center
        this.clear();
        const data = new Uint8Array(this.simSize * this.simSize);
        const i = (this.simSize * (this.simSize / 2));
        data[i] = this.pen.state;
        this.texSetup(data);
    }
    fillRandom() {
        // Clear with a single spot in the center
        this.clear();
        const data = new Uint8Array(this.simSize * this.simSize);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.floor(Math.random() * this.states);
        }
        this.texSetup(data);
    }
    import() {
        document.querySelector<HTMLInputElement>("#ruledata")?.select();
        document.execCommand("paste");
        this.importRule(document.querySelector<HTMLInputElement>("#ruledata")?.value!);
    }
    export() {
        document.querySelector<HTMLInputElement>("#ruledata")!.value = this.exportRule(this.ruleData.slice(0, ruleLength(this.states)));
        document.querySelector<HTMLInputElement>("#ruledata")?.select();
        document.execCommand("copy");
    }
    //Single step
    step() {
        this.pause = true;
        this.doStep = true;
    }

    mutate() {
        const length = ruleLength(this.states);
        const nMutate = Math.ceil(length / 20);
        for (let i = 0; i < nMutate; i++) {
            const j = Math.floor(Math.random() * length);
            this.ruleData[j] = Math.floor(Math.random() * this.states);
        }
        this.regenRuleTex();
    }
    
    onKey(e: KeyboardEvent) {
        const key = e.key;
        switch(key) {
            case " ":
            case "Space":
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
                this.fillRandom();
                break;
            case "m":
                this.mutate();
                break;
            case "c":
            case "backspace":
            case "delete":
                this.clear();
                break;
            case "ArrowLeft":
                this.cam.move.x = -3;
                break;
            case "ArrowRight":
                this.cam.move.x = 3;
                break;
            case "ArrowUp":
                this.cam.move.y = -3;
                break;
            case "ArrowDown":
                this.cam.move.y = 3;
                break;
            default:
                if (!isNaN(parseInt(key))) {
                    const n = parseInt(key);
                    if (n >= 1 && n < this.states) {
                        this.pen.state = n;
                    }
                }
                break;
        }
    }
    
    onKeyUp(e: KeyboardEvent) {
        const key = e.key;
        switch(key) {
            case "ArrowLeft":
            case "ArrowRight":
                this.cam.move.x = 0;
                break;
            case "ArrowUp":
            case "ArrowDown":
                this.cam.move.y = 0;
                break;
        }
    }
    
    texSetup(data: ArrayBufferView) {
        //Texture A
        this.texA = this.texA || this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texA);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R8, this.simSize, this.simSize, 0, this.gl.RED, this.gl.UNSIGNED_BYTE, data || null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        //Framebuffer A
        this.fbA = this.fbA || this.gl.createFramebuffer()!;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbA);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texA, 0);
        //Texture B
        this.texB = this.texB || this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.texB);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.R8, this.simSize, this.simSize, 0, this.gl.RED, this.gl.UNSIGNED_BYTE, data || null);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.REPEAT);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
        //Framebuffer B
        this.fbB = this.fbB || this.gl.createFramebuffer()!;
        this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, this.fbB);
        this.gl.framebufferTexture2D(this.gl.FRAMEBUFFER, this.gl.COLOR_ATTACHMENT0, this.gl.TEXTURE_2D, this.texB, 0);
    
        //Pass new simulation size to shaders
        this.gl.useProgram(this.simProgram!);
        this.gl.uniform2fv(this.simUniforms.size.loc, [this.simSize, this.simSize]);
        this.gl.useProgram(this.colorProgram!);
        this.gl.uniform2fv(this.colorUniforms.this.simSize.loc, [this.simSize, this.simSize]);
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
        this.colorUniforms.mouse.val[2] = this.pen.state;
        this.colorUniforms.mouse.val[3] = this.drawUniforms.mouse.val[3];
        this.gl.uniform4fv(this.colorUniforms.mouse.loc, this.colorUniforms.mouse.val);
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
            this.lastFPSSample = Date.now();
            this.frames = 0;
            this.steps = 0;
        }
        window.requestAnimationFrame(this.animateScene.bind(this));
    }

    buildBinomial() {
        console.info("Building binomial coefficient tex...");
        const data = new Uint8Array(32 * 32 * 4);
        data.fill(0);
        for (let n = 0; n < 32; n++) {
            for (let k = 0; k < 32; k++) {
                const value = binomial(n, k);
                const index = (k * 32 + n) * 4;
                //Pack result into the four RGBA bytes
                data[index + 0] = value & 0xFF;
                data[index + 1] = (value >> 8) & 0xFF;
                data[index + 2] = (value >> 16) & 0xFF;
                data[index + 3] = (value >> 24) & 0xFF;
            }
        }
        this.binomialTex = this.gl.createTexture()!;
        this.gl.bindTexture(this.gl.TEXTURE_2D, this.binomialTex);
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGBA, 32, 32, 0, this.gl.RGBA, this.gl.UNSIGNED_BYTE, data);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
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
        this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.LUMINANCE, 1024, 1024, 0, this.gl.LUMINANCE, this.gl.UNSIGNED_BYTE, this.ruleData);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
        this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
        
        this.gl.uniform1i(this.simUniforms.states.loc, this.states);
        this.gl.uniform1i(this.simUniforms.subindices.loc, this.nSubIndices);
    }

    set states(states: number) {
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

    setRule(rule: Array<number> | Uint8Array) {
        //Check if rule is valid
        if (!rule || this.nStateMap.has(rule.length)) {
            console.error("invalid rule:", rule);
            return;
        }
        this.states = this.nStateMap.get(rule.length) || 2;
        this.ruleData.set(rule);
        this.regenRuleTex();
    }
    
    webGlSetup(config: SimConfig) {
        //Create vertices for quad
        const vertexArray = new Float32Array([
            -1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
        ]);
        const vertexBuffer = this.gl.createBuffer();
        this.gl.bindBuffer(this.gl.ARRAY_BUFFER, vertexBuffer);
        this.gl.bufferData(this.gl.ARRAY_BUFFER, vertexArray, this.gl.STATIC_DRAW);
    
        //Build simulator shader program
        this.simProgram = this.buildShaderProgram([
            {type: this.gl.FRAGMENT_SHADER, name: "simulate", code: config.shaders["simulate"]},
            {type: this.gl.VERTEX_SHADER, name: "vertex", code: config.shaders["vertex"]}
        ])!;
    
        //Simulation uniforms
        if (this.simProgram) {
            this.gl.useProgram(this.simProgram);
            this.buildBinomial();
            this.simUniforms = {
                size:       {loc: this.gl.getUniformLocation(this.simProgram, "uSize")},
                sampler:    {loc: this.gl.getUniformLocation(this.simProgram, "uSampler")},
                binomial:   {loc: this.gl.getUniformLocation(this.simProgram, "uBinomial")},
                rule:       {loc: this.gl.getUniformLocation(this.simProgram, "uRule")},
                states:     {loc: this.gl.getUniformLocation(this.simProgram, "uStates")},
                subindices: {loc: this.gl.getUniformLocation(this.simProgram, "uSubIndices")}
            };
    
            //Vertex position attribute
            let aVertexPosition = this.gl.getAttribLocation(this.simProgram, "aVertexPosition");
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(aVertexPosition);
        
            //Rule texture
            this.setRule([0,0,0,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0]);
        
            //Initialize uniforms
            this.gl.uniform1i(this.simUniforms.sampler.loc, 0);
            this.gl.uniform1i(this.simUniforms.rule.loc, 1);
            this.gl.uniform1i(this.simUniforms.binomial.loc, 2);
        
            /* COLORMAP SHADER PROGRAM */
            //Build program
            this.colorProgram = this.buildShaderProgram([
                {type: this.gl.FRAGMENT_SHADER, name: "colormap", code: config.shaders["colormap"]},
                {type: this.gl.VERTEX_SHADER, name: "vertex", code: config.shaders["vertex"]}
            ])!;
            if (this.colorProgram) {
                this.gl.useProgram(this.colorProgram);
        
                //Color map
                this.colorMapTex = this.gl.createTexture()!;
                this.gl.bindTexture(this.gl.TEXTURE_2D, this.colorMapTex);
                this.gl.texImage2D(this.gl.TEXTURE_2D, 0, this.gl.RGB, 14, 1, 0, this.gl.RGB, this.gl.UNSIGNED_BYTE, this.colorMap);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_S, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_WRAP_T, this.gl.CLAMP_TO_EDGE);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MIN_FILTER, this.gl.NEAREST);
                this.gl.texParameteri(this.gl.TEXTURE_2D, this.gl.TEXTURE_MAG_FILTER, this.gl.NEAREST);
            
                //Uniforms
                this.colorUniforms = {
                    sampler:    {loc: this.gl.getUniformLocation(this.colorProgram, "uSampler")},
                    colormap:   {loc: this.gl.getUniformLocation(this.colorProgram, "uColorMap")},
                    cam:        {loc: this.gl.getUniformLocation(this.colorProgram, "uCam")},
                    screen:     {loc: this.gl.getUniformLocation(this.colorProgram, "uScreen")},
                    simSize:    {loc: this.gl.getUniformLocation(this.colorProgram, "uSimSize")},
                    mouse:      {loc: this.gl.getUniformLocation(this.colorProgram, "uMouse"), val: [0, 0, -1, 50]},
                };
            
                //Vertex position attribute
                aVertexPosition = this.gl.getAttribLocation(this.colorProgram, "aVertexPosition");
                this.gl.activeTexture(this.gl.TEXTURE0);
                this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);
                this.gl.enableVertexAttribArray(aVertexPosition);
            
                //Set these uniforms once
                this.gl.uniform1i(this.colorUniforms.sampler.loc, 0);
                this.gl.uniform1i(this.colorUniforms.colormap.loc, 1);
                this.gl.uniform2fv(this.colorUniforms.screen.loc, [this.canvas.width, this.canvas.height]);
            }
        
            //Build simulator shader program
            this.drawProgram = this.buildShaderProgram([
                {type: this.gl.FRAGMENT_SHADER, name: "drawing", code: config.shaders["drawing"]},
                {type: this.gl.VERTEX_SHADER, name: "vertex", code: config.shaders["vertex"]}
            ])!;
            this.gl.useProgram(this.drawProgram);
        
            //Uniforms
            this.drawUniforms = {
                size:       {loc: this.gl.getUniformLocation(this.drawProgram, "uSize")},
                sampler:    {loc: this.gl.getUniformLocation(this.drawProgram, "uSampler")},
                mouse:      {loc: this.gl.getUniformLocation(this.drawProgram, "uMouse"), val: [0, 0, -1, 50]},
            };
        
            //Vertex position attribute
            aVertexPosition = this.gl.getAttribLocation(this.drawProgram, "aVertexPosition");
            this.gl.activeTexture(this.gl.TEXTURE0);
            this.gl.vertexAttribPointer(aVertexPosition, 2, this.gl.FLOAT, false, 0, 0);
            this.gl.enableVertexAttribArray(aVertexPosition);
        
            //Set these uniforms once
            this.gl.uniform1i(this.drawUniforms.sampler.loc, 0);
        }
    }

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.gl.uniform2fv(this.colorUniforms.screen.loc, [this.canvas.width, this.canvas.height]);
    }
}