import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";
import { GUI } from "https://cdn.jsdelivr.net/npm/dat.gui@0.7.9/build/dat.gui.module.js";

const SHADERS = {
  Boxes: {
    fragment: "shaders/fragment.glsl",
    settings: "settings/Boxes.json"
  },
  Waves: {
    fragment: "shaders/wave_lines.glsl",
    settings: "settings/Waves.json"
  }
};

async function fetchText(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${label}: ${response.status} ${response.statusText}`);
  }
  return response.text();
}

async function fetchJSON(url, label) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load ${label}: ${response.status} ${response.statusText}`);
  }
  return response.json();
}

async function loadShaderData(shaderMap) {
  const entries = await Promise.all(
    Object.entries(shaderMap).map(async ([name, { fragment, settings }]) => {
      const [fragmentSource, settingsData] = await Promise.all([
        fetchText(fragment, `${name} shader`),
        fetchJSON(settings, `${name} settings`)
      ]);
      return [name, { fragment: fragmentSource, settings: settingsData }];
    })
  );
  return Object.fromEntries(entries);
}

async function init() {
  const shaderData = await loadShaderData(SHADERS);

  let songManifest = [];
  try {
    songManifest = await fetchJSON("songs/manifest.json", "song manifest");
  } catch (err) {
    console.warn(err);
  }

  const defaultShader = shaderData.Boxes ? "Boxes" : Object.keys(shaderData)[0];
  const defaultConfig = shaderData[defaultShader]?.settings ?? {};

  const audioEl = document.getElementById("audio");
  const playPauseBtn = document.getElementById("playPause");
  const progressEl = document.getElementById("progress");
  const currentTimeEl = document.getElementById("currentTime");
  const durationEl = document.getElementById("duration");
  const trackTitleEl = document.getElementById("track-title");
  const songSelectEl = document.getElementById("songSelect");
  const fileInputEl = document.getElementById("fileInput");
  const volumeEl = document.getElementById("volume");

  let customTrackUrl;

  function formatTime(seconds) {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  }

  function setTrackTitle(title) {
    trackTitleEl.textContent = title || "Untitled";
  }

  function loadTrackFromLibrary(entry, { autoplay = false } = {}) {
    if (!entry) return;
    if (customTrackUrl) {
      URL.revokeObjectURL(customTrackUrl);
      customTrackUrl = undefined;
    }
    audioEl.src = `songs/${entry.file}`;
    audioEl.load();
    songSelectEl.value = entry.file;
    setTrackTitle(entry.name || entry.file);
    if (progressEl) progressEl.value = "0";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (durationEl) durationEl.textContent = "0:00";
    if (autoplay) {
      const promise = audioEl.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    }
  }

  function loadUploadedTrack(file) {
    if (!file) return;
    if (customTrackUrl) {
      URL.revokeObjectURL(customTrackUrl);
    }
    customTrackUrl = URL.createObjectURL(file);
    audioEl.src = customTrackUrl;
    audioEl.load();
    songSelectEl.value = "__custom";
    setTrackTitle(file.name);
    if (progressEl) progressEl.value = "0";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (durationEl) durationEl.textContent = "0:00";
    const promise = audioEl.play();
    if (promise && typeof promise.catch === "function") {
      promise.catch(() => {});
    }
  }

  function populateSongSelect(manifest) {
    if (!songSelectEl) return;
    songSelectEl.innerHTML = "";
    if (manifest && manifest.length) {
      manifest.forEach((entry, index) => {
        const option = document.createElement("option");
        option.value = entry.file;
        option.textContent = entry.name || entry.file;
        option.dataset.index = index.toString();
        songSelectEl.appendChild(option);
      });
    }
    const customOption = document.createElement("option");
    customOption.value = "__custom";
    customOption.textContent = "Uploaded track";
    songSelectEl.appendChild(customOption);
  }

  populateSongSelect(songManifest);

  const initialEntry = songManifest?.[0];
  if (initialEntry) {
    loadTrackFromLibrary(initialEntry, { autoplay: false });
  } else {
    setTrackTitle("Select or upload a track");
    if (songSelectEl) songSelectEl.value = "__custom";
  }

  audioEl.volume = parseFloat(volumeEl?.value ?? "1");

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

  const analyser = new THREE.AudioAnalyser(audio, 512);
  const fftSize = analyser.analyser.frequencyBinCount;

  // FFT texture
  const audioDataTex = new THREE.DataTexture(
    new Uint8Array(fftSize * 4), // RGBA
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

  // Shader material
  const uniforms = {
    iResolution: { value: new THREE.Vector3(window.innerWidth, window.innerHeight, 1.0) },
    iTime: { value: 0 },
    iChannelTime: { value: [0, 0, 0, 0] },
    iChannel0: { value: audioDataTex },
    uSensitivity: { value: 1.0 },
    uBrightness: { value: 1.0 },
    uColor: { value: new THREE.Color("#cc99ff") }
  };

  uniforms.uSensitivity.value = settings.sensitivity;
  uniforms.uBrightness.value = settings.brightness;
  uniforms.uColor.value.set(settings.color);

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      void main() {
        gl_Position = vec4(position, 1.0);
      }
    `,
    fragmentShader: shaderData[settings.shader].fragment
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

  gui
    .add(settings, "shader", Object.keys(shaderData))
    .name("Shader")
    .onChange((value) => {
      settings.shader = value;
      material.fragmentShader = shaderData[value].fragment;
      material.needsUpdate = true;
      applyShaderConfig(shaderData[value].settings);
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

  function applyShaderConfig(config) {
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
  }

  applyShaderConfig(defaultConfig);

  // Resize handling
  window.addEventListener("resize", () => {
    renderer.setSize(window.innerWidth, window.innerHeight);
    uniforms.iResolution.value.set(window.innerWidth, window.innerHeight, 1.0);
  });

  // Render loop
  const clock = new THREE.Clock();
  let shaderTime = 0;
  function animate() {
    requestAnimationFrame(animate);

    // Update time
    const delta = clock.getDelta();
    shaderTime += delta * settings.speed;
    uniforms.iTime.value = shaderTime;
    uniforms.iChannelTime.value[0] = audioEl.currentTime;

    // Update FFT texture
    analyser.getFrequencyData();
    const freqData = analyser.data;
    for (let i = 0; i < freqData.length; i++) {
      const offset = i * 4;
      audioPixels[offset] = freqData[i];
      audioPixels[offset + 1] = 0;
      audioPixels[offset + 2] = 0;
      audioPixels[offset + 3] = 255;
    }
    audioDataTex.needsUpdate = true;

    renderer.render(scene, camera);
  }
  animate();

  // Unlock audio context on click
  document.body.addEventListener("click", () => {
    const ctx = THREE.AudioContext.getContext();
    if (ctx.state === "suspended") ctx.resume();
  });

  window.addEventListener("beforeunload", () => {
    if (customTrackUrl) {
      URL.revokeObjectURL(customTrackUrl);
    }
  });

  playPauseBtn?.addEventListener("click", () => {
    if (audioEl.paused) {
      const promise = audioEl.play();
      if (promise && typeof promise.catch === "function") {
        promise.catch(() => {});
      }
    } else {
      audioEl.pause();
    }
  });

  audioEl.addEventListener("play", () => {
    playPauseBtn.textContent = "❚❚";
    playPauseBtn.setAttribute("aria-label", "Pause");
  });

  audioEl.addEventListener("pause", () => {
    playPauseBtn.textContent = "▶";
    playPauseBtn.setAttribute("aria-label", "Play");
  });

  audioEl.addEventListener("timeupdate", () => {
    if (!progressEl || !durationEl || !currentTimeEl) return;
    const { currentTime, duration } = audioEl;
    currentTimeEl.textContent = formatTime(currentTime);
    if (Number.isFinite(duration) && duration > 0) {
      progressEl.value = ((currentTime / duration) * 1000).toString();
    }
  });

  audioEl.addEventListener("loadedmetadata", () => {
    if (durationEl) durationEl.textContent = formatTime(audioEl.duration);
    if (currentTimeEl) currentTimeEl.textContent = formatTime(audioEl.currentTime);
  });

  audioEl.addEventListener("ended", () => {
    if (playPauseBtn) {
      playPauseBtn.textContent = "▶";
      playPauseBtn.setAttribute("aria-label", "Play");
    }
    if (progressEl) progressEl.value = "0";
    if (currentTimeEl) currentTimeEl.textContent = formatTime(0);
  });

  progressEl?.addEventListener("input", (event) => {
    const target = event.target;
    if (!target || audioEl.duration === 0 || Number.isNaN(audioEl.duration)) return;
    const ratio = parseFloat(target.value) / 1000;
    if (!Number.isFinite(ratio)) return;
    audioEl.currentTime = ratio * audioEl.duration;
  });

  volumeEl?.addEventListener("input", (event) => {
    const value = parseFloat(event.target.value);
    if (Number.isFinite(value)) {
      audioEl.volume = value;
    }
  });

  songSelectEl?.addEventListener("change", () => {
    if (!songSelectEl) return;
    const value = songSelectEl.value;
    if (value === "__custom") {
      if (!customTrackUrl) {
        audioEl.pause();
        audioEl.currentTime = 0;
        setTrackTitle("Upload a track");
      }
      return;
    }
    const entry = songManifest.find((item) => item.file === value);
    loadTrackFromLibrary(entry, { autoplay: true });
  });

  fileInputEl?.addEventListener("change", (event) => {
    const [file] = event.target.files || [];
    if (!file) return;
    loadUploadedTrack(file);
    event.target.value = "";
  });
}

init().catch((err) => console.error(err));
