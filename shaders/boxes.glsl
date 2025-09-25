precision mediump float;

uniform vec3      iResolution;
uniform float     iTime;
uniform float     iChannelTime[4];
uniform sampler2D iChannel0;
uniform float     uSensitivity;
uniform float     uBrightness;
uniform vec3      uColor;

#define st(t1, t2, v1, v2) mix(v1, v2, smoothstep(t1, t2, iTime))
#define light(d, att) 1. / (1.+pow(abs(d*att), 1.3))

/* Audio-related functions */
#define getLevel(x) (texelFetch(iChannel0, ivec2(int(x*512.), 0), 0).r)
#define logX(x,a,c) (1./(exp(-a*(x-c))+1.))

float logisticAmp(float amp){
   float c = st(0., 10., .8, 1.), a = 20.;  
   return (logX(amp, a, c) - logX(0.0, a, c)) / (logX(1.0, a, c) - logX(0.0, a, c));
}
float getPitch(float freq, float octave){
   freq = pow(2., freq)   * 261.;
   freq = pow(2., octave) * freq / 12000.;
   return logisticAmp(getLevel(freq));
}
float getVol(float samples) {
    float avg = 0.;
    for (float i = 0.; i < samples; i++) avg += getLevel(i/samples);
    return avg / samples;
}

float sdBox(vec3 p, vec3 b) {
  vec3 q = abs(p) - b;
  return length(max(q,0.0)) + min(max(q.x,max(q.y,q.z)),0.0);
}
float hash13(vec3 p3) {
    p3  = fract(p3 * .1031);
    p3 += dot(p3, p3.zyx + 31.32);
    return fract((p3.x + p3.y) * p3.z);
}

void mainImage(out vec4 fragColor, in vec2 fragCoord) {
    vec2 uv   = (2.0*fragCoord - iResolution.xy) / iResolution.y;
    vec3 col  = vec3(0.0);
    float vol = clamp(getVol(8.0) * uSensitivity, 0.0, 5.0);

    float hasSound = 1.0;
    if (iChannelTime[0] <= 0.0) hasSound = 0.0;

    for (float i = 0.0, t = 0.0; i < 30.0; i++) {
        vec3 p  = t*normalize(vec3(uv, 1.0));        
        vec3 id = floor(abs(p));
        vec3 q  = fract(p) - 0.5;

        float boxRep = sdBox(q, vec3(0.3));
        float boxCtn = sdBox(p, vec3(7.5, 6.5, 16.5));

        float dst = max(boxRep, abs(boxCtn) - vol*0.2);     
        float freq = smoothstep(16.0, 0.0, id.z)*3.0*hasSound + hash13(id)*1.5;
       
        col += vec3(0.8,0.6,1.0) * (cos(id*0.4 + vec3(0,1,2) + iTime) + 2.0) 
             * light(dst, 10.0 - vol) 
             * getPitch(freq, 1.0);
        
        t += dst;
    }

    col *= uColor;
    col *= uBrightness;

    fragColor = vec4(col,1.0);   
}

void main() {
    mainImage(gl_FragColor, gl_FragCoord.xy);
}
