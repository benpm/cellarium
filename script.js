'use strict';

const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
var resources = {};
var resourcesRemaining = 0;
var flip = false;
var shaderProgram, uniforms, aVertexPosition, vertexBuffer, dataTex, targetTex, fbA, fbB, gui;
const rules = new Int32Array([
    0, 0, 0, 1, 0, 0, 0, 0,
    0, 0, 1, 1, 0, 0, 0, 0
]);
const blending = gl.LINEAR;
const edgeBehavior = gl.REPEAT;
const parameters = {
    clear: () => {restart(null, false);},
    penSize: 50.0,
    pause: false
};

function mouseHandler(e) {
    uniforms.mouse.val[0] = (e.pageX / window.innerWidth);
    uniforms.mouse.val[1] = (e.pageY / window.innerHeight);
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
    gl.uniform4fv(uniforms.mouse.loc, uniforms.mouse.val);
    gl.uniform1f(uniforms.param1.loc, uniforms.param1.val);

    //Render to framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, flip ? fbB : fbA);
    gl.bindTexture(gl.TEXTURE_2D, flip ? targetTex : dataTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //Render to screen
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.bindTexture(gl.TEXTURE_2D, targetTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //Flip framebuffers
    flip = !flip;
    if (!parameters.pause) window.requestAnimationFrame(animateScene);
}

//Setup for WebGL stuff
function webGlSetup() {
    //Initial texture from image
    dataTex = dataTex || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, dataTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height,
        0, gl.RGBA, gl.UNSIGNED_BYTE, document.getElementById("imgCanvas"));
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);

    //First framebuffer
    fbB = fbB || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, dataTex, 0);
    
    //Destination texture
    targetTex = targetTex || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, targetTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, canvas.width, canvas.height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);

    //Second framebuffer
    fbA = fbA || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, targetTex, 0);

    //Shaders
    const shaderSet = [
        {type: gl.FRAGMENT_SHADER, name: "frag"},
        {type: gl.VERTEX_SHADER, name: "vertex"}
    ];
    shaderProgram = buildShaderProgram(shaderSet);

    //Create vertices for quad
    var vertexArray = vertexArray || new Float32Array([
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
        param1: {loc: gl.getUniformLocation(shaderProgram, "uParam1"), val: parameters.param1},
        mouse: {loc: gl.getUniformLocation(shaderProgram, "uMouse"), val: [0, 0, -1, 50]}
    };

    //Attributes
    aVertexPosition = gl.getAttribLocation(shaderProgram, "aVertexPosition");
    gl.activeTexture(gl.TEXTURE0);
    gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
    gl.enableVertexAttribArray(aVertexPosition);
    gl.useProgram(shaderProgram);
}

//Main function
function main() {
    //Check if WebGL2 is available
    if (gl == null) {
        console.error("Unable to initialize WebGL 2 context");
        return;
    }

    webGlSetup();

    //Handlers
    $(canvas).on("mousemove", mouseHandler);
    $(canvas).on("mousedown", clickOn);
    $(canvas).on("mouseup", clickOff);

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
function restart(e, doFlip) {
    let wasPaused = parameters.pause;
    parameters.pause = true;
    flip != flip;
    parameters.pause = wasPaused;
}

//GUI
gui = new dat.GUI();
let controller = gui.add(parameters, "penSize", 1.0, 200.0);
controller.onChange(onPenSize);
controller = gui.add(parameters, "clear");
controller = gui.add(parameters, "pause");
controller.onChange(() => {if (!parameters.pause) animateScene();});

//Load resources
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
$.get("vertex.glsl", mapResource("vertex"));
$.get("frag.glsl", mapResource("frag"));