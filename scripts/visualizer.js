import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.module.js";

export function createVisualizer({
  audioEl,
  shaderData,
  defaultShader,
  defaultConfig,
  initialVolume
}) {
  // Scene setup
  const scene = new THREE.Scene();
  const camera = new THREE.Camera();
  camera.position.z = 1;

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);

  // Audio setup
  const listener = new THREE.AudioListener();
  camera.add(listener);

  const audio = new THREE.Audio(listener);
  audio.setMediaElementSource(audioEl);
  const mediaElementSourceNode = audio.source;
  const normalizedVolume = Number.isFinite(initialVolume) ? initialVolume : 1;
  audio.setVolume(normalizedVolume);
  audioEl.volume = normalizedVolume;

  const analyser = new THREE.AudioAnalyser(audio, 512);
  const fftSize = analyser.analyser.frequencyBinCount;

  // FFT texture
  const audioDataTex = new THREE.DataTexture(
    new Uint8Array(fftSize * 4),
    fftSize,
    1,
    THREE.RGBAFormat
  );
  audioDataTex.needsUpdate = true;
  const audioPixels = audioDataTex.image.data;

  const settings = {
    shader: defaultShader,
    speed: defaultConfig.speed ?? 1.0,
    sensitivity: defaultConfig.sensitivity ?? 2.0,
    brightness: defaultConfig.brightness ?? 2.5,
    color: defaultConfig.color ?? "#cc99ff"
  };

  const uniforms = {
    iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
    iTime: { value: 0 },
    iChannelTime: { value: [0, 0, 0, 0] },
    iChannel0: { value: audioDataTex },
    uSensitivity: { value: settings.sensitivity },
    uBrightness: { value: settings.brightness },
    uColor: { value: new THREE.Color(settings.color) }
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: shaderData[settings.shader]?.fragment ?? ""
  });

  // Fullscreen quad
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), material);
  scene.add(quad);

  const gui = new GUI({ width: 300 });
  gui.domElement.style.position = "absolute";
  gui.domElement.style.top = "10px";
  gui.domElement.style.right = "10px";
  gui.domElement.style.zIndex = "20";

  let speedController;
  let sensitivityController;
  let brightnessController;
  let colorController;

  const applyShaderConfig = (config) => {
    if (!config) return;
    if (config.speed !== undefined && speedController) {
      speedController.setValue(config.speed);
    }
    if (config.sensitivity !== undefined && sensitivityController) {
      sensitivityController.setValue(config.sensitivity);
    }
    if (config.brightness !== undefined && brightnessController) {
      brightnessController.setValue(config.brightness);
    }
    if (config.color !== undefined && colorController) {
      colorController.setValue(config.color);
    }
  };

  gui
    .add(settings, "shader", Object.keys(shaderData))
    .name("Shader")
    .onChange((value) => {
      settings.shader = value;
      material.fragmentShader = shaderData[value]?.fragment ?? "";
      material.needsUpdate = true;
      applyShaderConfig(shaderData[value]?.settings);
    });

  speedController = gui
    .add(settings, "speed", 0.05, 5.0, 0.05)
    .name("Time speed")
    .onChange((value) => {
      settings.speed = value;
    });

  sensitivityController = gui
    .add(settings, "sensitivity", 0.1, 10.0, 0.05)
    .name("Sensitivity")
    .onChange((value) => {
      settings.sensitivity = value;
      uniforms.uSensitivity.value = value;
    });

  brightnessController = gui
    .add(settings, "brightness", 0.1, 10.0, 0.05)
    .name("Brightness")
    .onChange((value) => {
      settings.brightness = value;
      uniforms.uBrightness.value = value;
    });

  colorController = gui
    .addColor(settings, "color")
    .name("Color")
    .onChange((value) => {
      settings.color = value;
      uniforms.uColor.value.set(value);
    });

  applyShaderConfig(defaultConfig);

  const handleResize = () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1.0);
  };
  window.addEventListener("resize", handleResize);

  const unlockAudioContext = () => {
    const ctx = THREE.AudioContext.getContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
  };
  document.body.addEventListener("click", unlockAudioContext);

  const clock = new THREE.Clock();
  let shaderTime = 0;
  let micActive = false;

  const animate = () => {
    requestAnimationFrame(animate);

    const delta = clock.getDelta();
    shaderTime += delta * settings.speed;
    uniforms.iTime.value = shaderTime;
    uniforms.iChannelTime.value[0] = micActive ? shaderTime : audioEl.currentTime;

    analyser.getFrequencyData();
    const freqData = analyser.data;
    for (let i = 0; i < freqData.length; i += 1) {
      const offset = i * 4;
      audioPixels[offset] = freqData[i];
      audioPixels[offset + 1] = 0;
      audioPixels[offset + 2] = 0;
      audioPixels[offset + 3] = 255;
    }
    audioDataTex.needsUpdate = true;

    renderer.render(scene, camera);
  };
  animate();

  const setMicActive = (active) => {
    micActive = active;
  };

  const dispose = () => {
    window.removeEventListener("resize", handleResize);
    document.body.removeEventListener("click", unlockAudioContext);
    gui.destroy();
    renderer.dispose();
    if (renderer.domElement.parentElement) {
      renderer.domElement.parentElement.removeChild(renderer.domElement);
    }
  };

  return {
    audio,
    analyser,
    uniforms,
    settings,
    setMicActive,
    applyShaderConfig,
    mediaElementSourceNode,
    dispose
  };
}
