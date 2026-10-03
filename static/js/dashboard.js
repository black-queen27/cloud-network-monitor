/* ==============================================================
   Cloud-Based Network Monitoring Dashboard - Frontend JavaScript
   Handles Chart.js rendering, AJAX polling, pinging, and device checks
   ============================================================== */

document.addEventListener("DOMContentLoaded", () => {
  // Mobile sidebar toggle
  const mobileToggle = document.getElementById("mobileToggle");
  const sidebar = document.querySelector(".app-sidebar");
  if (mobileToggle && sidebar) {
    mobileToggle.addEventListener("click", () => {
      sidebar.classList.toggle("show");
    });
  }

  // Determine active view
  const isDashboard = document.getElementById("trafficChart") !== null;
  const isDevicesPage = document.getElementById("devicesTable") !== null;
  const isMonitorPage = document.getElementById("pingForm") !== null;
  const isAlertsPage = document.getElementById("alertsContainer") !== null;

  // Real-time server clock
  function updateClock() {
    const clockEl = document.getElementById("serverClock");
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString();
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // If on Dashboard, initialize Chart.js and polling
  if (isDashboard) {
    initDashboard();
  }

  // If on Devices page, bind device listeners
  if (isDevicesPage) {
    initDevicesPage();
  }

  // If on Ping Monitor page, bind monitor listeners
  if (isMonitorPage) {
    initMonitorPage();
  }

  // If on Alerts page, bind alert actions
  if (isAlertsPage) {
    initAlertsPage();
  }
});

/* ==============================================================
   1. DASHBOARD MODULE
   ============================================================== */

let trafficChartInstance = null;
let latencyChartInstance = null;
let devicesChartInstance = null;
let latencyHistory = [];
let latencyLabels = [];

function initDashboard() {
  initCharts();
  fetchNetworkStatus();
  fetchTrafficData();

  // Polling intervals
  // Traffic metrics updated every 3.5 seconds
  const trafficInterval = setInterval(fetchTrafficData, 3500);

  // General network status updated every 8 seconds
  const statusInterval = setInterval(fetchNetworkStatus, 8000);

  // Refresh status button
  const refreshBtn = document.getElementById("refreshStatusBtn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", () => {
      refreshBtn.disabled = true;
      refreshBtn.innerHTML = "<span>⟳ Refreshing...</span>";
      Promise.all([fetchNetworkStatus(), fetchTrafficData()]).finally(() => {
        setTimeout(() => {
          refreshBtn.disabled = false;
          refreshBtn.innerHTML = "<span>⟳ Refresh Status</span>";
        }, 600);
      });
    });
  }

  // Ping All Devices button on dashboard
  const pingAllBtn = document.getElementById("pingAllBtn");
  if (pingAllBtn) {
    pingAllBtn.addEventListener("click", () => {
      pingAllBtn.disabled = true;
      pingAllBtn.textContent = "Checking devices...";
      fetch("/api/check-all-devices", { method: "POST" })
        .then(res => res.json())
        .then(data => {
          fetchNetworkStatus();
          alert(`Checked ${data.count || 0} devices successfully.`);
        })
        .catch(err => console.error("Error pinging devices:", err))
        .finally(() => {
          pingAllBtn.disabled = false;
          pingAllBtn.textContent = "Check All Devices";
        });
    });
  }
}

function initCharts() {
  const chartFont = {
    family: "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif",
    size: 11
  };

  // 1. Traffic Chart (Line)
  const trafficCtx = document.getElementById("trafficChart");
  if (trafficCtx && typeof Chart !== "undefined") {
    trafficChartInstance = new Chart(trafficCtx.getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Incoming (KB/s)",
            borderColor: "#38bdf8",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            data: [],
            tension: 0.35,
            fill: true,
            borderWidth: 2,
            pointRadius: 2
          },
          {
            label: "Outgoing (KB/s)",
            borderColor: "#818cf8",
            backgroundColor: "rgba(129, 140, 248, 0.05)",
            data: [],
            tension: 0.35,
            fill: true,
            borderWidth: 2,
            pointRadius: 2
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#94a3b8", font: chartFont }
          }
        },
        scales: {
          x: {
            ticks: { color: "#64748b", font: chartFont },
            grid: { color: "rgba(51, 65, 85, 0.3)" }
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#64748b", font: chartFont },
            grid: { color: "rgba(51, 65, 85, 0.3)" }
          }
        }
      }
    });
  }

  // 2. Latency Chart (Line)
  const latencyCtx = document.getElementById("latencyChart");
  if (latencyCtx && typeof Chart !== "undefined") {
    latencyChartInstance = new Chart(latencyCtx.getContext("2d"), {
      type: "line",
      data: {
        labels: [],
        datasets: [
          {
            label: "Latency (ms)",
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            data: [],
            tension: 0.3,
            fill: true,
            borderWidth: 2,
            pointRadius: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            labels: { color: "#94a3b8", font: chartFont }
          }
        },
        scales: {
          x: {
            ticks: { color: "#64748b", font: chartFont },
            grid: { color: "rgba(51, 65, 85, 0.3)" }
          },
          y: {
            beginAtZero: true,
            ticks: { color: "#64748b", font: chartFont },
            grid: { color: "rgba(51, 65, 85, 0.3)" }
          }
        }
      }
    });
  }

  // 3. Devices Status Doughnut Chart
  const devicesCtx = document.getElementById("devicesChart");
  if (devicesCtx && typeof Chart !== "undefined") {
    devicesChartInstance = new Chart(devicesCtx.getContext("2d"), {
      type: "doughnut",
      data: {
        labels: ["Online", "Offline"],
        datasets: [
          {
            data: [0, 0],
            backgroundColor: ["#10b981", "#ef4444"],
            borderColor: "#1e293b",
            borderWidth: 3
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: "bottom",
            labels: { color: "#94a3b8", font: chartFont, padding: 16 }
          }
        },
        cutout: "68%"
      }
    });
  }
}

function fetchNetworkStatus() {
  return fetch("/api/network-status")
    .then(res => res.json())
    .then(data => {
      // Top Status Indicator
      const topStatusDot = document.getElementById("topStatusDot");
      const topStatusText = document.getElementById("topStatusText");
      if (topStatusDot && topStatusText) {
        if (data.status === "Online") {
          topStatusDot.className = "status-dot healthy";
          topStatusText.textContent = "Online";
        } else {
          topStatusDot.className = "status-dot critical";
          topStatusText.textContent = "Offline";
        }
      }

      // Summary Cards
      setText("netStatusVal", data.status);
      setText("localIpVal", data.local_ip || "127.0.0.1");
      setText("publicIpVal", data.public_ip || "Unavailable");
      setText("latencyVal", `${data.latency_ms || 0} ms`);
      setText("packetLossVal", `${data.packet_loss || 0}%`);
      setText("downSpeedVal", data.download_speed || "0.00 KB/s");
      setText("upSpeedVal", data.upload_speed || "0.00 KB/s");
      setText("totalRecvVal", data.total_received || "0 MB");
      setText("totalSentVal", data.total_sent || "0 MB");
      setText("deviceStatsVal", `${data.online_devices} / ${data.total_devices} Online`);
      setText("alertsCountVal", data.active_alerts || 0);

      // Latency color indication
      const latencyBadge = document.getElementById("latencyBadge");
      if (latencyBadge) {
        const lat = data.latency_ms;
        if (lat === 0 && data.status === "Offline") {
          latencyBadge.className = "badge badge-critical";
          latencyBadge.textContent = "Offline";
        } else if (lat < 50) {
          latencyBadge.className = "badge badge-healthy";
          latencyBadge.textContent = "Optimal";
        } else if (lat < 150) {
          latencyBadge.className = "badge badge-warning";
          latencyBadge.textContent = "Moderate";
        } else {
          latencyBadge.className = "badge badge-critical";
          latencyBadge.textContent = "High";
        }
      }

      // Update Latency Chart
      if (latencyChartInstance && data.latency_ms !== undefined) {
        const timeNow = new Date().toLocaleTimeString();
        latencyLabels.push(timeNow);
        latencyHistory.push(data.latency_ms);
        if (latencyLabels.length > 12) {
          latencyLabels.shift();
          latencyHistory.shift();
        }
        latencyChartInstance.data.labels = latencyLabels;
        latencyChartInstance.data.datasets[0].data = latencyHistory;
        latencyChartInstance.update("none");
      }

      // Update Devices Chart
      if (devicesChartInstance) {
        devicesChartInstance.data.datasets[0].data = [
          data.online_devices || 0,
          data.offline_devices || 0
        ];
        devicesChartInstance.update();
      }
    })
    .catch(err => {
      console.error("Error fetching network status:", err);
    });
}

function fetchTrafficData() {
  return fetch("/api/traffic")
    .then(res => res.json())
    .then(data => {
      if (data.success && trafficChartInstance && data.history) {
        const labels = data.history.map(item => item.time);
        const incoming = data.history.map(item => item.download_kb);
        const outgoing = data.history.map(item => item.upload_kb);

        trafficChartInstance.data.labels = labels;
        trafficChartInstance.data.datasets[0].data = incoming;
        trafficChartInstance.data.datasets[1].data = outgoing;
        trafficChartInstance.update("none");
      }
    })
    .catch(err => console.error("Error fetching traffic data:", err));
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

/* ==============================================================
   2. PING / LATENCY MONITOR MODULE
   ============================================================== */

function initMonitorPage() {
  const pingForm = document.getElementById("pingForm");
  const targetInput = document.getElementById("targetInput");
  const checkBtn = document.getElementById("checkBtn");
  const terminalOut = document.getElementById("terminalOutput");

  // Quick preset buttons
  const quickTags = document.querySelectorAll(".quick-tag");
  quickTags.forEach(tag => {
    tag.addEventListener("click", () => {
      const target = tag.getAttribute("data-target");
      if (targetInput && target) {
        targetInput.value = target;
        runPingCheck(target);
      }
    });
  });

  if (pingForm) {
    pingForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const target = targetInput.value.trim();
      if (!target) return;
      runPingCheck(target);
    });
  }

  function runPingCheck(target) {
    if (checkBtn) {
      checkBtn.disabled = true;
      checkBtn.innerHTML = "<span>⏳ Pinging...</span>";
    }
    if (terminalOut) {
      terminalOut.textContent = `[Network Diagnostics] Pinging ${target}...\nSending ICMP echo request packets...`;
      terminalOut.className = "terminal-view";
    }

    fetch("/api/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ target: target })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          if (terminalOut) {
            terminalOut.textContent = `Error: ${data.error || "Unable to reach target"}`;
            terminalOut.className = "terminal-view error";
          }
          return;
        }

        // Update result display tiles
        setText("pingResultTarget", data.target);
        setText("pingResultIp", data.ip);
        setText("pingResultLatency", `${data.latency_ms} ms`);
        setText("pingResultLoss", `${data.packet_loss}%`);

        const statusBadge = document.getElementById("pingResultStatusBadge");
        if (statusBadge) {
          if (data.reachable) {
            statusBadge.className = "badge badge-healthy";
            statusBadge.textContent = "Reachable";
          } else {
            statusBadge.className = "badge badge-critical";
            statusBadge.textContent = "Unreachable";
          }
        }

        if (terminalOut) {
          terminalOut.textContent = data.raw || "Check completed.";
          if (!data.reachable) {
            terminalOut.className = "terminal-view error";
          } else {
            terminalOut.className = "terminal-view";
          }
        }
      })
      .catch(err => {
        if (terminalOut) {
          terminalOut.textContent = `Network exception: ${err.message}`;
          terminalOut.className = "terminal-view error";
        }
      })
      .finally(() => {
        if (checkBtn) {
          checkBtn.disabled = false;
          checkBtn.innerHTML = "<span>🔍 Check Target</span>";
        }
      });
  }
}

/* ==============================================================
   3. DEVICE MONITORING MODULE
   ============================================================== */

function initDevicesPage() {
  const addForm = document.getElementById("addDeviceForm");
  const checkAllBtn = document.getElementById("checkAllDevicesBtn");

  // Add Device
  if (addForm) {
    addForm.addEventListener("submit", (e) => {
      e.preventDefault();
      const nameInput = document.getElementById("deviceNameInput");
      const ipInput = document.getElementById("deviceIpInput");
      const submitBtn = document.getElementById("addDeviceSubmitBtn");

      const name = nameInput.value.trim();
      const ip = ipInput.value.trim();
      if (!name || !ip) return;

      submitBtn.disabled = true;
      submitBtn.textContent = "Testing & Adding...";

      fetch("/api/add-device", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name, ip_address: ip })
      })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            window.location.reload();
          } else {
            alert(data.error || "Failed to add device.");
          }
        })
        .catch(err => alert("Error: " + err.message))
        .finally(() => {
          submitBtn.disabled = false;
          submitBtn.textContent = "Add Device";
        });
    });
  }

  // Check All Devices
  if (checkAllBtn) {
    checkAllBtn.addEventListener("click", () => {
      checkAllBtn.disabled = true;
      checkAllBtn.textContent = "Checking all devices...";
      fetch("/api/check-all-devices", { method: "POST" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            window.location.reload();
          }
        })
        .catch(err => alert("Check failed: " + err.message))
        .finally(() => {
          checkAllBtn.disabled = false;
          checkAllBtn.textContent = "⟳ Check All Devices";
        });
    });
  }

  // Delegate Row Actions (Check Now & Delete)
  document.addEventListener("click", (e) => {
    const checkTarget = e.target.closest(".btn-check-device");
    if (checkTarget) {
      const devId = checkTarget.getAttribute("data-id");
      checkTarget.disabled = true;
      checkTarget.textContent = "Checking...";

      fetch(`/api/check-device/${devId}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const dev = data.device;
            const row = document.getElementById(`device-row-${dev.id}`);
            if (row) {
              const statusCol = row.querySelector(".device-status-cell");
              const latencyCol = row.querySelector(".device-latency-cell");
              const checkedCol = row.querySelector(".device-checked-cell");

              if (statusCol) {
                const badgeClass = dev.status === "Online" ? "badge-healthy" : "badge-critical";
                statusCol.innerHTML = `<span class="badge ${badgeClass}">${dev.status}</span>`;
              }
              if (latencyCol) {
                latencyCol.textContent = `${dev.latency_ms} ms (${dev.packet_loss}% loss)`;
              }
              if (checkedCol) {
                checkedCol.textContent = dev.last_checked;
              }
            }
          }
        })
        .catch(err => alert("Device check error: " + err.message))
        .finally(() => {
          checkTarget.disabled = false;
          checkTarget.textContent = "Check";
        });
    }

    const deleteTarget = e.target.closest(".btn-delete-device");
    if (deleteTarget) {
      const devId = deleteTarget.getAttribute("data-id");
      if (confirm("Are you sure you want to remove this monitored device?")) {
        fetch(`/api/delete-device/${devId}`, { method: "POST" })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              const row = document.getElementById(`device-row-${devId}`);
              if (row) row.remove();
            }
          })
          .catch(err => alert("Delete error: " + err.message));
      }
    }
  });
}

/* ==============================================================
   4. ALERTS MODULE
   ============================================================== */

function initAlertsPage() {
  const clearAlertsBtn = document.getElementById("clearAlertsBtn");
  if (clearAlertsBtn) {
    clearAlertsBtn.addEventListener("click", () => {
      if (confirm("Clear all alerts from database?")) {
        fetch("/api/clear-alerts", { method: "POST" })
          .then(res => res.json())
          .then(data => {
            if (data.success) {
              window.location.reload();
            }
          })
          .catch(err => alert("Clear error: " + err.message));
      }
    });
  }

  // Resolve single alert
  document.addEventListener("click", (e) => {
    const resolveBtn = e.target.closest(".btn-resolve-alert");
    if (resolveBtn) {
      const alertId = resolveBtn.getAttribute("data-id");
      fetch(`/api/resolve-alert/${alertId}`, { method: "POST" })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            const item = document.getElementById(`alert-item-${alertId}`);
            if (item) {
              item.classList.add("resolved");
              resolveBtn.remove();
            }
          }
        })
        .catch(err => alert("Resolve error: " + err.message));
    }
  });
}
