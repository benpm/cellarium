/** Fragment shader that maps cellular automata states to nice colors and handles camera */

precision mediump float;

varying vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0
uniform sampler2D uSampler;     // Simulation texture
uniform sampler2D uColorMap;    // Colors to be used for states
uniform vec3 uCam;              // Camera: x, y (pixels), zoom
uniform vec2 uScreen;           // Screen size in pixels
uniform vec2 uSimSize;          // Size of the simulation texture

void main(void) {
    vec2 coord = uCam.xy + (vTextureCoord * (uScreen / uCam.z));
    float state = floor(texture2D(uSampler, coord / uSimSize).r * 255.0 + 0.5);
    gl_FragColor = texture2D(uColorMap, vec2((state + 0.5) / 14.0, 0.5));
}