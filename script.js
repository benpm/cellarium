'use strict';

const lz4 = require("lz4js");
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
const blending = gl.NEAREST;
const edgeBehavior = gl.REPEAT;

/* Global Variables */
var resources = {};                         // Map of resource names to resources such as frag / vert shader
var resourcesRemaining = 0;                 // Number of remaining resources to fetch
var flip = false;                           // Framebuffer flip
var simProgram;                             // The GL shader program for simulation (see simulate.glsl)
var colorProgram;                           // The GL shader program for colormapping (see colormap.glsl)
var previewProgram;                         // The GL shader program for previewing (see preview.glsl)
var simUniforms;                            // Fragment shader uniform map for simulation shader
var colorUniforms;                          // Fragment shader uniform map for colormapping shader
var previewUniforms;                        // Fragment shader uniform map for colormapping shader
var previewTex;                             // Texture ID for texture preview
var texB;                                   // Framebuffer B GL texture ID
var texA;                                   // Framebuffer A GL texture ID
var ruleTex;                                // Cellular automata rule GL texture ID
var binomialTex;                            // Precomputed binomial coefficients GL texture ID
var colorMapTex;                            // State to color GL texture ID
var fbA;                                    // Framebuffer A ID
var fbB;                                    // Framebuffer B ID
var gui;                                    // datgui object
var touchID;                                // For identifying touch events
var ruleData = new Uint8Array(1024 * 1024); // The actual CA rule data
var nStates = 2;                            // Number of states in the CA rule
var nSubIndices = ruleSubIndices(2);        // Number of subindices in current rule
var gui_penState;                           // Dat GUI object for pen state
var cam = {
    x: 0,
    y: 0,
    zoom: 1,
    panstartcam: {x:0, y:0},
    panstartmouse: {x:0, y:0},
    panning: false
};
var simSize = 2048;
var doStep = false;

// Simulation parameters for datgui
const parameters = {
    clear: clear,
    step: step,
    newRule: () => {
        setRule(randomRule(nStates));
        showCommand("new random rule");
    },
    customRule: () => {
        let string = prompt("input some text:");
        if (string) {
            let states = minStates(string.length);
            let rule = new Uint8Array(ruleLength(states));
            rule.fill(0);
            for (let i = 0; i < string.length; i++) {
                rule[i] = string.charCodeAt(i) % states;
            }
            setRule(rule);
            showCommand(`new rule, length ${ruleLength(states)} from text`);
        }
    },
    mutate: mutate,
    germinate: () => {
        // Clear with a single spot in the center
        clear();
        let data = new Uint8Array(simSize * simSize * 3);
        let i = (simSize * (simSize / 2)) * 3;
        data[i] = parameters.penState;
        webGlSetup(data);
        showCommand("germinated");
    },
    fillRandom: () => {
        // Clear with a single spot in the center
        clear();
        let data = new Uint8Array(simSize * simSize * 3);
        for (let i = 0; i < data.length / 3; i++) {
            data[i * 3] = Math.floor(Math.random() * nStates);
        }
        webGlSetup(data);
        showCommand(`filled ${simSize * simSize} cells with random states`);
    },
    import: () => {
        document.querySelector("#ruledata").select();
        document.execCommand("paste");
        importRule($("#ruledata").val());
    },
    export: () => {
        $("#ruledata").val(exportRule(ruleData.slice(0, ruleLength(nStates))));
        document.querySelector("#ruledata").select();
        document.execCommand("copy");
    },
    penSize: 50.0,
    penState: 1,
    pause: false,
    nStates: 2,
    preset: "gol"
};
// Preset rules
const presets = {
    gol:           [0,0,0,1,0,0,0,0,0,
                       0,0,1,1,0,0,0,0,0],
    _2_worms:         [0,1,0,0,0,1,0,1,1,
                       0,0,0,0,1,1,1,1,1],
    _2_maze:          [1,1,0,1,0,0,0,0,1,
                       1,0,1,1,1,0,1,1,0],
    _2_boxes:         [1,1,0,1,0,0,0,1,1,
                       0,1,1,1,0,1,0,0,1],
    _2_hilbert:       [0,1,0,0,0,0,0,0,0,
                       0,1,1,1,1,1,1,1,1],
    _2_snakes:        [0,1,1,1,1,1,1,1,1,
                       1,1,0,0,1,1,1,0,0],
    _2_stars:         [0,0,1,1,0,0,1,1,0,
                       0,0,1,1,0,1,1,1,1],
    _2_nicetiles:     [1,1,1,0,0,0,0,0,1,
                       0,1,1,1,0,1,0,0,1],
    _2_tricircuit:    [1,1,1,0,0,0,0,0,1,
                       0,1,1,1,1,1,0,0,1],
    _2_sierpinski1:   [0,1,0,0,0,0,0,0,0,
                       0,1,1,0,1,1,1,1,1],
    _2_machine:       [0,1,0,0,0,0,0,0,1,
                       1,1,1,1,0,0,0,1,0],
    _2_tearing:       [0,0,0,0,1,1,1,1,1,
                       0,0,0,1,0,1,1,0,1],
    _2_complexmaze:   [0,0,0,1,0,0,0,0,0,
                       0,0,1,1,1,1,0,1,0],
    _2_gooeyzebra:    [1,1,1,0,1,1,0,1,1,
                       1,1,1,1,0,0,0,0,0],
    _2_octofractal:   [1,0,0,0,0,1,0,1,1,
                       1,1,1,1,0,0,0,1,0],
    _2_sierpinski2:   [1,1,0,0,0,0,0,0,1,
                       1,0,1,1,1,0,1,1,0],
    _4_subdivider:     `%Cn9aĀT"!!đ(11$AC4"1!!Q!!!!AA1#!D!1!¡!B!$!!!T7!q!Q!1#H!đ=AQ!A"S!!Q##!!$QS!"Q$Q!"11A!"TATA3!"C"!!C!AQ^!ñB"!!""!$Q!1!#j!13!QQQ"]!aA!!R4!Á!T"!!!1!T$D!b$!A#!Q!Q#7!a$#B1+!!!$TC3!L!!8!#Ï!A21Õ!Ñ#$!4A3R$$1T!B$#!B2e!¢S!!A$!Q"ü!Á#"21RA!Q!"6!q3AT!Rg!đ&1$!$ABA!#!R$!1!!$#!"h!Q!!"ĝ!ā""QB#C"A4!!!$1÷!đ*#!""C#AQD$!AQ"!Q1Q!$B!$!!!!!`,
    _4_rockets:        '%Cn9aĀ`"!!đ!!$Q1#A1!!B!A#3!"!đ"A!A$!2#$!##!1!!R5!r!A!11*!đ6QQQ$3D1$!1!#!!!S!Q14R!1!A$$$A!"1"!!AJ!ñ1!1QA!1!1ADAB2!Ñ#!!"Q!!"A1T0!Á!AQ"11!$!1z!!(!QBSQt!c2Q!2!đ#Q"RS!!B"R#!1"!A!Qb!đQ1$D!1!QC!!#!11QS!$!A#Q!Q1A!1B13"QTQQD11!C!$$2C!$!!!AR!!2!R!$RQ!0!3#B!C!"<!A1BÏ!đ&$A!$!#!Q#3!$!R!T!"#R1!đ/Q!DQ!2"!Q""!!!31A!!4!!Q"RC!Q4æ!á$"Q#3"!!"!"3!!!!',
    _3_travellers:     `%Cn9aĀc!!!Á!!1!!##!2!$!đ"!#!1!31!A1!!"!#!$!A!!(!āA"113!A!1A!!#A?!ÁA"!"!A!#A!!!!!`,
    _3_glidercity:     `%Cn9aĀ]!!!Ē"!#!!"!1!"1!!!#"10!1!"!D"A6!!B!1"I!"1!đ%#!!1#!113!!2!!2!!A!!!!!`,
    _4_complexgliders: `%Cn9aĀQ"!!ĒG!!$!"A$!!!A!!C!#AQ"A1Q!TQQ4$Q1$14##!1C!!!#T4#!A1!!1#!"!!U!Ē,!AA!!!QD"!RAR11Q##2!!!1$QTv!āQ!Q!3A1!Q##!!QW!b31Q!a!¡RR#!1T!T7!!U!A!3'!R!1!11t!BA!!QQ$Cº!!Ç!Q!"Q¡!đ+#1#$!!D"$!1"$Q##!""3#!$$!8!ē#$$C2!QSR!!!"$!!$R^!B"!b!!M!!*!đ&$1$#"4!#!"!$QA!"#$$$!ē$!$!C!"!Q$3A$!A#!QCÍ!CT!A"AQÙ!bQQ2Bº!1$R"ñ"1!DA!C#QQ"!C!!!!`,
    _4_matrix:         `%Cn9aĀW"!!1!"!đ6D!""!A!!T!RSA#!!4"S!Q!!C!!!A!B$4A!"QI!đ>1"!"!"$C!Q1$!!S1AS1!D!"33!!"!S!!!$!"!!#D!"Q4.!đ$AQ1!!TS$!#!"$!1"!1J!b!1Q"o!đ%AAQA"!!S!#3#$AQAQ$"W!!!đ&QS!!C"11!!#QRA!$$1!!b!¡A$!!14!$À!QQ!!j!â#!!A#1D!"#B19!rA!A!$!ABB÷!2$!#R4C|!!¿!!É!!z!A!1Î!A!Ql!¡!$T32!A$Y!a$Q!#ì!đ$SQ!"4"1Q!Q$!!"A1#3/"¡!!QQS!##^!!Á!Á2A$!!B!!"#!!!!`,
    _5_citylights:     `%Cn9aĀ|%!!đ+!!!!ac!1a1A$!$"#T#!!!A"!d:!đ"Q"!!5!!!CQ1$"b%Q5!đ3#T!A!!ba!A11!DA$!#%#Q!Qa#!!$A!#$!b!Ñ!!%!QDA!!A%U!Q!!$V!đ)!1QT!a%S!#B!!!1!!211#!!x!1"H!āa!Q$AaA!%A!11a4!đ&a"!"!QU!$!!Q1%!2"!a!!ā"#B!"A!aQ!!Q5%c!ña!#aa4d!T""!b !###QASx!±e"#!a!aA2­!1#s!đ'1#Q!Aa5!!a!AdA1!$$%!Q¨!!°!Q$Q1r!đ&R!1%!!b"!Q1A!"a!!$Qd!A!$Ĕ!ē!C"!%!!1Q%!!5""Qĕ!¡1"#!%"Qe!"%!AQ!A!DĞ!đ"D!#"S!a!BR!S!#!#ğ!Q!C1G!qTQ"1aö!đ.%!2A#!a#1A!a!"!!$"U%$1!!%$14J!1AP!Aa!×!qS!d$37"¡!!%%!1QSÓ!B$!U"a!Q!UP!R!!3(!AQ!L"²%a1!!1#T!a"¡a%$!TU!RJ"A"A"Ē($$$A!!11#A1QRA!"#EA#!#!Ñ!%!B1Q!#%B#ò"AS%Á!ã2!A$##A!!U%Q¹"Ñ"1"#Q##1%%S!!Ē"qE!!1a°"B!C¬!!ę!B"1£!1!5#Q!%RQ#Á%!!%24"#"UV!áU$5!E%A#S!!Aø!q"41#CU!QASQ(!A#"Ñ!"-"AAA2!q%5!5#Ĝ!A$"Ê"±$$!!!A#!1ñ!1"}!Aa%?!3E¤!!""R#A"¥#1S#!P!$<!A"SÎ!q%!!Qb"!¢!q!R1"#ù"A$$"±!!Ce!1!AQĞ"!ė"a$A!QĆ#1Qä"!K#aeA#AO#a!a1!6$đ!QE"2!1B!!Q$$1!E"1!"#2#b#!³#±Q!%1a1Q!3>!áC#"Ua!!1"1!#î!A#%$110#q#!$e"7!!!#A"1a$q!Aa1a·#1#ĝ"%!!#R"ª!a!B!%­$¡Q!C!1"AbĖ!b!5%!"#aa##c|""!T"%e4!±5Qa!A"1$QÁ!!µ"1"8"¡Q!adA$$1Ď#!@$Q"$$Ć$1T"A!a´$đ$""Q$d1AQQ1cb1!R!e1Y!1!Ó#Ē#cU5T!a!%$#!Ab%#!$7"1!ċ#1$§!!ē!đ7AQdQD!!Qa!!aE!aA!A"AQaC#dQ#!%S#1!BQa%N!!â!!S#1"Á!"Ò#"Ý"!Ù"đ&%Q""#53$!%d%5d!S!a#"!!!!`,
};
// Mapping from rule length to number of states
var nStateMap = {};
// State number to color
const colorMap = new Uint8Array([
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

function showCommand(string) {
    console.info(string);
    $("#info").text("-> " + string);
}

function fmod(a, b) {
    return a - b * Math.floor(a / b);
}

function mouseHandler(e) {
    simUniforms.mouse.val[0] = (fmod((cam.x + Math.floor(e.pageX) / cam.zoom), simSize) / simSize);
    simUniforms.mouse.val[1] = (fmod((cam.y + Math.floor(e.pageY) / cam.zoom), simSize) / simSize);
    if (cam.panning) {
        cam.x = fmod(cam.panstartcam.x + (cam.panstartmouse.x - e.pageX) / cam.zoom, simSize * 2);
        cam.y = fmod(cam.panstartcam.y + (cam.panstartmouse.y - e.pageY) / cam.zoom, simSize * 2);
    }
}

function clickOn(e) {
    switch (e.originalEvent.button) {
        case 0: // Left click
            simUniforms.mouse.val[2] = parameters.penState;
            break;
        case 1: // Middle click
            cam.panning = true;
            cam.panstartmouse.x = e.pageX;
            cam.panstartmouse.y = e.pageY;
            cam.panstartcam.x = cam.x;
            cam.panstartcam.y = cam.y;
            break;
        case 2: // Right click
            simUniforms.mouse.val[2] = 0;
            break;
    }
}

function clickOff(e) {
    switch (e.originalEvent.button) {
        case 0: // Left click
        case 2: // Right click
            simUniforms.mouse.val[2] = -1;
            break;
        case 1: // Middle click
            cam.panning = false;
            break;
    }
}

function onPenSize() {
    simUniforms.mouse.val[3] = parameters.penSize;
}

function onScrollWheel(e) {
    let z = cam.zoom;
    cam.zoom = Math.max(Math.min(cam.zoom + (e.originalEvent.deltaY < 0 ? 1 : -1), 8), 1);
    cam.x += canvas.width / (2 * z) - canvas.width / (2 * cam.zoom);
    cam.y += canvas.height / (2 * z) - canvas.height / (2 * cam.zoom);
}

function onKey(e) {
    let key = e.originalEvent.key;
    console.debug(e);
    switch(key) {
        case " ":
        case "Space":
        case "spacebar":
            parameters.pause = !parameters.pause;
            if (!parameters.pause) animateScene();
            break;
        case "s":
            parameters.step();
            break;
        case "r":
            parameters.newRule();
            break;
        case "g":
            parameters.germinate();
            break;
        case "f":
            parameters.fillRandom();
            break;
        case "m":
            parameters.mutate();
            break;
        case "c":
        case "backspace":
        case "delete":
            clear();
            break;
        default:
            if (!isNaN(parseInt(key))) {
                let n = parseInt(key);
                if (n >= 1 && n < nStates) {
                    parameters.penState = n;
                }
            }
            break;
    }
}

//Render to the screen
function animateScene() {
    gl.viewport(0, 0, simSize, simSize);

    /* Simulation */
    if (!parameters.pause || doStep) {
        gl.useProgram(simProgram);
        flip = !flip;
        //Set simUniforms
        gl.uniform1f(simUniforms.width.loc, simSize);
        gl.uniform1f(simUniforms.height.loc, simSize);
        gl.uniform1i(simUniforms.sampler.loc, 0);
        gl.uniform1i(simUniforms.rule.loc, 1);
        gl.uniform1i(simUniforms.binomial.loc, 2);
        gl.uniform4fv(simUniforms.mouse.loc, simUniforms.mouse.val);
        gl.uniform1i(simUniforms.states.loc, nStates);
        gl.uniform1i(simUniforms.subindices.loc, nSubIndices);
        //Simulate and render to framebuffer
        gl.bindFramebuffer(gl.FRAMEBUFFER, flip ? fbB : fbA);
        gl.activeTexture(gl.TEXTURE0);
        gl.bindTexture(gl.TEXTURE_2D, flip ? texA : texB);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, ruleTex);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, binomialTex);
        gl.drawArrays(gl.TRIANGLES, 0, 6);
        doStep = false;
    }

    /* Colormapping */
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(colorProgram);
    //Colormap uniforms
    gl.uniform1i(colorUniforms.sampler.loc, 0);
    gl.uniform1i(colorUniforms.colormap.loc, 1);
    gl.uniform3fv(colorUniforms.cam.loc, [cam.x, cam.y, cam.zoom]);
    gl.uniform2fv(colorUniforms.screen.loc, [canvas.width, canvas.height]);
    gl.uniform2fv(colorUniforms.simSize.loc, [simSize, simSize]);
    //Colormap and render to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, flip ? texB : texA);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, colorMapTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //Next frame
    window.requestAnimationFrame(animateScene);
}

//Random rule
function randomRule(nStates) {
    let length = ruleLength(nStates);
    let rule = new Uint8Array(length);
    let zeroChance = Math.max(1 - (1 / Math.pow(nStates, 0.50)), 0.50);
    for (let i = 0; i < length; i++) {
        if (Math.random() < zeroChance) {
            rule[i] = 0;
        } else {
            rule[i] = Math.floor(Math.random() * nStates);
        }
    }
    return rule;
}

//Set rule
function setRule(rule) {
    //Check if rule is valid
    if (!rule || nStateMap[rule.length] === undefined) {
        console.error("invalid rule:", rule);
        return;
    }
    setnStates(nStateMap[rule.length]);
    ruleData.set(rule);
    regenRuleTex();
}

//Regenerate rule texture from current rule data
function regenRuleTex() {
    //Rule texture
    gl.useProgram(simProgram);
    ruleTex = ruleTex || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, ruleTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.LUMINANCE, 1024, 1024, 0, gl.LUMINANCE, gl.UNSIGNED_BYTE, ruleData);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
}

//Factorial function
function factorial(m) {
    let n = 1;
    for (let i = 2; i <= m; i++) {
        n *= i;
    }
    return n;
}

//Binomial coefficient function
function binomial(n, k) {
    return Math.floor(factorial(n) / (factorial(k) * factorial(n - k)));
}

//Build precomputed binomial coefficient texture
function buildBinomial() {
    console.info("Building binomial coefficient tex...");
    let data = new Uint8Array(32 * 32 * 4);
    data.fill(0);
    for (let n = 0; n < 32; n++) {
        for (let k = 0; k < 32; k++) {
            let value = binomial(n, k);
            let index = (k * 32 + n) * 4;
            //Pack result into the four RGBA bytes
            data[index + 0] = value & 0xFF;
            data[index + 1] = (value >> 8) & 0xFF;
            data[index + 2] = (value >> 16) & 0xFF;
            data[index + 3] = (value >> 24) & 0xFF;
        }
    }
    binomialTex = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, binomialTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 32, 32, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
}

//Returns 1D rule subindex given number of states and neighbor count array
function ruleSubIndex(nStates, neighbors) {
    let subIndex = 0;
    let x = nStates;
    let y = 8;
    for (let i = 0; i < nStates - 1; i++) {
        let v = neighbors[i];
        if (v > 0) {
            subIndex += binomial(y + x - 1, x - 1) - binomial(y - v + x - 1, x - 1);
        }
        x -= 1;
        y -= cc;
    }
    return subIndex;
}

//Returns the number of rule patterns (length of the rule)
function ruleLength(nStates) {
   return nStates * ruleSubIndices(nStates);
}

//Returns the number of rule subindices (pattern permutations)
function ruleSubIndices(states) {
   return binomial(states + 8 - 1, states - 1);
}

//Exports rule to unicode string
function exportRule(rule) {
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
    let x = new Uint16Array(values);
    let v = new Uint8Array(x.buffer);
    let compbytes = new Uint16Array(lz4.compress(v));
    compbytes = compbytes.map((v) => {return v + 33});
    let string = String.fromCharCode(...compbytes)
    showCommand(`exported rule w/ string length ${string.length}`);
    return string;
}

//Imports rule from unicode string directly into current rule buffer, setting rule to given
function importRule(string) {
    let compbytes = new Uint8Array(string.length);
    compbytes = compbytes.map((_, i) => { return string.charCodeAt(i) - 33});
    let x = lz4.decompress(compbytes);
    let values = new Uint16Array(x.buffer);
    //Extract values from decompressed values
    let z = 0;
    for (let i = 0; i < values.length; i++) {
        for (let j = 0; j < 4; j++) {
            ruleData[z] = (values[i] >> (j * 4)) & 0xF;
            z += 1;
        }
    }
    //Infer the number of states this must have
    let states = minStates(z);
    setnStates(states);
    showCommand(`unpacked rule of length ${z} (${ruleLength(states)}) and nstates ${states}`);
    regenRuleTex();
}

//Returns the number of states needed to represent the given rule length
function minStates(length) {
    //Infer the number of states this must have
    for (let i = 3; i <= 14; i++) {
        if (ruleLength(i) > length) {
            return i - 1;
        }
    }
    return 14;
}

//Sets the current number of states
function setnStates(states) {
    if (states != nStates) {
        if (states >= 2 && states < 14) {
            nStates = states;
            if (parameters.penState >= nStates) {
                parameters.penState = nStates - 1;
            }
            gui_penState.max(nStates - 1);
            gui_penState.updateDisplay();
            nSubIndices = ruleSubIndices(nStates);
            regenRuleTex();
        } else {
            states = nStates;
        }
        parameters.nStates = states;
    }
}

//Setup for WebGL stuff
function webGlSetup(data) {
    //Texture A
    texA = texA || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texA);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 
        simSize,
        simSize,
        0, gl.RGB, gl.UNSIGNED_BYTE, data || null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, blending);
    //Framebuffer A
    fbA = fbA || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
    //Texture B
    texB = texB || gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texB);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 
        simSize,
        simSize,
        0, gl.RGB, gl.UNSIGNED_BYTE, data || null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, blending);
    //Framebuffer B
    fbB = fbB || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);

    //Build simulator shader program
    if (!simProgram) {
        const shaderSet = [
            {type: gl.FRAGMENT_SHADER, name: "simulate"},
            {type: gl.VERTEX_SHADER, name: "vertex"}
        ];
        simProgram = buildShaderProgram(gl, shaderSet);
        gl.useProgram(simProgram);

        //Build precomputed binomial coefficient texture
        buildBinomial();
    
        //Create vertices for quad
        let vertexArray = new Float32Array([
            -1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
        ]);
        let vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
    
        //Uniforms
        simUniforms = {
            width:      {loc: gl.getUniformLocation(simProgram, "uWidth")},
            height:     {loc: gl.getUniformLocation(simProgram, "uHeight")},
            sampler:    {loc: gl.getUniformLocation(simProgram, "uSampler")},
            binomial:   {loc: gl.getUniformLocation(simProgram, "uBinomial")},
            rule:       {loc: gl.getUniformLocation(simProgram, "uRule")},
            mouse:      {loc: gl.getUniformLocation(simProgram, "uMouse"), val: [0, 0, -1, 50]},
            states:     {loc: gl.getUniformLocation(simProgram, "uStates")},
            subindices: {loc: gl.getUniformLocation(simProgram, "uSubIndices")}
        };
    
        //Attributes
        let aVertexPosition = gl.getAttribLocation(simProgram, "aVertexPosition");
        gl.activeTexture(gl.TEXTURE0);
        gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexPosition);

        //Rule texture
        setRule(presets[parameters.preset]);
    }

    // Build colormap shader program
    if (!colorProgram) {
        const shaderSet = [
            {type: gl.FRAGMENT_SHADER, name: "colormap"},
            {type: gl.VERTEX_SHADER, name: "vertex"}
        ];
        colorProgram = buildShaderProgram(gl, shaderSet);
        gl.useProgram(colorProgram);

        //Color map
        colorMapTex = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, colorMapTex);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB, 14, 1, 0, gl.RGB, gl.UNSIGNED_BYTE, colorMap);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, blending);
    
        //Create vertices for quad
        let vertexArray = new Float32Array([
            -1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
        ]);
        let vertexBuffer = gl.createBuffer();
        gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
        gl.bufferData(gl.ARRAY_BUFFER, vertexArray, gl.STATIC_DRAW);
    
        //Uniforms
        colorUniforms = {
            sampler:    {loc: gl.getUniformLocation(colorProgram, "uSampler")},
            colormap:   {loc: gl.getUniformLocation(colorProgram, "uColorMap")},
            cam:        {loc: gl.getUniformLocation(colorProgram, "uCam")},
            screen:     {loc: gl.getUniformLocation(colorProgram, "uScreen")},
            simSize:    {loc: gl.getUniformLocation(colorProgram, "uSimSize")},
        };
    
        //Attributes
        let aVertexPosition = gl.getAttribLocation(colorProgram, "aVertexPosition");
        gl.activeTexture(gl.TEXTURE0);
        gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexPosition);
    }
}

//Main function, is called after all resources are loaded
function main() {
    //Check if WebGL2 is available
    if (gl == null) {
        alert("Unable to initialize WebGL 2 context");
        return;
    }
    //Build nstate map
    for (let i = 2; i <= 14; i++) {
        nStateMap[ruleLength(i)] = i;
    }

    //Texture data
    parameters.fillRandom();

    //Handlers
    $(canvas).on("mousemove", mouseHandler);
    $(canvas).on("mousedown", clickOn);
    $(canvas).on("mouseup", clickOff);
    $(window).on("resize", resize);
    $(canvas).on("wheel", onScrollWheel);
    $(window).on("keypress", onKey);

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
        console.info(`${name} loaded, ${resourcesRemaining} remain`);
        if (resourcesRemaining == 0)
            main();
    };
}

//Compile a shader from given code and gl shader type
function compileShader(glc, name, code, type) {
    let shader = glc.createShader(type);
  
    glc.shaderSource(shader, code);
    glc.compileShader(shader);
  
    if (!glc.getShaderParameter(shader, glc.COMPILE_STATUS)) {
        console.error(`Error compiling ${type === glc.VERTEX_SHADER ? "vertex" : "fragment"} shader "${name}":`);
        console.log(glc.getShaderInfoLog(shader));
    }
    return shader;
}

//Build the shader program from given shader informations
function buildShaderProgram(glc, shaderInfo) {
    let program = glc.createProgram();

    shaderInfo.forEach(function(sInfo) {
        let shader = compileShader(glc, sInfo.name, resources[sInfo.name], sInfo.type);

        if (shader) {
            glc.attachShader(program, shader);
        }
    });

    glc.linkProgram(program)

    if (!glc.getProgramParameter(program, glc.LINK_STATUS)) {
        console.error("Error linking shader program:");
        console.info(glc.getProgramInfoLog(program));
    }

    return program;
}

//Restart
function clear() {
    flip = false;
    if (fbA && fbB) {
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
        gl.clearColor(0, 0, 0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbB);
        gl.clearColor(0, 0, 0, 1.0);
        gl.clear(gl.COLOR_BUFFER_BIT);
    }
    showCommand(`cleared canvas`);
}

//Resize
function resize(e) {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

//Single step
function step() {
    parameters.pause = true;
    doStep = true;
}

//Mutate current rule
function mutate() {
    let length = ruleLength(nStates);
    let nMutate = Math.ceil(length / 20);
    for (let i = 0; i < nMutate; i++) {
        let j = Math.floor(Math.random() * length);
        ruleData[j] = Math.floor(Math.random() * nStates);
    }
    regenRuleTex();
    showCommand(`mutated ${nMutate} values`);
}

//GUI
gui = new dat.GUI();
gui.width = 375;
gui.add(parameters, "penSize", 1.0, 200.0)
    .listen()
    .onChange(onPenSize)
    .name("pen size");
gui_penState = gui.add(parameters, "penState", 1, 1, 1)
    .listen()
    .name("pen state");
gui.add(parameters, "pause")
    .listen()
    .onChange(() => {if (!parameters.pause) animateScene();});
gui.add(parameters, "step");
gui.add(parameters, "nStates", 2, 14, 1).name("# states")
    .listen()
    .onChange((v) => setnStates(v));
gui.add(parameters, "preset", Object.keys(presets))
    .onChange(() => {
        if (typeof(presets[parameters.preset]) == "object")
            setRule(presets[parameters.preset]);
        else {
            importRule(presets[parameters.preset]);
        }
    });
gui.add(parameters, "newRule").name("random rule");
gui.add(parameters, "import").name("import rule from clipboard");
gui.add(parameters, "export").name("export rule to clipboard");
gui.add(parameters, "customRule").name("rule from text");
gui.add(parameters, "mutate").name("mutate rule");
gui.add(parameters, "clear");
gui.add(parameters, "germinate").name("germinate from center");
gui.add(parameters, "fillRandom").name("fill randomly");

//Load resources
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
$.get("vertex.glsl", mapResource("vertex"));
$.get("simulate.glsl", mapResource("simulate"));
$.get("colormap.glsl", mapResource("colormap"));
$.get("preview.glsl", mapResource("preview"));