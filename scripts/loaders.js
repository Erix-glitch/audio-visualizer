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

export async function loadShaderData(shaderMap) {
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

export async function loadSongManifest(url = "songs/manifest.json") {
  try {
    return await fetchJSON(url, "song manifest");
  } catch (error) {
    console.warn(error);
    return [];
  }
}
