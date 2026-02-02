// @ts-check
mapboxgl.accessToken =
  "pk.eyJ1IjoicGFjaGlyb24iLCJhIjoiY2xiZjBuMzVmMDFzNzNubXJhdTQwMTFldCJ9.CB4AVXkG_Ow0XPYRT_CI5A";

const GEOJSON_URL = "resources/map.geojson";
const AVATAR_IMAGE_URL = "resources/img/avatar_bulle.png";

const SOURCE_ID = "map-data";
const LINE_LAYER_ID = "map-line";
const POINT_AVATAR_LAYER_ID = "map-point-avatar";
const POINT_LABEL_LAYER_ID = "map-point-label";
const POI_LAYER_ID = "map-poi";
const POI_ICON_PREFIX = "poi-icon-";

const MAP_OPTIONS = {
  container: "map",
  style: "mapbox://styles/mapbox/standard",
  center: [-93.28783303276339, 37.20398932063159],
  zoom: 4,
  scrollZoom: true,
};


// Build a LineString from points sorted by their "day" property.
const buildRouteLine = (features) => {
  const points = [];

  for (const feature of features ?? []) {
    if (feature?.geometry?.type !== "Point") {
      continue;
    }

    const dayValue = Number(feature?.properties?.day);
    if (!Number.isFinite(dayValue)) {
      continue;
    }

    if (!Array.isArray(feature.geometry.coordinates)) {
      continue;
    }

    points.push({ day: dayValue, coords: feature.geometry.coordinates });
  }

  points.sort((a, b) => a.day - b.day);
  if (points.length < 2) {
    return null;
  }

  return {
    type: "Feature",
    properties: { name: "Route" },
    geometry: {
      type: "LineString",
      coordinates: points.map((point) => point.coords),
    },
  };
};

const loadGeojson = async (url) => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GeoJSON load failed: ${response.status}`);
  }
  return response.json();
};

const ensureRouteLine = (featureCollection) => {
  const routeLine = buildRouteLine(featureCollection?.features);
  if (!routeLine) {
    return featureCollection;
  }

  return {
    ...featureCollection,
    features: [...(featureCollection.features ?? []), routeLine],
  };
};

// Attach icon ids to POIs so the layer can reference images by name.
const attachPoiIconIds = (featureCollection) => {
  const features = featureCollection?.features ?? [];
  let iconIndex = 0;

  for (const feature of features) {
    if (feature?.properties?.type !== "POI") {
      continue;
    }

    const imageUrl = feature?.properties?.image;
    if (typeof imageUrl !== "string" || imageUrl.length === 0) {
      continue;
    }

    feature.properties.iconId = `${POI_ICON_PREFIX}${iconIndex}`;
    iconIndex += 1;
  }

  return featureCollection;
};

const loadImage = (map, url) =>
  new Promise((resolve, reject) => {
    map.loadImage(url, (err, image) => {
      if (err) {
        reject(err);
        return;
      }
      resolve(image);
    });
  });

const addRouteLayer = (map) => {
  map.addLayer({
    id: LINE_LAYER_ID,
    type: "line",
    source: SOURCE_ID,
    filter: ["==", ["geometry-type"], "LineString"],
    paint: {
      "line-color": "#1f2937",
      "line-width": 1,
      "line-dasharray": [5, 10],
    },
  });
};

const addPointLayers = (map) => {
  map.addLayer({
    id: POINT_AVATAR_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    filter: [
      "all",
      ["==", ["geometry-type"], "Point"],
      ["!=", ["get", "type"], "POI"],
    ],
    layout: {
      "icon-image": "avatar",
      "icon-size": 0.05,
      "icon-allow-overlap": true,
    },
  });

  map.addLayer({
    id: POINT_LABEL_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    filter: [
      "all",
      ["==", ["geometry-type"], "Point"],
      ["!=", ["get", "type"], "POI"],
    ],
    layout: {
      "text-field": ["get", "name"],
      "text-size": 14,
      "text-offset": [0, 1.25],
      "text-anchor": "top",
      "text-allow-overlap": false,
    },
    paint: {
      "text-color": "#1f2937",
      "text-halo-color": "#ffffff",
      "text-halo-width": 1,
    },
  });
};

const addPoiLayer = (map) => {
  map.addLayer({
    id: POI_LAYER_ID,
    type: "symbol",
    source: SOURCE_ID,
    filter: [
      "all",
      ["==", ["geometry-type"], "Point"],
      ["==", ["get", "type"], "POI"],
    ],
    layout: {
      "icon-image": ["get", "iconId"],
      "icon-size": 0.05,
      "icon-allow-overlap": true,
    },
  });
};

// Build popup DOM nodes to avoid injecting raw HTML strings.
const createPopupContent = (properties) => {
  const popupContent = document.createElement("div");
  popupContent.className = "map-popup__content";

  if (properties.name) {
    const title = document.createElement("h3");
    title.className = "map-popup__title";
    title.textContent = properties.name;
    popupContent.appendChild(title);
  }

  const text = document.createElement("p");
  text.className = "map-popup__text";
  text.textContent = properties.description ?? "";
  popupContent.appendChild(text);

  if (properties.pictureurl) {
    const image = document.createElement("img");
    image.className = "map-popup__image";
    image.alt = properties.name ?? "Point";
    image.src = properties.pictureurl;
    popupContent.appendChild(image);
  }

  if (properties.link) {
    const link = document.createElement("a");
    link.className = "map-popup__link";
    link.href = properties.link;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = "En savoir plus";
    popupContent.appendChild(link);
  }

  return popupContent;
};

const bindPopupHandlers = (map) => {
  const layerIds = [POINT_AVATAR_LAYER_ID, POINT_LABEL_LAYER_ID, POI_LAYER_ID];

  const showPopup = (event) => {
    const feature = event.features?.[0];
    if (!feature?.properties) {
      return;
    }

    const popupContent = createPopupContent(feature.properties);

    new mapboxgl.Popup({ className: "map-popup", offset: 16, closeButton: false })
      .setLngLat(feature.geometry.coordinates)
      .setDOMContent(popupContent)
      .addTo(map);
  };

  for (const layerId of layerIds) {
    map.on("click", layerId, showPopup);
    map.on("mouseenter", layerId, () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", layerId, () => {
      map.getCanvas().style.cursor = "";
    });
  }
};

// Allow zoom only when ctrl + wheel (keeps page scroll otherwise).
const enableCtrlScrollZoom = (map) => {
  map.scrollZoom.enable();

  const canvas = map.getCanvas();
  const onWheel = (event) => {
    const zoomKeyPressed = event.ctrlKey || event.metaKey;
    if (!zoomKeyPressed) {
      event.stopPropagation();
      return;
    }

    // Prevent browser page-zoom when ctrl is pressed.
    event.preventDefault();
  };

  canvas.addEventListener("wheel", onWheel, { capture: true, passive: false });
};

// Extend bounds using both points and the route line to frame all data.
const fitMapToData = (map, features) => {
  const bounds = new mapboxgl.LngLatBounds();

  for (const feature of features ?? []) {
    if (feature.geometry?.type === "Point") {
      bounds.extend(feature.geometry.coordinates);
    } else if (feature.geometry?.type === "LineString") {
      for (const coord of feature.geometry.coordinates) {
        bounds.extend(coord);
      }
    }
  }

  if (!bounds.isEmpty()) {
    map.fitBounds(bounds, { padding: 48, maxZoom: 8 });
  }
};

const map = new mapboxgl.Map(MAP_OPTIONS);

map.on("load", async () => {
  try {
    const rawGeojson = await loadGeojson(GEOJSON_URL);
    const geojsonData = attachPoiIconIds(ensureRouteLine(rawGeojson));

    map.addSource(SOURCE_ID, {
      type: "geojson",
      data: geojsonData,
    });

    addRouteLayer(map);

    const avatarImage = await loadImage(map, AVATAR_IMAGE_URL);
    if (!map.hasImage("avatar")) {
      map.addImage("avatar", avatarImage);
    }

    const poiImages = (geojsonData.features ?? [])
      .filter((feature) => feature?.properties?.type === "POI")
      .map((feature) => ({
        iconId: feature?.properties?.iconId,
        imageUrl: feature?.properties?.image,
      }))
      .filter(
        (poi) => typeof poi.iconId === "string" && typeof poi.imageUrl === "string"
      );

    for (const poi of poiImages) {
      if (map.hasImage(poi.iconId)) {
        continue;
      }

      const image = await loadImage(map, poi.imageUrl);
      map.addImage(poi.iconId, image);
    }

    addPointLayers(map);
    addPoiLayer(map);
    bindPopupHandlers(map);
    fitMapToData(map, geojsonData.features);
  } catch (error) {
    console.error(error);
  }
});

enableCtrlScrollZoom(map);
