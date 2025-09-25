precision mediump float;

uniform vec3      iResolution;
uniform float     iTime;
uniform float     iChannelTime[4];
uniform sampler2D iChannel0;
uniform float     uSensitivity;
uniform float     uBrightness;
uniform vec3      uColor;

const float DET = 0.005;
const float MAX_DIST = 50.0;
const float PI = 3.14159265;

float globalGlow = 0.0;
vec2 cellId;

float hash12(vec2 p) {
    p *= 1000.0;
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
}

mat2 rot(float angle) {
    float s = sin(angle);
    float c = cos(angle);
    return mat2(c, s, -s, c);
}

float boxSdf(vec3 p, vec3 halfExtents) {
    vec3 q = abs(p) - halfExtents;
    return length(max(q, vec3(0.0))) - min(0.0, max(q.z, max(q.x, q.y)));
}

int fftIndex(float coord) {
    float clamped = clamp(coord, 0.0, 0.999);
    return int(clamped * 512.0);
}

float sampleFft(float coord) {
    return texelFetch(iChannel0, ivec2(fftIndex(coord), 0), 0).r;
}

vec2 angularMod(vec2 p, float segments, float offset, out float segIndex) {
    float radius = length(p) - offset;
    float angle = atan(p.x, p.y) / PI * segments * 0.5;
    segIndex = abs(floor(angle));
    float wrapped = fract(angle) - 0.5;
    return vec2(wrapped, radius);
}

float ring(vec3 p, inout vec2 idData) {
    p.xy = angularMod(p.xy, 20.0, 2.0, idData.x);

    float bandSeed = fract(idData.x * 0.2 + idData.y * 0.1);
    float audioBand = sampleFft(0.25 + bandSeed * 0.5);
    float h = max(0.0, audioBand * uSensitivity * 3.0 - 0.5);
    h += sin(iTime * 10.0 + idData.x) * 0.2;

    float distance = boxSdf(p + vec3(0.0, -h * 1.5, 0.0), vec3(0.1, h, 0.1));
    return distance * 0.5;
}

float distanceEstimator(vec3 p) {
    float distance = 100.0;
    vec3 q = p;
    q.xz *= rot(iTime);
    q.yz *= rot(sin(iTime));

    float ringCount = 4.0;
    vec2 ids = vec2(0.0);
    for (float i = 0.0; i < ringCount; i += 1.0) {
        q.xz *= rot(PI / ringCount);
        ids.y = i;
        float ringDistance = ring(q, ids);
        if (ringDistance < distance) {
            distance = ringDistance;
            cellId = ids;
        }
    }

    distance = min(distance, length(q) - 1.5);
    return distance * 0.7;
}

vec3 surfaceNormal(vec3 p) {
    vec2 e = vec2(0.0, DET);
    return normalize(vec3(
        distanceEstimator(p + e.yxx),
        distanceEstimator(p + e.xyx),
        distanceEstimator(p + e.xxy)
    ) - distanceEstimator(p));
}

vec3 march(vec3 from, vec3 dir) {
    float dist;
    float totalDist = 0.0;
    vec3 p;
    vec3 color = vec3(0.0);
    globalGlow = 0.0;

    for (int i = 0; i < 100; i++) {
        p = from + totalDist * dir;
        dist = distanceEstimator(p);
        if (dist < DET || totalDist > MAX_DIST) {
            break;
        }
        totalDist += dist;
        globalGlow += 0.1 / (10.0 + dist * dist * 10.0) * step(0.7, hash12(cellId + floor(iTime * 5.0)));
    }

    if (dist < DET) {
        vec3 cellColor = vec3(hash12(cellId), hash12(cellId + 123.123), 1.0);
        p -= dir * DET;
        vec3 normal = surfaceNormal(p);
        color = 0.1 + max(0.0, dot(-dir, normal)) * cellColor;
        color *= 0.5 + step(0.7, hash12(cellId + floor(iTime * 5.0)));
    } else {
        dir.xz *= rot(iTime * 0.5);
        dir.yz *= rot(iTime * 0.25);
        vec2 uv = abs(0.5 - fract(dir.yz));
        float minShine = 100.0;
        float iterIndex = 0.0;
        for (int i = 0; i < 10; i++) {
            uv = abs(uv * 1.3) * rot(radians(45.0)) - 0.5;
            float shine = length(max(vec2(0.0), abs(uv) - 0.05));
            if (shine < minShine) {
                minShine = shine;
                iterIndex = float(i);
            }
        }
        color += smoothstep(0.05, 0.0, minShine) * fract(iterIndex * 0.1 + iTime) * normalize(p + 50.0);
    }

    vec3 modulated = color * mod(gl_FragCoord.y, 4.0) * 0.5 + vec3(globalGlow);
    modulated *= uColor;
    modulated *= uBrightness;
    return modulated;
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv = (fragCoord - iResolution.xy * 0.5) / iResolution.y;
    vec3 eye = vec3(0.0, 0.0, -8.0);
    vec3 dir = normalize(vec3(uv, 0.7));
    vec3 col = march(eye, dir);
    fragColor = vec4(col, 1.0);
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
