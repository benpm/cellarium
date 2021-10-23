/** Fragment shader that simulates multistate totalistic cellular automata */

precision mediump float;

varying vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0
uniform sampler2D uSampler;     // Input states texture
uniform sampler2D uRule;        // The cellular automata rule
uniform sampler2D uBinomial;    // Pre-computed binomial coefficents (n and k up to 32)
uniform vec2 uSize;             // Size of simulation canvas in pixels
uniform int uStates;            // Number of states in this rule (MAX 14)
uniform int uSubIndices;        // Number pf subrule indices

// Convert floating point num to byte
int fbyte(float n) {
    return int(floor(n * 255.0));
}

// Returns binomial coefficient (n choose k) from precompute texture
int binomial(int n, int k) {
    ivec4 val = ivec4(floor(texture2D(uBinomial, vec2(
        (float(n) + 0.5) / 32.0,
        (float(k) + 0.5) / 32.0
    )) * 255.0 + 0.5));
    return val.a * 16777216 + val.b * 65536 + val.g * 256 + val.r;
}

// Get state of cell at texture position
int get(vec2 pos) {
    return fbyte(texture2D(uSampler, pos).r);
}

void main(void) {
    int curstate = get(vTextureCoord);

    // Counts of each neighbor type
    int nCounts[14];
    for (int i = 0; i < 14; i++) {
        if (i == curstate) {
            nCounts[i] = -1;
        } else {
            nCounts[i] = 0;
        }
    }
    // Size of a pixel in texture coordinates
    vec2 pSize = 1.0 / uSize;

    // Determine neighbor counts
    for (int x = -1; x <= 1; x += 1) {
        for (int y = -1; y <= 1; y += 1) {
            int v = get(vTextureCoord + pSize * vec2(x, y));
            for (int i = 0; i < 14; i++) {
                if (i == v) {
                    nCounts[i] += 1;
                    break;
                }
            }
        }
    }

    // Determine the 1D index into the rule texture
    int subIndex = 0;
    int y = 8;
    for (int i = 1; i < 14; i++) {
        int v = nCounts[i];
        if (v > 0) {
            int x = uStates - i;
            subIndex += binomial(y + x, x) - binomial(y - v + x, x);
        }
        y -= v;
    }
    // Compute final rule index given current state and neighbor states
    int ruleIndex = curstate * uSubIndices + subIndex;
    // Convert 1D rule index into 2D coordinate into rule texture
    int newstate = int(floor(texture2D(uRule,
        vec2(
            (mod(float(ruleIndex), 1024.0) + 0.5) / 1024.0,
            (floor(float(ruleIndex) / 1024.0) + 0.5) / 1024.0
        )).r * 255.0 + 0.5));

    // Output new state
    gl_FragColor = vec4(vec3(float(newstate) / 255.0), 1.0);
}