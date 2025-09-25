export function getDomElements() {
  const audioEl = document.getElementById("audio");
  const playPauseBtn = document.getElementById("playPause");
  const progressEl = document.getElementById("progress");
  const currentTimeEl = document.getElementById("currentTime");
  const durationEl = document.getElementById("duration");
  const trackTitleEl = document.getElementById("track-title");
  const songSelectEl = document.getElementById("songSelect");
  const fileInputEl = document.getElementById("fileInput");
  const volumeEl = document.getElementById("volume");
  const uploadLabelEl = document.querySelector(".upload-label");

  if (uploadLabelEl && !uploadLabelEl.hasAttribute("aria-disabled")) {
    uploadLabelEl.setAttribute("aria-disabled", "false");
  }

  return {
    audioEl,
    playPauseBtn,
    progressEl,
    currentTimeEl,
    durationEl,
    trackTitleEl,
    songSelectEl,
    fileInputEl,
    volumeEl,
    uploadLabelEl
  };
}
