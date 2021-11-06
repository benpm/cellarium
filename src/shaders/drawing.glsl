#version 300 es
/** Fragment shader for drawing on the simulation texture */

precision mediump float;

in vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0
uniform highp usampler2D uSampler;     // Input states texture
uniform vec2 uSize;             // Size of simulation canvas in pixels
uniform vec4 uMouse;            // Position of mouse, plus left / right button states
out uvec3 fragColor;

void main(void) {
    uint state = texture(uSampler, vTextureCoord).r;

    // Calculate toroidal distance to mouse
    vec2 pixPos = floor(vTextureCoord * uSize);
    float pMouseDist = uMouse.w * 2.0;
    for (int x = -1; x <= 1; x += 1) {
        for (int y = -1; y <= 1; y += 1) {
            pMouseDist = min(pMouseDist, distance(pixPos, (uMouse.xy - vec2(x, y)) * uSize));
        }
    }

    // Mouse click adds cells
    if (floor(pMouseDist) < uMouse.w) {
        if (uMouse.z > -1.0) {
            state = uint(uMouse.z);
        }
    }

    // Output new state
    fragColor = uvec3(state);
}