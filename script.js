'use strict';

const lz4 = require("lz4js");
const canvas = document.getElementById("glCanvas");
const gl = canvas.getContext("webgl2");
const blending = gl.NEAREST;
const edgeBehavior = gl.REPEAT;
const viewerCanvas = document.getElementById("glViewer");
const glViewer = viewerCanvas.getContext("webgl2");

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

// Simulation parameters for datgui
const parameters = {
    clear: clear,
    step: step,
    newRule: () => { setRule(randomRule(nStates)); },
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
        }
    },
    mutate: mutate,
    germinate: () => {
        // Clear with a single spot in the center
        clear();
        let data = new Uint8Array(canvas.width * canvas.height * 3);
        let i = (canvas.width * (canvas.height / 2)) * 3;
        data[i] = 1;
        webGlSetup(data);
    },
    fillRandom: () => {
        // Clear with a single spot in the center
        clear();
        let data = new Uint8Array(canvas.width * canvas.height * 3);
        for (let i = 0; i < data.length / 3; i++) {
            data[i * 3] = Math.round(Math.random());
        }
        webGlSetup(data);
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
    pause: false,
    scale: 2,
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
    _4_trimoss:        `%Cn9aĀk"!¡TAA33S22R$D4Q2!C41DSRS##R1RCC"!141C1""2!BS4C!!Q"#!#D1CQ$!!432"1#C2R#$4""C2CAT2!12BC""C!"B4QABBR43D##4SQTR$#33C2ATCQ$SRR41C!4$2!34Q#T""DSDT2AAB1D!4!R4C!!#RS32R!C"TS4AS343A#QT#$"4Q#$QD4#C1ACD"2DC$!"A2T#32##3$!CAQ1!QR1"ST33SS#24CSTD"!2Q1!4$T$4T1C1CTSTA$B4#S3!D23T4A34"34DS#RT24A2T$D#!222#S#3"2CS"A41!$ASBS2#$#"4CA22B41S2DB334CBSRT23C!!!!`,
    _4_trains:         `%Cn9aĀk"!¡$TQRRTT#SA2"1T14AQ2BAB24CSB1SDSDB""T41CRA!1#C!#AQ"$SCARS32D!CD$QTASTADSQAQ4D2R$3T34S44Q$4AT"BA$Q1T134B4!R4TABS$BBB"D!"3Q22DQ2D"4D1CRC"BT$DB$ADBA4$S"A4R4T"S4Q!BC!T"QD4TQ#1"Q"CC3R#Q3AQDS#!DRB34AR"$B!"1Q4A2#4A$QSC!R$ARS"33CQQ42#!SQ$31C#"B!41R33AS4Q!BA"32T"#B!"R#!S$QQ#ABCRBT324A#C!CTD$S1$T1"$3#1!D$S$QBT2!RC24#!$2SCDT14SB$TDQ#1#3RAC#!!!!`,
    _5_speeders:       `%Cn9aĀ÷%!¡QB2e!bC5dabeU!dA2"#4Aa"RBTE1e%%e"aceea4%BTec$QSTTQe2B##QS%BUUU1CB$R%1Q!5DQ2#$CUU1A#3"3CRQCU3USdS#"bbaSDQT5QbAT5!cRcEDTd#d%#$2RE2"cdT22d%%1QBUAC%2C"S$E4"%3EaCdR4aeDU!ab5ad#D!!D#cB2C##%%a!UUS5TbRQA#R4BAa4%2"AT2aR5RDBB2CUe#2DC!SUcdR1BbQDTQQRCA"EaBad"e3E132$RCQQ3e$$aQDaU2Q5Db%S$c%Q#E#3A#QE%1U4$d4TQT1#dTQa2a42e43CDR#$da$R5c"CD1CQe5QdR%U1D$3Q"2Se"BB32ee"DD4a#$CTaCe$b"DDQSeRDCQ!U4c$$UED1c$c#%$1aSbeddED4Ae5B3E%TEBb!TC5"CS!RD!B%D24TSbB$R%Q5b"$dRdUdSE"2D!TTB4C1%RQAcb"eA"ADTadCc34#S!dRRTUce4$e1eEe1%Q"QQSSde"4UE$!c#3C2d3!23dRSEac4e$R5T5S4!%!CaQ2a4!AeS#TAeUbQE2R%2S"E3Qd$B3"TRc%"c"#accBdQ%S!EcAAaAe5CS5#DERRE"T1"C%R"#13T2#2U$cSB4QaEQ%AUAD5CD%2S2SEC4E$3d13R!eb$"B3a%$CdTA"aU5aB%$!14%Ub44"%1RU%E1C$Dc!SC$1512RR%cTeRccb!dEB%"aUb%35bBETe5B5TURBCe$dQ1R"bEaTbCRC#DE3#A2d!d$E1$c"52CcDDS$5SSSDT45bAD#%"ab5d5cSB33%dU5cb2S1$a!E"!%RBUSR$A1#bECdaSD"AUdBe2b!d#"!3C5b$4BC!ABc14S"de4A#$E1beSE2S#cAdE3b!dARC$e#ABC532RBT$R5E3US2eU$%2Q#!c!caR%43baaCDC4#2"31ScTEDd5Sd$4A!4AEb"2U1!cab3QUEC3$"Q5A#e#d#!C2Ue45c2AQ"%4T$5345a41"1b3Qb$E3CddS#a3#U"AB3SCA1AQBbbABBTdedcUDRcdDQ"2Q"B1"c%DD4"B33$De%TDbBSB$!AEUbbT$a$!!5CAQ4aB3Q44RAcd2#DE#EUC24"3C#"UBQdC3eESA1b5Tdc3!3Rd2a#!RbAT4C2Ca"5AeA1U$BU44SaeeBUS3USeb1!RS3ec1BQQa2!eAC!SCDce5D"DQA2e%D%5ec$Eac!E!dAcSb!a5S5#4SS4dQ#CD"Ac!!!!!!`
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

function mouseHandler(e) {
    simUniforms.mouse.val[0] = ((Math.floor(e.pageX)) / window.innerWidth);
    simUniforms.mouse.val[1] = ((Math.floor(e.pageY)) / window.innerHeight);
}

function clickOn(e) {
    simUniforms.mouse.val[2] = e.originalEvent.button;
}

function clickOff(e) {
    simUniforms.mouse.val[2] = -1;
}

function onPenSize() {
    simUniforms.mouse.val[3] = parameters.penSize;
}

//Render to the screen
function animateScene() {
    gl.viewport(0, 0, canvas.width, canvas.height);

    /* Simulation */
    gl.useProgram(simProgram);
    //Set simUniforms
    gl.uniform1f(simUniforms.width.loc, canvas.width);
    gl.uniform1f(simUniforms.height.loc, canvas.height);
    gl.uniform1i(simUniforms.sampler.loc, 0);
    gl.uniform1i(simUniforms.rule.loc, 1);
    gl.uniform1i(simUniforms.binomial.loc, 2);
    gl.uniform4fv(simUniforms.mouse.loc, simUniforms.mouse.val);
    /// NOTE: no idea why this works
    gl.uniform1i(simUniforms.states.loc, 2);
    gl.uniform1i(simUniforms.subindices.loc, 9);
    //Simulate and render to framebuffer
    gl.bindFramebuffer(gl.FRAMEBUFFER, flip ? fbB : fbA);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, flip ? texA : texB);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, ruleTex);
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, binomialTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /* Colormapping */
    gl.useProgram(colorProgram);
    //Colormap uniforms
    gl.uniform1i(colorUniforms.sampler.loc, 0);
    gl.uniform1i(colorUniforms.colormap.loc, 1);
    //Colormap and render to canvas
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, flip ? texA : texB);
    gl.activeTexture(gl.TEXTURE1);
    gl.bindTexture(gl.TEXTURE_2D, colorMapTex);
    gl.drawArrays(gl.TRIANGLES, 0, 6);

    /* Debug Preview */
    glViewer.drawArrays(glViewer.TRIANGLES, 0, 6);

    //Flip framebuffers
    flip = !flip;
    if (!parameters.pause) window.requestAnimationFrame(animateScene);
}

//Random rule
function randomRule(nStates) {
    let length = ruleLength(nStates);
    let rule = new Uint8Array(length);
    for (let i = 0; i < length; i++) {
        rule[i] = Math.floor(Math.random() * nStates);
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

    previewTex = glViewer.createTexture();
    glViewer.bindTexture(glViewer.TEXTURE_2D, previewTex);
    glViewer.texImage2D(glViewer.TEXTURE_2D, 0, glViewer.RGBA, 32, 32, 0, glViewer.RGBA, glViewer.UNSIGNED_BYTE, data);
    glViewer.texParameteri(glViewer.TEXTURE_2D, glViewer.TEXTURE_WRAP_S, glViewer.CLAMP_TO_EDGE);
    glViewer.texParameteri(glViewer.TEXTURE_2D, glViewer.TEXTURE_WRAP_T, glViewer.CLAMP_TO_EDGE);
    glViewer.texParameteri(glViewer.TEXTURE_2D, glViewer.TEXTURE_MIN_FILTER, blending);
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
    return String.fromCharCode(...compbytes);
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
    console.info(`unpacked rule of length ${z} (${ruleLength(states)}) and nstates ${states}`);
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
        canvas.width,
        canvas.height,
        0, gl.RGB, gl.UNSIGNED_BYTE, data || null
    );
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, edgeBehavior);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, blending);
    //Framebuffer A
    fbA = fbA || gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbA);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texA, 0);
    //Texture B
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
            colormap:   {loc: gl.getUniformLocation(colorProgram, "uColorMap")}
        };
    
        //Attributes
        let aVertexPosition = gl.getAttribLocation(colorProgram, "aVertexPosition");
        gl.activeTexture(gl.TEXTURE0);
        gl.vertexAttribPointer(aVertexPosition, 2, gl.FLOAT, false, 0, 0);
        gl.enableVertexAttribArray(aVertexPosition);
    }

    // Build texture preview shader program
    if (!previewProgram) {
        const shaderSet = [
            {type: glViewer.FRAGMENT_SHADER, name: "preview"},
            {type: glViewer.VERTEX_SHADER, name: "vertex"}
        ];
        previewProgram = buildShaderProgram(glViewer, shaderSet);
        glViewer.useProgram(previewProgram);
    
        //Create vertices for quad
        let vertexArray = new Float32Array([
            -1.0, 1.0, 1.0, 1.0, 1.0, -1.0,
            -1.0, 1.0, 1.0, -1.0, -1.0, -1.0
        ]);
        let vertexBuffer = glViewer.createBuffer();
        glViewer.bindBuffer(glViewer.ARRAY_BUFFER, vertexBuffer);
        glViewer.bufferData(glViewer.ARRAY_BUFFER, vertexArray, glViewer.STATIC_DRAW);
    
        //Uniforms
        previewUniforms = {
            sampler:    {loc: glViewer.getUniformLocation(previewProgram, "uSampler")}
        };
    
        //Attributes
        let aVertexPosition = glViewer.getAttribLocation(previewProgram, "aVertexPosition");
        glViewer.activeTexture(glViewer.TEXTURE0);
        glViewer.vertexAttribPointer(aVertexPosition, 2, glViewer.FLOAT, false, 0, 0);
        glViewer.enableVertexAttribArray(aVertexPosition);


        glViewer.uniform1i(previewUniforms.sampler.loc, 0);
        glViewer.activeTexture(glViewer.TEXTURE0);
        glViewer.bindTexture(glViewer.TEXTURE_2D, previewTex);
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
}

//Mutate current rule
function mutate() {
    let mRule = ruleData.slice(0, ruleLength(nStates));
    let i = Math.floor(Math.random() * mRule.length);
    mRule[i] = Math.floor(Math.random() * nStates);
    setRule(mRule);
}

//GUI
gui = new dat.GUI();
gui.width = 375;
gui.add(parameters, "penSize", 1.0, 200.0)
    .onChange(onPenSize)
    .name("pen size");
gui.add(parameters, "scale", 1, 8)
    .onChange(resize).step(1);
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
canvas.width = window.innerWidth / parameters.scale;
canvas.height = window.innerHeight / parameters.scale;
$.get("vertex.glsl", mapResource("vertex"));
$.get("simulate.glsl", mapResource("simulate"));
$.get("colormap.glsl", mapResource("colormap"));
$.get("preview.glsl", mapResource("preview"));