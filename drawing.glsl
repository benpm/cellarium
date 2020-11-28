/** Fragment shader for drawing on the simulation texture */

precision mediump float;

varying vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0
uniform sampler2D uSampler;     // Input states texture
uniform vec2 uSize;             // Size of simulation canvas in pixels
uniform vec4 uMouse;            // Position of mouse, plus left / right button states

// Convert floating point num to byte
int fbyte(float n) {
    return int(floor(n * 255.0));
}

// Get state of cell at texture position
int get(vec2 pos) {
    return fbyte(texture2D(uSampler, pos).r);
}

void main(void) {
    int state = get(vTextureCoord);

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
            state = int(uMouse.z);
        }
    }

    // Output new state
    gl_FragColor = vec4(vec3(float(state) / 255.0), 1.0);
}