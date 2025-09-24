import { SHADERS } from "./constants.js";
import { loadShaderData, loadSongManifest } from "./loaders.js";
import { getDomElements } from "./domElements.js";
import { createVisualizer } from "./visualizer.js";
import { createPlayerControls } from "./playerControls.js";

async function init() {
  const shaderData = await loadShaderData(SHADERS);
  const songManifest = await loadSongManifest();

  const defaultShader = shaderData.Boxes ? "Boxes" : Object.keys(shaderData)[0];
  const defaultConfig = shaderData[defaultShader]?.settings ?? {};

  const elements = getDomElements();
  const initialVolume = parseFloat(elements.volumeEl?.value ?? "1");

  const visualizer = createVisualizer({
    audioEl: elements.audioEl,
    shaderData,
    defaultShader,
    defaultConfig,
    initialVolume
  });

  const playerControls = createPlayerControls({
    audio: visualizer.audio,
    audioEl: elements.audioEl,
    mediaElementSourceNode: visualizer.mediaElementSourceNode,
    elements,
    onMicActiveChange: visualizer.setMicActive
  });

  playerControls.setSongManifest(songManifest);
  playerControls.loadInitialTrack();

  window.addEventListener("beforeunload", () => {
    playerControls.dispose();
    visualizer.dispose();
  });
}

init().catch((error) => console.error(error));
