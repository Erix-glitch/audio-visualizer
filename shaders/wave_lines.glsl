precision mediump float;

uniform vec3      iResolution;
uniform float     iTime;
uniform float     iChannelTime[4];
uniform sampler2D iChannel0;
uniform float     uSensitivity;
uniform float     uBrightness;
uniform vec3      uColor;

float line(float top, float bottom, float sharpen, vec2 uv) {
    sharpen = 0.05 * smoothstep(0.6, 1.0, uv.x) + 0.05 * smoothstep(0.3, 0.0, uv.x);
    return smoothstep(top, top + sharpen, uv.y) - smoothstep(bottom, bottom + sharpen, uv.y);
}

float wave(float time, vec2 uv, float phase) {
    float waveValue = sin(time + uv.x * phase);
    float blur = 0.01 * smoothstep(0.5, 0.0, abs(uv.x - 0.5));
    uv.y += phase * blur * waveValue;
    return line(0.495, 0.505, 0.01, uv);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = fragCoord / iResolution.xy;

    float audio = texture(iChannel0, vec2(clamp(uv.x, 0.0, 1.0), 0.0)).r;
    audio = clamp(audio * uSensitivity, 0.0, 4.0);

    float line1 = wave(iTime * 3.0, uv, 10.0 + sin(iTime) * 1.5);
    float line2 = wave(iTime * 4.0, uv, 13.0 + sin(iTime + 2.0) * 3.0);
    float line3 = wave(iTime * 5.0, uv, 20.0 + sin(iTime + 3.0) * 3.0);

    vec3 col1 = vec3(1.0, 0.1, 0.2) * line1;
    vec3 col2 = vec3(0.8, 0.4, 0.2) * line2;
    vec3 col3 = vec3(0.3, 0.2, 0.9) * line3;
    vec3 col = 4.0 * audio * (col1 + col2 + col3);

    col *= uColor;
    col *= uBrightness;

    fragColor = vec4(col, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
