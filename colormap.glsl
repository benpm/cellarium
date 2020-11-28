/** Fragment shader that maps cellular automata states to nice colors and handles camera */

precision mediump float;

varying vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0
uniform sampler2D uSampler;     // Simulation texture
uniform sampler2D uColorMap;    // Colors to be used for states
uniform vec3 uCam;              // Camera: x, y (pixels), zoom
uniform vec2 uScreen;           // Screen size in pixels
uniform vec2 uSimSize;          // Size of the simulation texture
uniform vec4 uMouse;            // Position of mouse on screen, plus left / right button states

vec4 colorFromState(float state) {
    return texture2D(uColorMap, vec2((state + 0.5) / 14.0, 0.5));
}

void main(void) {
    // Grab coordinate into simulation texture
    vec2 coord = uCam.xy + (vTextureCoord * (uScreen / uCam.z));
    // Get automaton state
    float state = floor(texture2D(uSampler, coord / uSimSize).r * 255.0 + 0.5);
    // Reference colormap tex to draw color to screen
    gl_FragColor = colorFromState(state);

    // Calculate toroidal distance to mouse
    vec2 offset = mod(uCam.xy, vec2(1.0));
    float pMouseDist = distance(
        ceil((vTextureCoord * uScreen) / uCam.z + offset),
        ceil((uMouse.xy) / uCam.z + offset)
    );

    // Mouse click adds cells
    if (floor(pMouseDist + 1.0) == ceil(uMouse.w)) {
        gl_FragColor = colorFromState(uMouse.z);
    }
}