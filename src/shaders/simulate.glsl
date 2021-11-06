#version 300 es
/** Fragment shader that simulates multistate totalistic cellular automata */

precision mediump float;

uniform highp usampler2D uSampler;     // Input states texture
uniform highp usampler2D uRule;        // The cellular automata rule
uniform highp usampler2D uBinomial;    // Pre-computed binomial coefficents (n and k up to 32)
uniform vec2 uSize;             // Size of simulation canvas in pixels
uniform int uStates;            // Number of states in this rule (MAX 14)
uniform int uSubIndices;        // Number pf subrule indices

in vec2 vTextureCoord;     // Texture coordinates 0.0 to 1.0

out uvec3 fragColor;

// Returns binomial coefficient (n choose k) from precompute texture
int binomial(int n, int k) {
    return int(texelFetch(uBinomial, ivec2(n, k), 0).r);
}

void main(void) {
    // Texel coordinate
    ivec2 pTexCoord = ivec2(vTextureCoord.xy * uSize.xy);

    int curstate = int(texture(uSampler, vTextureCoord).r);

    // Counts of each neighbor type
    int nCounts[14] = int[](0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    nCounts[curstate] = -1;

    // Determine neighbor counts
    for (int x = -1; x <= 1; x += 1) {
        for (int y = -1; y <= 1; y += 1) {
            uint v = texture(uSampler, vTextureCoord + (vec2(x, y) / uSize)).r;
            nCounts[v] += 1;
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
    uint newstate = texelFetch(uRule, ivec2(ruleIndex % 1024, ruleIndex / 1024), 0).r;

    fragColor = uvec3(newstate);