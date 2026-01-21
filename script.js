// @ts-check
mapboxgl.accessToken = "pk.eyJ1IjoicGFjaGlyb24iLCJhIjoiY2xiZjBuMzVmMDFzNzNubXJhdTQwMTFldCJ9.CB4AVXkG_Ow0XPYRT_CI5A";

const geojsonUrl = "resources/map.geojson";
let geojsonData = null;

const map = new mapboxgl.Map({
  container: "map",
  style: "mapbox://styles/mapbox/light-v11",
  center: [-93.28783303276339, 37.20398932063159],
  zoom: 4,
});

map.on("load", async () => {
  try {
    const response = await fetch(geojsonUrl);
    if (!response.ok) {
      throw new Error(`GeoJSON load failed: ${response.status}`);
    }
    geojsonData = await response.json();

    map.addSource("map-data", {
      type: "geojson",
      data: geojsonData,
    });

    map.addLayer({
      id: "map-line",
      type: "line",
      source: "map-data",
      filter: ["==", ["geometry-type"], "LineString"],
      paint: {
        "line-color": "#1f2937",
        "line-width": 1,
        "line-dasharray": [5, 10],
      },
    });

    const avatarImage = await new Promise((resolve, reject) => {
      map.loadImage("resources/img/avatar_bulle.png", (err, image) => {
        if (err) {
          reject(err);
          return;
        }
        resolve(image);
      });
    });

    if (!map.hasImage("avatar")) {
      map.addImage("avatar", avatarImage);
    }


    map.addLayer({
      id: "map-point-avatar",
      type: "symbol",
      source: "map-data",
      filter: ["==", ["geometry-type"], "Point"],
      layout: {
        "icon-image": "avatar",
        "icon-size": 0.05,
        "icon-allow-overlap": true,
      },
    });

    map.addLayer({
      id: "map-point-label",
      type: "symbol",
      source: "map-data",
      filter: ["==", ["geometry-type"], "Point"],
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

    const pointLayers = ["map-point-avatar", "map-point-label"];
    const showPopup = (event) => {
      const feature = event.features?.[0];
      if (!feature?.properties) {
        return;
      }

      const popupContent = document.createElement("div");
      popupContent.className = "map-popup__content";

      if (feature.properties.name) {
        const title = document.createElement("h3");
        title.className = "map-popup__title";
        title.textContent = feature.properties.name;
        popupContent.appendChild(title);
      }

      const text = document.createElement("p");
      text.className = "map-popup__text";
      text.textContent = feature.properties.description ?? "";
      popupContent.appendChild(text);

      if (feature.properties.pictureurl) {
        const image = document.createElement("img");
        image.className = "map-popup__image";
        image.alt = feature.properties.name ?? "Point";
        image.src = feature.properties.pictureurl;
        popupContent.appendChild(image);
      }

      if (feature.properties.link) {
        const link = document.createElement("a");
        link.className = "map-popup__link";
        link.href = feature.properties.link;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = "En savoir plus";
        popupContent.appendChild(link);
      }

      new mapboxgl.Popup({ className: "map-popup", offset: 16, closeButton: false })
        .setLngLat(feature.geometry.coordinates)
        .setDOMContent(popupContent)
        .addTo(map);
    };

    for (const layerId of pointLayers) {
      map.on("click", layerId, showPopup);
      map.on("mouseenter", layerId, () => {
        map.getCanvas().style.cursor = "pointer";
      });
      map.on("mouseleave", layerId, () => {
        map.getCanvas().style.cursor = "";
      });
    }

    const bounds = new mapboxgl.LngLatBounds();
    for (const feature of geojsonData.features ?? []) {
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
  } catch (error) {
    console.error(error);
  }
});
