precision mediump float;

uniform vec3      iResolution;
uniform float     iTime;
uniform float     iChannelTime[4];
uniform sampler2D iChannel0;
uniform float     uSensitivity;
uniform float     uBrightness;
uniform vec3      uColor;

// Shader implementation provided by user
float det = 0.005;
float maxdist = 50.0;
float pi = 3.1416;
float gl = 0.0;
vec2 id;

float hash12(vec2 p) {
    p *= 1000.0;
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 rot(float a) {
    float s = sin(a);
    float c = cos(a);
    return mat2(c, s, -s, c);
}

float box(vec3 p, vec3 c) {
    vec3 pc = abs(p) - c;
    return length(max(vec3(0.0), pc)) - min(0.0, max(pc.z, max(pc.x, pc.y)));
}

vec2 amod(vec2 p, float n, float off, out float i) {
    float l = length(p) - off;
    float at = atan(p.x, p.y) / pi * n * 0.5;
    i = abs(floor(at));
    float a = fract(at) - 0.5;
    return vec2(a, l);
}

float ring(vec3 p, inout vec2 idIn) {
    p.xy = amod(p.xy * rot(iTime * 0.0), 20.0, 2.0, idIn.x);
    float sample = texture2D(iChannel0, vec2(0.5 + fract(idIn.x * 0.2 + idIn.y * 0.1), 0.0) * 0.5).r;
    float h = max(0.0, sample * 3.0 - 0.5);
    h += sin(iTime * 10.0 + idIn.x) * 0.2;
    float d = box(p + vec3(0.0, -h * 1.5, 0.0), vec3(0.1, h, 0.1));
    return d * 0.5;
}

float de(vec3 p) {
    float d = 100.0;
    p.xz *= rot(iTime);
    p.yz *= rot(sin(iTime));
    float r = 4.0;
    vec2 ids;
    for (float i = 0.0; i < r; i++) {
        p.xz *= rot(pi / r);
        ids.y = i;
        float ri = ring(p, ids);
        if (ri < d) {
            d = ri;
            id = ids;
        }
    }
    d = min(d, length(p) - 1.5);
    return d * 0.7;
}

vec3 normal(vec3 p) {
    vec2 e = vec2(0.0, det);
    return normalize(vec3(de(p + e.yxx), de(p + e.xyx), de(p + e.xxy)) - de(p));
}

vec3 march(vec3 from, vec3 dir) {
    float d;
    float td = 0.0;
    vec3 p;
    vec3 col = vec3(0.0);
    gl = 0.0;
    for (int i = 0; i < 100; i++) {
        p = from + td * dir;
        d = de(p);
        if (d < det || td > maxdist) break;
        td += d;
        gl += 0.1 / (10.0 + d * d * 10.0) * step(0.7, hash12(id + floor(iTime * 5.0)));
    }
    if (d < det) {
        vec3 colid = vec3(hash12(id), hash12(id + 123.123), 1.0);
        p -= dir * det;
        vec3 n = normal(p);
        col = 0.1 + max(0.0, dot(-dir, n)) * colid;
        col *= 0.5 + step(0.7, hash12(id + floor(iTime * 5.0)));
    } else {
        dir.xz *= rot(iTime * 0.5);
        dir.yz *= rot(iTime * 0.25);
        vec2 p2 = abs(0.5 - fract(dir.yz));
        float d2 = 100.0;
        float is = 0.0;
        for (int i = 0; i < 10; i++) {
            p2 = abs(p2 * 1.3) * rot(radians(45.0)) - 0.5;
            float sh = length(max(vec2(0.0), abs(p2) - 0.05));
            if (sh < d2) {
                d2 = sh;
                is = float(i);
            }
        }
        col += smoothstep(0.05, 0.0, d2) * fract(is * 0.1 + iTime) * normalize(p + 50.0);
    }
    return col * mod(gl_FragCoord.y, 4.0) * 0.5 + gl;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    vec3 from = vec3(0.0, 0.0, -8.0);
    vec3 dir = normalize(vec3(uv, 0.7));
    vec3 col = march(from, dir);
    col *= uColor;
    col *= uBrightness;
    fragColor = vec4(col, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
