/* js/map.js
   Lightweight Leaflet based map simulation for tracking garbage trucks.
   Ensure you include Leaflet CSS/JS in pages that use this file:
   <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
   <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
*/

(function () {
  // make sure Leaflet exists
  if (typeof L === "undefined") {
    console.warn("Leaflet not found. Please include Leaflet CSS/JS for map features.");
    return;
  }

  // A tiny route we can use for simulation (lat,lng pairs)
  const demoRoute = [
    [28.7041, 77.1025],
    [28.7055, 77.1080],
    [28.7080, 77.1150],
    [28.7120, 77.1230],
    [28.7160, 77.1300],
    [28.7200, 77.1350]
  ];

  // Keep internal state
  let mapInstance = null;
  let vehicleMarker = null;
  let simulationTimer = null;
  let simIndex = 0;

  function initMap(containerId = "map", center = [28.7041, 77.1025], zoom = 13) {
    mapInstance = L.map(containerId).setView(center, zoom);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors'
    }).addTo(mapInstance);

    // draw route polyline
    const poly = L.polyline(demoRoute, { color: "#2E8B57", weight: 4, opacity: 0.8 }).addTo(mapInstance);
    mapInstance.fitBounds(poly.getBounds().pad(0.2));

    // place vehicle at start
    vehicleMarker = L.marker(demoRoute[0], { title: "Waste Truck", riseOnHover: true }).addTo(mapInstance);
    vehicleMarker.bindPopup("Truck (simulated)").openPopup();

    // add control to start/stop
    addControls();
  }

  function addControls() {
    if (!mapInstance) return;
    const ctrl = L.Control.extend({
      options: { position: "topright" },
      onAdd: function () {
        const c = L.DomUtil.create("div", "route-controls card");
        c.style.padding = "8px";
        c.innerHTML = `
          <div style="display:flex;gap:8px;align-items:center">
            <button id="map-start-btn" class="btn btn-ghost">Start</button>
            <button id="map-stop-btn" class="btn btn-ghost">Stop</button>
            <button id="map-reset-btn" class="btn btn-ghost">Reset</button>
          </div>
        `;
        return c;
      }
    });
    mapInstance.addControl(new ctrl());

    // wire buttons (use document because map control is inside DOM)
    setTimeout(() => {
      document.getElementById("map-start-btn").addEventListener("click", startVehicleSimulation);
      document.getElementById("map-stop-btn").addEventListener("click", stopVehicleSimulation);
      document.getElementById("map-reset-btn").addEventListener("click", resetVehicleSimulation);
    }, 100);
  }

  function startVehicleSimulation(intervalMs = 1500) {
    if (!mapInstance || !vehicleMarker) return;
    if (simulationTimer) return; // already running
    simulationTimer = setInterval(() => {
      simIndex = (simIndex + 1) % demoRoute.length;
      const pos = demoRoute[simIndex];
      vehicleMarker.setLatLng(pos);
      // update popup
      vehicleMarker.setPopupContent(`Truck (sim) — ${new Date().toLocaleTimeString()}`);
    }, intervalMs);
  }

  function stopVehicleSimulation() {
    if (simulationTimer) {
      clearInterval(simulationTimer);
      simulationTimer = null;
    }
  }

  function resetVehicleSimulation() {
    stopVehicleSimulation();
    simIndex = 0;
    if (vehicleMarker && demoRoute[0]) vehicleMarker.setLatLng(demoRoute[0]);
  }

  function getVehiclePosition() {
    if (!vehicleMarker) return null;
    const latlng = vehicleMarker.getLatLng();
    return { lat: latlng.lat, lng: latlng.lng };
  }

  // expose to global
  window.GCMap = {
    initMap,
    startVehicleSimulation,
    stopVehicleSimulation,
    resetVehicleSimulation,
    getVehiclePosition
  };

})();
