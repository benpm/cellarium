# What are we doing?
1. Simulate Conway (or some other game with 2 states)
2. Assign each cell an RGB color
3. If a cell transitions from dead to alive, its color becomes the average of the cells which brought it to life
4. What colors arise?

# What is this branch for?
I want to understand what configurations are already present, so that I perform the smallest amount of rework.

# How does it work?
## How do states become colors?
### [sim.ts](../src/sim.ts)

#### `Sim.colorMap`
Comment says "Mapping from state to color". This probably is a collection of RGB values which get assigned to every state which arrives.

That makes sense - if I use the default wireworld sim (4 states), I see cells which are `[black, white, red, green]`, which aligns with the color codes:

```javascript
[
    /* 0  */ 20, 20, 20,
    /* 1  */ 220, 220, 220,
    /* 2  */ 220, 50, 50,
    /* 3  */ 50, 220, 50,
]
```
`Sim.colorMap` gets bound to [`Sim.colorMapTex`](#simcolormaptex), which is its final reference in 'sim.ts'.

#### `Sim.colorMapTex`
`Sim.colorMapTex` is a WebGLTexture which gets bound to [`Sim.colorMap`](#simcolormap). In the (strange and frustrating) WebGL parlance, `Sim.colorMapTex` gets drawn in the [`Sim.colorProgram`](#simcolorprogram).

#### `Sim.colorProgram`
`Sim.colorProgram` is constructed within `Sim.webGLSetup`, which is called within the `Sim` constructor. `Sim.colorProgram` is built when [`Sim.buildShaderProgram`](#simbuildshaderprogram) is passed (wrapped) references to the provided `shaders` argument, which by interpretation arise from [`"colormap"`](#colormap) and [`"vertex"`](#vertex).

#### `Sim.buildShaderProgram`
This is a utility for [creating, compiling, attaching, and linking] shaders to the Sim.

## How do rules get executed?
### [sim.ts](../src/sim.ts)
I don't expect to reuse much or any of the sim code, other than learning from how WebGL gets utilized.
#TODO

## Shaders
[Shaders and GLSL](https://webglfundamentals.org/webgl/lessons/webgl-shaders-and-glsl.html)
[Vertex Shader](https://www.khronos.org/opengl/wiki/Vertex_Shader)

### [`"vertex"`](/src/shaders/vertex.glsl)

From a rough insepction, this maps R^2 vectors in $[-1,1]$ to R^4 values in $[0,1]$ and fills the last 2 dims with $[0, 1]$.

Based on some basic research, this seems reasonable, so I'll assume there's a coordinate-space transform we care about.

### [`"colormap"`](/src/shaders/colormap.glsl)

**Fragment shader that maps cellular automata states to nice colors and handles camera**
Honestly, this is super readable. Transform camera coords into sim coords, get state then color, update based on the mouse coords&clicks.

### [`"simulate"`](/src/shaders/simulate.glsl)
**Fragment shader that simulates multistate totalistic cellular automata**
I know from some prior reading that this is *way* cooler than I care about. I'll leave the 'cool' alone and just read it for syntax.