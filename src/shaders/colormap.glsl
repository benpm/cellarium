#version 300 es
/** Fragment shader that maps cellular automata states to nice colors and handles camera */

precision mediump float;

in vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0
uniform highp usampler2D uStates;     // Simulation texture
uniform sampler2D uColorMap;    // Colors to be used for states
uniform vec3 uCam;              // Camera: x, y (pixels), zoom
uniform vec2 uScreen;           // Screen size in pixels
uniform vec2 uSimSize;          // Size of the simulation texture
uniform highp int uRenderSeP;        // Render States else Paint - truthy switch
// uniform vec4 uMouse;            // Mouse: x, y, z=pen state (-1 indicates 'no state'), w=pen size

out vec4 fragColor;

vec4 colorFromState(uint state) {
    return texture(uColorMap, vec2((float(state) + 0.5) / 14.0, 0.5));
}

void main(void) {
    // Grab coordinate into simulation texture
    vec2 coord = (uCam.xy + (vTextureCoord * (uScreen / uCam.z))) / uSimSize;

    if(bool(uRenderSeP)) {
    // if (false) {
        // Get automaton state
        uint state = texture(uStates, coord).a;
        // Reference colormap tex to draw color to screen
        fragColor = colorFromState(state);
    } else {
        uvec4 here = texture(uStates, coord);
        vec3 colorComponent = vec3(here.rgb)/255.0;
        float alphaComponent = 0.1;
        if (int(here.a) > 0){
            alphaComponent = 1.0;
        }

        // fragColor = vec4(colorComponent, 0.5);
        fragColor = vec4(colorComponent, alphaComponent);
        // fragColor = vec4(vec3(here.rgba)/255.0, 0.1 + (0.9 * float(int(bool(here.a))));
    }

}