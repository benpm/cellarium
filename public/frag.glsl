precision mediump float;

varying vec2 vTextureCoord;//The coordinates of the current pixel
uniform sampler2D uSampler;//The image data
uniform float uTime;
uniform float uWidth;
uniform float uHeight;
uniform vec4 uMouse;

void main(void) {
    vec2 pSize = vec2(1.0 / uWidth, 1.0 / uHeight);
    float pMouseDist = distance(vTextureCoord * vec2(uWidth, uHeight), uMouse.xy * vec2(uWidth, uHeight));
    int val = int(clamp(texture2D(uSampler, vTextureCoord).r * 4.0, 0.0, 1.0));
    int n = -val;
    for (int x = -1; x <= 1; x += 1) {
        for (int y = -1; y <= 1; y += 1) {
            n += int(clamp(texture2D(uSampler, 
                vec2(vTextureCoord.x + (pSize.x * float(x)), vTextureCoord.y + (pSize.y * float(y)))).r * 4.0, 0.0, 1.0));
        }
    }
    if (val == 0) {
        val = n == 3 ? 1 : 0;
    } else {
        val = n >= 2 && n <= 3 ? 1 : 0;
    }
    if (uMouse.z == 0.0 && pMouseDist < uMouse.w) {
        val = 1;
    } else if (uMouse.z == 2.0 && pMouseDist < uMouse.w) {
        val = 0;
    }
    gl_FragColor = vec4(vec3(float(val)), 1.0);
}