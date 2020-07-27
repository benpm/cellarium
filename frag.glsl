precision mediump float;

varying vec2 vTextureCoord;//The coordinates of the current pixel
uniform sampler2D uSampler;//The image data
uniform sampler2D uRule;//The cellular automata rule
uniform float uTime;
uniform float uWidth;
uniform float uHeight;
uniform vec4 uMouse;

// Get cell occupancy
int get(vec2 pos) {
    return int(ceil(texture2D(uSampler, pos).r));
}

void main(void) {
    // Size of a pixel
    vec2 pSize = vec2(1.0 / uWidth, 1.0 / uHeight);
    // Distance to mouse
    float pMouseDist = distance(floor(vTextureCoord * vec2(uWidth, uHeight)), floor(uMouse.xy * vec2(uWidth, uHeight)));
    // Offset for current cell occupancy
    int val = get(vTextureCoord);
    int total = -val;
    // Determine total number of alive neighbors
    for (int x = -1; x <= 1; x += 1) {
        for (int y = -1; y <= 1; y += 1) {
            total += get(vTextureCoord + pSize * vec2(x, y));
        }
    }
    // Left click and right click to add cells, funky stuff to avoid branching
    bool leftClick = (uMouse.z == 0.0 && floor(pMouseDist) < uMouse.w);
    bool rightClick = (uMouse.z == 2.0 && floor(pMouseDist) < uMouse.w);
    // Determine the value of the cell by accessing the rule texture
    val = (int(ceil(texture2D(uRule, vec2((float(val * 9 + total) + 0.5) / 18.0, 0.5)).r))
          + int(leftClick) * 1) * int(!rightClick);
    gl_FragColor = vec4(vec3(float(val)), 1.0);
}