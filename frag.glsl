precision mediump float;

varying vec2 vTextureCoord;//The coordinates of the current pixel
uniform sampler2D uSampler;//The image data
uniform sampler2D uRule;//The cellular automata rule
uniform float uTime;
uniform float uWidth;
uniform float uHeight;
uniform vec4 uMouse;

int get(vec2 pos) {
    return int(ceil(texture2D(uSampler, pos).r));
}

void main(void) {
    vec2 pSize = vec2(1.0 / uWidth, 1.0 / uHeight);
    float pMouseDist = distance(vTextureCoord * vec2(uWidth, uHeight), uMouse.xy * vec2(uWidth, uHeight));
    int val = get(vTextureCoord);
    int total = -val;
    for (int x = -1; x <= 1; x += 1) {
        for (int y = -1; y <= 1; y += 1) {
            total += get(vTextureCoord + pSize * vec2(x, y));
        }
    }
    if (uMouse.z == 0.0 && pMouseDist < uMouse.w) {
        val = 1;
    } else if (uMouse.z == 2.0 && pMouseDist < uMouse.w) {
        val = 0;
    } else {
        val = int(ceil(texture2D(uRule, vec2((float(val * 9 + total) + 0.5) / 18.0, 0.5)).r));
    }
    gl_FragColor = vec4(vec3(float(val)), 1.0);
}