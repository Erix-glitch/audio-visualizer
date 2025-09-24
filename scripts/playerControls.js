import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.180.0/build/three.module.js";

export function createPlayerControls({
  audio,
  audioEl,
  mediaElementSourceNode,
  elements,
  onMicActiveChange
}) {
  const {
    playPauseBtn,
    progressEl,
    currentTimeEl,
    durationEl,
    trackTitleEl,
    songSelectEl,
    fileInputEl,
    volumeEl,
    micButtonEl,
    uploadLabelEl
  } = elements;

  let songManifest = [];
  let customTrackUrl;
  let micStream;
  let micActive = false;
  let resumePlaybackAfterMic = false;
  let micToggleInFlight = false;
  let lastLoadedTrackTitle = trackTitleEl?.textContent || "Untitled";

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const refreshTrackTitleDisplay = () => {
    if (!trackTitleEl) return;
    trackTitleEl.textContent = micActive ? "Microphone" : lastLoadedTrackTitle;
  };

  const setTrackTitle = (title) => {
    lastLoadedTrackTitle = title || "Untitled";
    if (!micActive) {
      refreshTrackTitleDisplay();
    }
  };

  const disposeCustomTrack = () => {
    if (customTrackUrl) {
      URL.revokeObjectURL(customTrackUrl);
      customTrackUrl = undefined;
    }
  };

  const resetPlaybackIndicators = () => {
    if (progressEl) progressEl.value = "0";
    if (currentTimeEl) currentTimeEl.textContent = "0:00";
    if (durationEl) durationEl.textContent = "0:00";
  };

  const loadTrackFromLibrary = (entry, { autoplay = false } = {}) => {
    if (!entry) return;
    disposeCustomTrack();
    audioEl.src = `songs/${entry.file}`;
    audioEl.load();
    if (songSelectEl) songSelectEl.value = entry.file;
    setTrackTitle(entry.name || entry.file);
    resetPlaybackIndicators();
    if (autoplay) {
      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    }
  };

  const loadUploadedTrack = (file) => {
    if (!file) return;
    disposeCustomTrack();
    customTrackUrl = URL.createObjectURL(file);
    audioEl.src = customTrackUrl;
    audioEl.load();
    if (songSelectEl) songSelectEl.value = "__custom";
    setTrackTitle(file.name);
    resetPlaybackIndicators();
    const playPromise = audioEl.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  };

  const populateSongSelect = (manifest) => {
    if (!songSelectEl) return;
    songSelectEl.innerHTML = "";
    if (Array.isArray(manifest) && manifest.length) {
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
  };

  const updateMicUiState = (active) => {
    micActive = active;
    if (micButtonEl) {
      micButtonEl.classList.toggle("active", active);
      micButtonEl.textContent = active ? "Stop Mic" : "Mic";
      micButtonEl.setAttribute("aria-pressed", active ? "true" : "false");
    }
    if (playPauseBtn) {
      playPauseBtn.disabled = active;
      playPauseBtn.setAttribute("aria-disabled", active ? "true" : "false");
      if (!active) {
        const isPaused = audioEl.paused;
        playPauseBtn.textContent = isPaused ? "▶" : "❚❚";
        playPauseBtn.setAttribute("aria-label", isPaused ? "Play" : "Pause");
      }
    }
    if (songSelectEl) {
      songSelectEl.disabled = active;
    }
    if (fileInputEl) {
      fileInputEl.disabled = active;
    }
    if (uploadLabelEl) {
      uploadLabelEl.classList.toggle("disabled", active);
      uploadLabelEl.setAttribute("aria-disabled", active ? "true" : "false");
    }
    if (progressEl) {
      progressEl.disabled = active;
      if (active) {
        progressEl.value = "0";
      } else if (Number.isFinite(audioEl.duration) && audioEl.duration > 0) {
        progressEl.value = ((audioEl.currentTime / audioEl.duration) * 1000).toString();
      }
    }
    if (currentTimeEl) {
      currentTimeEl.textContent = active ? "--" : formatTime(audioEl.currentTime);
    }
    if (durationEl) {
      durationEl.textContent = active ? "--" : formatTime(audioEl.duration);
    }
    refreshTrackTitleDisplay();
  };

  const enableMicrophone = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.warn("Microphone input is not supported in this browser.");
      return;
    }

    const wasPlaying = !audioEl.paused && !audioEl.ended;
    resumePlaybackAfterMic = wasPlaying;
    if (wasPlaying) {
      audioEl.pause();
    }

    try {
      const ctx = THREE.AudioContext.getContext();
      if (ctx.state === "suspended") {
        await ctx.resume();
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream = stream;
      if (audio.source) {
        try {
          audio.source.disconnect();
        } catch (_) {
          // already disconnected
        }
      }
      audio.setMediaStreamSource(stream);
      const currentVolume = parseFloat(volumeEl?.value ?? "1");
      const normalizedVolume = Number.isFinite(currentVolume) ? currentVolume : 1;
      audio.setVolume(normalizedVolume);
      micActive = true;
      onMicActiveChange?.(true);
      updateMicUiState(true);
    } catch (error) {
      console.error("Failed to access microphone", error);
      if (wasPlaying) {
        const playPromise = audioEl.play();
        if (playPromise && typeof playPromise.catch === "function") {
          playPromise.catch(() => {});
        }
      }
      resumePlaybackAfterMic = false;
    }
  };

  const disableMicrophone = () => {
    if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = undefined;
    }
    if (audio.source) {
      try {
        audio.source.disconnect();
      } catch (_) {
        // already disconnected
      }
    }
    if (mediaElementSourceNode) {
      audio.source = mediaElementSourceNode;
      audio.hasPlaybackControl = true;
      audio.connect();
    }
    const currentVolume = parseFloat(volumeEl?.value ?? "1");
    const normalizedVolume = Number.isFinite(currentVolume) ? currentVolume : 1;
    audio.setVolume(normalizedVolume);
    audioEl.volume = normalizedVolume;
    micActive = false;
    onMicActiveChange?.(false);
    updateMicUiState(false);
    if (resumePlaybackAfterMic) {
      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    }
    resumePlaybackAfterMic = false;
  };

  const setSongManifest = (manifest) => {
    songManifest = Array.isArray(manifest) ? manifest : [];
    populateSongSelect(songManifest);
  };

  const loadInitialTrack = () => {
    const initialEntry = songManifest?.[0];
    if (initialEntry) {
      loadTrackFromLibrary(initialEntry, { autoplay: false });
    } else {
      setTrackTitle("Select or upload a track");
      if (songSelectEl) {
        songSelectEl.value = "__custom";
      }
    }
  };

  playPauseBtn?.addEventListener("click", () => {
    if (audioEl.paused) {
      const playPromise = audioEl.play();
      if (playPromise && typeof playPromise.catch === "function") {
        playPromise.catch(() => {});
      }
    } else {
      audioEl.pause();
    }
  });

  audioEl.addEventListener("play", () => {
    if (!playPauseBtn) return;
    playPauseBtn.textContent = "❚❚";
    playPauseBtn.setAttribute("aria-label", "Pause");
  });

  audioEl.addEventListener("pause", () => {
    if (!playPauseBtn) return;
    playPauseBtn.textContent = "▶";
    playPauseBtn.setAttribute("aria-label", "Play");
  });

  audioEl.addEventListener("timeupdate", () => {
    if (!progressEl || !durationEl || !currentTimeEl || micActive) return;
    const { currentTime, duration } = audioEl;
    currentTimeEl.textContent = formatTime(currentTime);
    if (Number.isFinite(duration) && duration > 0) {
      progressEl.value = ((currentTime / duration) * 1000).toString();
    }
  });

  audioEl.addEventListener("loadedmetadata", () => {
    if (durationEl && !micActive) {
      durationEl.textContent = formatTime(audioEl.duration);
    }
    if (currentTimeEl && !micActive) {
      currentTimeEl.textContent = formatTime(audioEl.currentTime);
    }
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
    if (micActive) return;
    const target = event.target;
    if (!target || audioEl.duration === 0 || Number.isNaN(audioEl.duration)) return;
    const ratio = parseFloat(target.value) / 1000;
    if (!Number.isFinite(ratio)) return;
    audioEl.currentTime = ratio * audioEl.duration;
  });

  volumeEl?.addEventListener("input", (event) => {
    const value = parseFloat(event.target.value);
    if (!Number.isFinite(value)) return;
    audio.setVolume(value);
    if (!micActive) {
      audioEl.volume = value;
    }
  });

  songSelectEl?.addEventListener("change", () => {
    if (!songSelectEl) return;
    const { value } = songSelectEl;
    if (value === "__custom") {
      if (!customTrackUrl) {
        audioEl.pause();
        audioEl.currentTime = 0;
        setTrackTitle("Upload a track");
        resetPlaybackIndicators();
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

  micButtonEl?.addEventListener("click", async () => {
    if (micToggleInFlight) return;
    micToggleInFlight = true;
    try {
      if (micActive) {
        disableMicrophone();
      } else {
        await enableMicrophone();
      }
    } finally {
      micToggleInFlight = false;
    }
  });

  const dispose = () => {
    disposeCustomTrack();
    resumePlaybackAfterMic = false;
    if (micActive) {
      disableMicrophone();
    } else if (micStream) {
      micStream.getTracks().forEach((track) => track.stop());
      micStream = undefined;
    }
  };

  return {
    setSongManifest,
    loadInitialTrack,
    dispose
  };
}
