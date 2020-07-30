'use strict';

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
var resources = {};
var resourcesRemaining = 0;
var flip = false;
var shaderProgram, uniforms, aVertexPosition, vertexBuffer, texB, texA, ruleTex, fbA, fbB, gui, curRule, touchID;
const blending = gl.NEAREST;
const edgeBehavior = gl.REPEAT;
const parameters = {
    clear: clear,
    step: step,
    newRule: setRule,
    customRule: () => {setRule(
        prompt("Input rule string",
               "0,0,0,1,0,0,0,0,0,0,0,1,1,0,0,0,0,0")
        .split(",").map(
            (v) => { return parseInt(v); }
        )
    )},
    mutate: mutate,
    germinate: () => {
        // Clear with a single spot in the center
        clear();
        let data = new Uint8Array(canvas.width * canvas.height * 3);
        let i = (canvas.width * (canvas.height / 2)) * 3;
        data[i] = 1;
        webGlSetup(data)
    },
    fillRandom: () => {
        // Clear with a single spot in the center
        clear();
        let data = new Uint8Array(canvas.width * canvas.height * 3);
        for (let i = 0; i < data.length / 3; i++) {
            data[i * 3] = Math.round(Math.random());
        }
        webGlSetup(data)
    },
    penSize: 50.0,
    pause: false,
    scale: 2,
    preset: "gol"
};
const presets = {
    gol: [0, 0, 0, 1, 0, 0, 0, 0, 0,
          0, 0, 1, 1, 0, 0, 0, 0, 0],
    worms:       [0,1,0,0,0,1,0,1,1,0,0,0,0,1,1,1,1,1],
    maze:        [1,1,0,1,0,0,0,0,1,1,0,1,1,1,0,1,1,0],
    boxes:       [1,1,0,1,0,0,0,1,1,0,1,1,1,0,1,0,0,1],
    hilbert:     [0,1,0,0,0,0,0,0,0,0,1,1,1,1,1,1,1,1],
    snakes:      [0,1,1,1,1,1,1,1,1,1,1,0,0,1,1,1,0,0],
    stars:       [0,0,1,1,0,0,1,1,0,0,0,1,1,0,1,1,1,1],
    nicetiles:   [1,1,1,0,0,0,0,0,1,0,1,1,1,0,1,0,0,1],
    tricircuit:  [1,1,1,0,0,0,0,0,1,0,1,1,1,1,1,0,0,1],
    sierpinski1: [0,1,0,0,0,0,0,0,0,0,1,1,0,1,1,1,1,1],
    machine:     [0,1,0,0,0,0,0,0,1,1,1,1,1,0,0,0,1,0],
    tearing:     [0,0,0,0,1,1,1,1,1,0,0,0,1,0,1,1,0,1],
    complexmaze: [0,0,0,1,0,0,0,0,0,0,0,1,1,1,1,0,1,0],
    gooeyzebra:  [1,1,1,0,1,1,0,1,1,1,1,1,1,0,0,0,0,0],
    octofractal: [1,0,0,0,0,1,0,1,1,1,1,1,1,0,0,0,1,0],
    sierpinski2: [1,1,0,0,0,0,0,0,1,1,0,1,1,1,0,1,1,0]
};

function mouseHandler(e) {
    uniforms.mouse.val[0] = ((Math.floor(e.pageX)) / window.innerWidth);
    uniforms.mouse.val[1] = ((Math.floor(e.pageY)) / window.innerHeight);
}

function clickOn(e) {
    uniforms.mouse.val[2] = e.originalEvent.button;
}

function clickOff(e) {
    uniforms.mouse.val[2] = -1;
}

function onPenSize() {
    uniforms.mouse.val[3] = parameters.penSize;
}

//Render to the screen
function animateScene() {
    gl.viewport(0, 0, canvas.width, canvas.height);

    //Set uniforms
    uniforms.time.val += 0.01;
    gl.uniform1f(uniforms.time.loc, uniforms.time.val);
    gl.uniform1f(uniforms.width.loc, canvas.width);
    gl.uniform1f(uniforms.height.loc, canvas.height);
    gl.uniform1i(uniforms.sampler.loc, 0);
    gl.uniform1i(uniforms.rule.loc, 1);
    gl.uniform4fv(uniforms.mouse.loc, uniforms.mouse.val);

    //Render to framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, flip ? fbB : fbA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, flip ? texA : texB);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, ruleTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //Flip framebuffers
    flip = !flip;
    if (!parameters.pause) window.requestAnimationFrame(animateScene);
}

//New rule
function setRule(rule) {
    //Check if rule is valid
    if (rule && rule.length != 18) {
        alert("Invalid rule!");
        return;
    }
    //Rule texture
    ruleTex = ruleTex || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ruleTex);
    let ruleString = "";
    if (!rule) {
        rule = [];
        for (let i = 0; i < 18; i++) {
            rule.push(Math.round(Math.random()));
        }
    }
    for (let r of rule) {
        ruleString += r + ",";
    }
    curRule = rule;
    console.log(`rule: [${ruleString}]`);
    $("#info").text(`rule: [${ruleString}]`);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 18, 1, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, new Uint8Array(rule));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
}

//Setup for WebGL stuff
function webGlSetup(data) {
    //Render textures and framebuffers
    texA = texA || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 
        canvas.width,
        canvas.height,
        0, gl.RGB, gl.UNSIGNED_BYTE, data || null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
    fbA = fbA || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
    texB = texB || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 
        canvas.width,
        canvas.height,
        0, gl.RGB, gl.UNSIGNED_BYTE, data || null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
    fbB = fbB || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);

    //Build shader program
    if (!shaderProgram) {
        const shaderSet = [
            {type: gl.FRAGMENT_SHADER, name: "frag"},
            {type: gl.VERTEX_SHADER, name: "vertex"}
        ];
        shaderProgram = buildShaderProgram(shaderSet);
    
        //Create vertices for quad
        var vertexArray = new Float32Array([
            -1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
        ]);
        vertexBuffer = vertexBuffer || gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
    
        //Uniforms
        uniforms = {
            time: {loc: gl.getUniformLocation(shaderProgram, "uTime"), val: 0},
            width: {loc: gl.getUniformLocation(shaderProgram, "uWidth")},
            height: {loc: gl.getUniformLocation(shaderProgram, "uHeight")},
            sampler: {loc: gl.getUniformLocation(shaderProgram, "uSampler")},
            rule: {loc: gl.getUniformLocation(shaderProgram, "uRule")},
            mouse: {loc: gl.getUniformLocation(shaderProgram, "uMouse"), val: [0, 0, -1, 50]}
        };
    
        //Attributes
        aVertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition");
        gl.activeTexture(gl.TEXTURE0);
        gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexPosition);
        gl.useProgram(shaderProgram);

        //Rule texture
        setRule(presets[parameters.preset]);
    }
}

//Main function
function main() {
    //Check if WebGL2 is available
    if (gl == null) {
        alert("Unable to initialize WebGL 2 context");
        return;
    }

    parameters.fillRandom();

    //Handlers
    $(canvas).on("mousemove", mouseHandler);
    $(canvas).on("mousedown", clickOn);
    $(canvas).on("mouseup", clickOff);
    $(window).on("resize", resize);

    //Mouse emulation with touch
    $(canvas).on("touchstart", (e) => {
        touchID = e.originalEvent.touches.item(0).identifier;
        clickOn({originalEvent: {button: 0}});
    });
    $(canvas).on("touchend", (e) => {
        clickOff();
    });
    $(canvas).on("touchmove", (e) => {
        let touch = e.originalEvent.touches.item(0);
        mouseHandler({pageX: touch.pageX, pageY: touch.pageY});
        console.log(e);
    });

    animateScene();
}

//Returns a handler for this resource for onload or similar
function mapResource(name) {
    resourcesRemaining += 1;
    return (data) => {
        resources[name] = data;
        resourcesRemaining -= 1;
        console.log(`${name} loaded, ${resourcesRemaining} remain`);
        if (resourcesRemaining == 0)
            main();
    };
}

//Compile a shader from given code and gl shader type
function compileShader(code, type) {
    let shader = gl.createShader(type);
  
    gl.shaderSource(shader, code);
    gl.compileShader(shader);
  
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.log(`Error compiling ${type === gl.VERTEX_SHADER ? "vertex" : "fragment"} shader:`);
        console.log(gl.getShaderInfoLog(shader));
    }
    return shader;
}

//Build the shader program from given shader informations
function buildShaderProgram(shaderInfo) {
    let program = gl.createProgram();

    shaderInfo.forEach(function(sInfo) {
        let shader = compileShader(resources[sInfo.name], sInfo.type);

        if (shader) {
            gl.attachShader(program, shader);
        }
    });

    gl.linkProgram(program)

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Error linking shader program:");
        console.info(gl.getProgramInfoLog(program));
    }

    return program;
}

//Restart
function clear() {
    flip = false;
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.clearColor(0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.clearColor(0, 0, 0, 1.0);
    gl.clear(gl.COLOR_BUFFER_BIT);
}

//Resize
function resize(e) {
    clear();
    canvas.width = window.innerWidth / parameters.scale;
    canvas.height = window.innerHeight / parameters.scale;
    webGlSetup();
}

//Single step
function step() {
    parameters.pause = true;
    animateScene();
    animateScene();
}

//Mutate current rule
function mutate() {
    let mRule = [...curRule];
    let i = Math.floor(Math.random() * mRule.length);
    mRule[i] = mRule[i] == 0 ? 1 : 0;
    setRule(mRule);
}

//GUI
gui = new dat.GUI();
gui.width = 350;
gui.add(parameters, "penSize", 1.0, 200.0)
    .onChange(onPenSize)
    .name("pen size");
gui.add(parameters, "scale", 1, 8)
    .onChange(resize).step(1);
gui.add(parameters, "pause")
    .listen()
    .onChange(() => {if (!parameters.pause) animateScene();});
gui.add(parameters, "step");
gui.add(parameters, "preset", Object.keys(presets))
    .onChange(() => setRule(presets[parameters.preset]));
gui.add(parameters, "newRule").name("random rule");
gui.add(parameters, "customRule").name("custom rule");
gui.add(parameters, "mutate").name("mutate rule");
gui.add(parameters, "clear");
gui.add(parameters, "germinate").name("germinate from center");
gui.add(parameters, "fillRandom").name("fill randomly");

//Load resources
canvas.width = window.innerWidth / parameters.scale;
canvas.height = window.innerHeight / parameters.scale;
$.get("vertex.glsl", mapResource("vertex"));
$.get("frag.glsl", mapResource("frag"));