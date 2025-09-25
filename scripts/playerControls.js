export function createPlayerControls({
  audio,
  audioEl,
  elements
}) {
  const {
    playPauseBtn,
    progressEl,
    currentTimeEl,
    durationEl,
    trackTitleEl,
    songSelectEl,
    fileInputEl,
    volumeEl
  } = elements;

  let songManifest = [];
  let customTrackUrl;
  let lastLoadedTrackTitle = trackTitleEl?.textContent || "Untitled";

  const formatTime = (seconds) => {
    if (!Number.isFinite(seconds)) return "0:00";
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, "0")}`;
  };

  const setTrackTitle = (title) => {
    lastLoadedTrackTitle = title || "Untitled";
    if (trackTitleEl) {
      trackTitleEl.textContent = lastLoadedTrackTitle;
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
    if (!progressEl || !durationEl || !currentTimeEl) return;
    const { currentTime, duration } = audioEl;
    currentTimeEl.textContent = formatTime(currentTime);
    if (Number.isFinite(duration) && duration > 0) {
      progressEl.value = ((currentTime / duration) * 1000).toString();
    }
  });

  audioEl.addEventListener("loadedmetadata", () => {
    if (durationEl) {
      durationEl.textContent = formatTime(audioEl.duration);
    }
    if (currentTimeEl) {
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
    audioEl.volume = value;
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

  const dispose = () => {
    disposeCustomTrack();
  };

  return {
    setSongManifest,
    loadInitialTrack,
    dispose
  };
}
