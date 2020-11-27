'use strict';

const lz4 = require("lz4js");
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
const blending = gl.NEAREST;
const edgeBehavior = gl.REPEAT;
const _ext_depth = gl.getExtension("WEBGL_depth_texture");

/* Global Variables */
var resources = {};                         // Map of resource names to resources such as frag / vert shader
var resourcesRemaining = 0;                 // Number of remaining resources to fetch
var flip = false;                           // Framebuffer flip
var simProgram;                             // The GL shader program for simulation (see simulate.glsl)
var colorProgram;                           // The GL shader program for colormapping (see colormap.glsl)
var simUniforms;                            // Fragment shader uniform map for simulation shader
var colorUniforms;                          // Fragment shader uniform map for colormapping shader
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
    panning: false,
    move: {x:0, y:0}
};
var simSize = 1024;
var doStep = false;
var frames = 0;
var steps = 0;
var lastFPSSample = Date.now();

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
        let data = new Uint8Array(simSize * simSize);
        let i = (simSize * (simSize / 2));
        data[i] = parameters.penState;
        webGlSetup(data);
        showCommand("germinated");
    },
    fillRandom: () => {
        // Clear with a single spot in the center
        clear();
        let data = new Uint8Array(simSize * simSize);
        for (let i = 0; i < data.length; i++) {
            data[i] = Math.floor(Math.random() * nStates);
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
    simsize: simSize,
    stepsPerFrame: 1,
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
    _2_hilbert:       [0,1,0,0,0,0,0,0,0,
                       0,1,1,1,1,1,1,1,1],
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
    _2_complexmaze:   [0,0,0,1,0,0,0,0,0,
                       0,0,1,1,1,1,0,1,0],
    _2_sierpinski2:   [1,1,0,0,0,0,0,0,1,
                       1,0,1,1,1,0,1,1,0],
    _3_glidercity:     `%Cn9a´ģ]!!!ĵ"!#!!"!1!"1!!!#"10!1!"!D"A6!!B!1"I!"1!Ĵ%#!!1#!113!!2!!2!!A!!!!!`,
    _4_complexgliders: `%Cn9a´ģQ"!!ĵG!!$!"A$!!!A!!C!#AQ"A1Q!TQQ4$Q1$14##!1C!!!#T4#!A1!!1#!"!!U!ĵ,!AA!!!QD"!RAR11Q##2!!!1$QTv!ĤQ!Q!3A1!Q##!!QW!b31Q!a!ÄRR#!1T!T7!!U!A!3'!£R!1!11t!BA!£!QQ$CÝ!!ê!Q!"QÄ!Ĵ+#1#$!!D"$!1"$Q##!""3#!$$!8!Ķ#$$C2!QSR!!!"$!!$R^!B"!b!!M!!*!Ĵ&$1$#"4!#!"!$QA!"#$$$¹!Ķ$!$!C!"!Q$3A$!A#!QCð!´CT!A"AQü!bQQ2BÝ!1$R"Ĕ"1!DA!C#QQ"!C!!!!`,
    _4_matrix:         `%Cn9a´ģW"!!1!"!Ĵ6D!""!A!!T!RSA#!!4"S!Q!!C!!!A!B$4A!"QI!Ĵ>1"!"!"$C!Q1$!!S1AS1!D!"33!!"!S!!!$!"!!#D!"Q4.!Ĵ$AQ1!!TS$!#!"$!1"!1J!b!1Q"o!Ĵ%AAQA"!!S!#3#$AQAQ$"W!!º!Ĵ&QS!!C"11!!#QRA!$$1!!b!ÄA$!!14!$ã!QQ!!j!ą#!!A#1D!"#B19!rA!A!$¤!ABBĚ!´2$!#R4C|!!â!!ì!!z!A!1ñ!A!Ql!Ä!$T32!A$Y!a$Q!#ď!Ĵ$SQ!"4"1Q!Q$!!"A1#3/"Ä!!QQS!##^!!ä!ä2A$!!B!!"#!!!!`,
    _5_citylights:     `%Cn9a´ģ{%!!Ĵ+!!!!ac!1a1A$!$"#T#!!!A"!d:!Ĵ"Q"!!5!!!CQ1$"b%Q5!Ĵ3#T!A!!ba!A11!DA$!#%#Q!Qa#!!$A!#$!b!ô!!%!QDA!!A%U!Q!!$V!Ĵ)!1QT!a%S!#B!!!1!!211#!!x!1"H!Ĥa!Q$AaA!%A!11a4!Ĵ&a"!"!QU!$!!Q1%!2"!a!¤!Ĥ"#B!"A!aQ!!Q5%c!Ĕa!#aa4d!T""!bn!£###QAS+!Ôe"#!a!aA2Ð!1#s!Ĵ'1#Q!Aa5!!a!AdA1!$$%!QË!!Ó!Q$Q1r!Ĵ&R!1%!!b"!Q1A!"a!!$QdÂ!A!$ķ!Ķ!C"!%!!1Q%!!5""Qĸ!Ä1"#!%"Qe¹!"%!£AQ!A!DŁ!Ĵ"D!#"S!a!BR!S!#!#ł!Q!C1G!qTQ"1aę!Ĵ.%!2A#!a#1A!a!"!!$"U%$1!!%$14J!1AP!Aa!ú!qS!d$37"Ä!!%%!1QSö!B$!U"a!Q!UP!R!!3(!AQ!L"Õ%a1!!1#T!a"Äa%$!TU!RB!A"A®"ĵ($$$A!!11#A1QRA!"#EA#!#¼!ô!%!B1Q!#%B#ĕ"AS%ä!Ć2!A$##A!!U%QÜ"ô"1"#Q##1%%S¢!!ĵ"rE!!1aÓ"1C®!!¿!Q1"1(!!0!q$!!%RQ#ä%!!%24"#"UV!ĄU$5!E%A#S!!Aě!q"41#CU!QASQ(!A#"ô!"-"AAA2!q%5!5#Ŀ!A$"í"Ô$$!!!A#!1Ĕ!1"}!Aa%?!1E¸!"%!b##A"È#1SÁ#!P!"8!a!!"Sñ!q%!!Qb«"!Å!q!R1"#Ĝ"A$$¯"Ô!!Ce!1!AQŁ"!ĺ"a$A!Qĩ#1Qć"!K#aeA#AO#a!a1!6$ĥQE"2!1B!!Q$$1!É!£1!"#2#b#!Ö#ÔQ!%1a1Q!3>!´C#"Ua!!G"1#đ!A#%º$110#µ#!$e"!#,!aA"1a¡$q!Aa1aÚ#1#ŀ"£%!!#R"Í!a!B!%Ð$´Q!C!1"A2$´#b!5%!"½#aa##c|"¤"!T"%e4!Ä5Qa!A"1$&$1!Ø"1"8"ÄQ!adA$$1ı#!;!Q"$$ĩ$1TÁ"A!a×$Ĵ$""Q$d1AQQ1cb1!R!e1Y!1!ö#ĵ#cU5T!a!%$#!Ab%#!$7"1!Į#1$Ê!!Ķ!Ĵ7AQdQD!!Qa!!aE!aA!A"AQaC#dQ#!%S#1!BQa%N!#û#1$Ł!"ã%B!!Ā"!ü"Ĵ&%Q""#53$!%d%5d!S!a#"!!!!`,
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
// List of printable characters for encoding rules
const pchars = "!\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~¡¢£¤¥¦§¨©ª«¬®¯°±²³´µ¶·¸¹º»¼½¾¿ÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖ×ØÙÚÛÜÝÞßàáâãäåæçèéêëìíîïðñòóôõö÷øùúûüýþÿĀāĂăĄąĆćĈĉĊċČčĎďĐđĒēĔĕĖėĘęĚěĜĝĞğĠġĢģĤĥĦħĨĩĪīĬĭĮįİıĲĳĴĵĶķĸĹĺĻļĽľĿŀŁłŃńŅņŇňŉŊŋŌōŎŏŐőŒœŔŕŖŗŘřŚśŜŝŞşŠšŢţŤťŦŧŨũŪūŬŭŮůŰűŲųŴŵŶŷŸŹźŻżŽžſƀƁƂƃƄƅƆƇƈƉƊƋƌƍƎƏƐƑƒƓƔƕƖƗƘƙƚƛƜƝƞƟƠơƢƣƤƥƦƧƨƩƪƫƬƭƮƯưƱƲƳƴƵƶƷƸƹƺƻƼƽƾƿǀǁǂ";
// Map from pchar codes back to indices
var pcharMap = {};
for (let i = 0; i < pchars.length; i++) {
    pcharMap[pchars.charCodeAt(i)] = i;
}

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
            canvas.style.cursor = "move";
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
            canvas.style.cursor = "";
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
    switch(key) {
        case " ":
        case "Space":
        case "spacebar":
            parameters.pause = !parameters.pause;
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
        case "ArrowLeft":
            cam.move.x = -3;
            break;
        case "ArrowRight":
            cam.move.x = 3;
            break;
        case "ArrowUp":
            cam.move.y = -3;
            break;
        case "ArrowDown":
            cam.move.y = 3;
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

function onKeyUp(e) {
    let key = e.originalEvent.key;
    switch(key) {
        case "ArrowLeft":
        case "ArrowRight":
            cam.move.x = 0;
            break;
        case "ArrowUp":
        case "ArrowDown":
            cam.move.y = 0;
            break;
    }
}

//Render to the screen
function animateScene() {
    /* Simulation */
    if (!parameters.pause || doStep) {
        gl.viewport(0, 0, simSize, simSize);
        gl.useProgram(simProgram);
        //Set simUniforms
        gl.uniform4fv(simUniforms.mouse.loc, simUniforms.mouse.val);
        gl.activeTexture(gl.TEXTURE1);
        gl.bindTexture(gl.TEXTURE_2D, ruleTex);
        gl.activeTexture(gl.TEXTURE2);
        gl.bindTexture(gl.TEXTURE_2D, binomialTex);
        //Simulate N steps
        for (let i = 0; i < parameters.stepsPerFrame; i++) {
            flip = !flip;
            //Simulate and render to framebuffer
            gl.bindFramebuffer(gl.FRAMEBUFFER, flip ? fbB : fbA);
            gl.activeTexture(gl.TEXTURE0);
            gl.bindTexture(gl.TEXTURE_2D, flip ? texA : texB);
            gl.drawArrays(gl.TRIANGLES, 0, 6);
            steps += 1;
            if (doStep) {
                doStep = false;
                break;
            }
        }
    }

    /* Colormapping */
    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.useProgram(colorProgram);
    //Colormap uniforms
    cam.x += cam.move.x;
    cam.y += cam.move.y;
    gl.uniform3fv(colorUniforms.cam.loc, [cam.x, cam.y, cam.zoom]);
    //Colormap and render to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, flip ? texB : texA);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, colorMapTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    //Next frame
    frames += 1;
    if (Date.now() - lastFPSSample >= 1000) {
        lastFPSSample = Date.now();
        $("#rtinfo").html(`${frames} frames/sec<br>${steps} steps/sec`);
        frames = 0;
        steps = 0;
    }
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
    
    gl.uniform1i(simUniforms.states.loc, nStates);
    gl.uniform1i(simUniforms.subindices.loc, nSubIndices);
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
    let string = "";
    compbytes.forEach((v) => string += pchars[v]);
    showCommand(`exported rule w/ string length ${string.length}`);
    return string;
}

//Imports rule from unicode string directly into current rule buffer, setting rule to given
function importRule(string) {
    let compbytes = new Uint8Array(string.length);
    compbytes = compbytes.map((_, i) => { return pcharMap[string.charCodeAt(i)]});
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, simSize, simSize, 0, gl.RED, gl.UNSIGNED_BYTE, data || null);
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
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.R8, simSize, simSize, 0, gl.RED, gl.UNSIGNED_BYTE, data || null);
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
            size:       {loc: gl.getUniformLocation(simProgram, "uSize")},
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

        //Set these uniforms once
        gl.uniform1i(simUniforms.sampler.loc, 0);
        gl.uniform1i(simUniforms.rule.loc, 1);
        gl.uniform1i(simUniforms.binomial.loc, 2);
    } else {
        gl.useProgram(simProgram);
    }

    gl.uniform2fv(simUniforms.size.loc, [simSize, simSize]);

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

        //Set these uniforms once
        gl.uniform1i(colorUniforms.sampler.loc, 0);
        gl.uniform1i(colorUniforms.colormap.loc, 1);
        gl.uniform2fv(colorUniforms.screen.loc, [canvas.width, canvas.height]);
    } else {
        gl.useProgram(colorProgram);
    }

    gl.uniform2fv(colorUniforms.simSize.loc, [simSize, simSize]);
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
    $(window).on("keydown", onKey);
    $(window).on("keyup", onKeyUp);

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
    gl.uniform2fv(colorUniforms.screen.loc, [canvas.width, canvas.height]);
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
gui.add(parameters, "stepsPerFrame", 1, 16, 1).name("steps per frame");
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
gui.add(parameters, "simsize",
    [16, 64, 256, 512, 1024, 2048, 4096]).name("simulation size")
    .onChange((v) => {
        let ssize = Math.min(simSize, v);
        let data = new Uint8Array(4 * v**2);
        let slice = data.slice(0, 4 * ssize**2);
        gl.useProgram(simProgram);
        gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
        gl.readPixels(0, 0, ssize, ssize, gl.RGBA, gl.UNSIGNED_BYTE, slice);
        simSize = v;
        data.set(slice.map((v, i, a) => i < ssize**2 ? a[i * 4] : 0).slice(0, ssize**2));
        webGlSetup(data);
    });
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