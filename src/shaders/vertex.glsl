#version 300 es

in vec2 aVertexPosition;
out vec2 vTextureCoord;

void main() {
    gl_Position = vec4(aVertexPosition, 0.0, 1.0);
    vTextureCoord = aVertexPosition / 2.0 + vec2(0.5, 0.5);
}