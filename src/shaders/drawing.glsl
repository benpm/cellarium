#version 300 es
/** Fragment shader for drawing on the simulation texture */

precision mediump float;

in vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0
uniform highp usampler2D uStates;     // Input states texture
uniform vec2 uSize;             // Size of simulation canvas in pixels
uniform vec4 uMouse;            // Mouse: Position, state, radius
out uvec4 fragColor;

void main(void) {
    fragColor = texture(uStates, vTextureCoord);

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
            fragColor.a = uint(uMouse.z);
        }
    }
}