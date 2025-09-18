// ===== Enhanced Weather Station Dashboard JavaScript =====

// ===== Configuration =====
const AUTH_TOKEN = "4GjREaU1RUuBEDQ_9jEbFRfoiHMCIckn";
const WEATHER_API_KEY = "62e688c5413b2f8d2396e95670ef8ca0";

// Global variables for enhanced GPS tracking
let lastKnownPosition = null;
let locationWatchId = null;
let isHighAccuracyMode = false;

// ===== Blynk Sensor Data Functions =====
async function fetchData(pin, elementId, timeId, unit = "") {
    try {
        const response = await fetch(
            `https://blynk.cloud/external/api/get?token=${AUTH_TOKEN}&pin=${pin}`,
            { timeout: 10000 }
        );
        const value = await response.text();

        const element = document.getElementById(elementId);
        const timeElement = document.getElementById(timeId);

        if (value.includes("error") || value === "" || value === "null") {
            element.innerText = "No Data";
            element.className = "sensor-value no-data";
        } else {
            element.innerText = parseFloat(value).toFixed(1) + " " + unit;
            element.className = "sensor-value";
        }
        
        timeElement.innerText = "Last update: " + new Date().toLocaleTimeString();
    } catch (error) {
        console.error(`Error fetching ${pin}:`, error);
        const element = document.getElementById(elementId);
        element.innerText = "Error";
        element.className = "sensor-value error";
        document.getElementById(timeId).innerText = "Connection failed";
    }
}

// ===== Device Status Check =====
async function checkDeviceStatus() {
    try {
        const response = await fetch(
            `https://blynk.cloud/external/api/isHardwareConnected?token=${AUTH_TOKEN}`,
            { timeout: 8000 }
        );
        const status = await response.text();
        const statusEl = document.getElementById("status");
        
        if (status === "true") {
            statusEl.innerText = "🟢 Device Online";
            statusEl.className = "status online";
        } else {
            statusEl.innerText = "🔴 Device Offline";
            statusEl.className = "status offline";
        }
    } catch (err) {
        console.error("Error checking device status:", err);
        const statusEl = document.getElementById("status");
        statusEl.innerText = "⚠️ Connection Error";
        statusEl.className = "status";
        statusEl.style.backgroundColor = "rgba(231, 76, 60, 0.1)";
        statusEl.style.color = "#e74c3c";
    }
    setInterval(checkDeviceStatus, 10000);
}


// ===== Enhanced Location Detection Functions =====
function updateLocationAccuracy(accuracy) {
    const accuracyEl = document.getElementById("location-accuracy");
    const debugAccuracyEl = document.getElementById("debug-accuracy");
    
    let accuracyText = `GPS accuracy: ${Math.round(accuracy)}m`;
    let className = "location-accuracy";
    
    if (accuracy <= 10) {
        accuracyText += " (Excellent)";
        className += " high-accuracy";
    } else if (accuracy <= 50) {
        accuracyText += " (Good)";
    } else if (accuracy <= 100) {
        accuracyText += " (Fair)";
    } else {
        accuracyText += " (Poor)";
        className += " low-accuracy";
    }
    
    accuracyEl.innerText = accuracyText;
    accuracyEl.className = className;
    
    if (debugAccuracyEl) {
        debugAccuracyEl.innerText = `${Math.round(accuracy)}m`;
    }
}

function updateDebugInfo(position, method = "Unknown") {
    const debugCoordsEl = document.getElementById("debug-coords");
    const debugMethodEl = document.getElementById("debug-method");
    const debugTimeEl = document.getElementById("debug-time");
    
    if (debugCoordsEl) {
        debugCoordsEl.innerText = `${position.coords.latitude.toFixed(6)}, ${position.coords.longitude.toFixed(6)}`;
    }
    if (debugMethodEl) {
        debugMethodEl.innerText = method;
    }
    if (debugTimeEl) {
        debugTimeEl.innerText = new Date().toLocaleTimeString();
    }
}

async function getLocationName(lat, lon) {
    const methods = [
        // Method 1: BigDataCloud (most accurate for cities)
        {
            name: "BigDataCloud",
            func: async () => {
                const response = await fetch(
                    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${lat}&longitude=${lon}&localityLanguage=en`,
                    { timeout: 8000 }
                );
                
                if (!response.ok) {
                    throw new Error(`BigDataCloud API error: ${response.status}`);
                }
                
                const data = await response.json();
                console.log("BigDataCloud response:", data);
                
                if (data && (data.city || data.locality || data.principalSubdivision)) {
                    const city = data.city || data.locality || data.principalSubdivision;
                    const region = data.principalSubdivision || data.countryName || data.countryCode || '';
                    const country = data.countryName || data.countryCode || '';
                    
                    // Build location string with available data
                    let locationParts = [city];
                    if (region && region !== city && region !== country) {
                        locationParts.push(region);
                    }
                    if (country) {
                        locationParts.push(country);
                    }
                    
                    return locationParts.join(', ');
                }
                throw new Error('No usable data from BigDataCloud');
            }
        },

        // Method 2: Nominatim OpenStreetMap (good backup)
        {
            name: "Nominatim",
            func: async () => {
                const response = await fetch(
                    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=12&addressdetails=1`,
                    {
                        headers: { 'User-Agent': 'WeatherStation/1.0' },
                        timeout: 8000
                    }
                );
                
                if (!response.ok) {
                    throw new Error(`Nominatim API error: ${response.status}`);
                }
                
                const data = await response.json();
                console.log("Nominatim response:", data);
                
                if (data && data.address) {
                    const addr = data.address;
                    // Prioritize more specific locations first
                    const locationName = addr.city || 
                                       addr.town || 
                                       addr.municipality || 
                                       addr.village || 
                                       addr.hamlet ||
                                       addr.suburb ||
                                       addr.neighbourhood ||
                                       addr.county ||
                                       addr.state_district ||
                                       addr.state ||
                                       'Unknown Location';
                    
                    const country = addr.country || '';
                    const state = addr.state || addr.region || '';
                    
                    // Build comprehensive location string
                    let locationParts = [locationName];
                    if (state && state !== locationName) {
                        locationParts.push(state);
                    }
                    if (country) {
                        locationParts.push(country);
                    }
                    
                    return locationParts.join(', ');
                }
                throw new Error('No usable data from Nominatim');
            }
        },

        // Method 3: Coordinates as fallback
        {
            name: "Coordinates",
            func: async () => {
                return `📍 ${lat.toFixed(4)}°, ${lon.toFixed(4)}°`;
            }
        }
    ];

    // Try each method in order
    for (let i = 0; i < methods.length; i++) {
        try {
            console.log(`Trying location method ${i + 1}: ${methods[i].name}...`);
            const result = await methods[i].func();
            console.log(`${methods[i].name} success:`, result);
            return { location: result, method: methods[i].name };
        } catch (error) {
            console.warn(`${methods[i].name} failed:`, error.message);
            if (i === methods.length - 1) {
                throw error;
            }
        }
    }
}

// ===== Weather Data Function =====
async function getWeatherData(lat, lon) {
    try {
        const weatherRes = await fetch(
            `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${WEATHER_API_KEY}&units=metric`,
            { timeout: 10000 }
        );
        
        if (weatherRes.status === 401) {
            return "🌤️ Weather API key invalid - check OpenWeatherMap key";
        } else if (!weatherRes.ok) {
            return `🌤️ Weather service error (${weatherRes.status})`;
        }

        const weatherData = await weatherRes.json();
        console.log("Weather data:", weatherData);
        
        if (weatherData.weather && weatherData.main) {
            const description = weatherData.weather[0].description;
            const temp = Math.round(weatherData.main.temp);
            const feelsLike = Math.round(weatherData.main.feels_like);
            const humidity = weatherData.main.humidity;
            const windSpeed = weatherData.wind ? Math.round(weatherData.wind.speed * 3.6) : 0;
            const pressure = weatherData.main.pressure;
            
            return `🌤️ ${description.charAt(0).toUpperCase() + description.slice(1)}, ${temp}°C (feels ${feelsLike}°C) • 💨 ${windSpeed} km/h • 💧 ${humidity}% • 🌊 ${pressure} hPa`;
        } else {
            return "🌤️ No weather data available";
        }
    } catch (weatherError) {
        console.error("Weather fetch error:", weatherError);
        return "🌤️ Weather temporarily unavailable - check connection";
    }
}

// ===== Enhanced Location Functions =====
function getLocationAndForecast(highAccuracy = false) {
    if (!navigator.geolocation) {
        document.getElementById("location").innerText = "📍 Geolocation not supported by this browser";
        document.getElementById("forecast").innerText = "🌤️ Cannot get weather without location";
        return;
    }

    // Clear any existing watch
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
    }

    const options = {
        enableHighAccuracy: highAccuracy,
        timeout: highAccuracy ? 30000 : 15000,
        maximumAge: highAccuracy ? 60000 : 300000  // Shorter cache for high accuracy
    };

    isHighAccuracyMode = highAccuracy;
    
    // Show loading states
    document.getElementById("location").innerText = highAccuracy ? 
        "📍 Getting precise GPS location..." : "📍 Getting location...";
    document.getElementById("forecast").innerText = "🌤️ Preparing weather data...";
    document.getElementById("location-accuracy").innerText = "GPS accuracy: Getting signal...";

    // Disable buttons during location fetch
    const buttons = document.querySelectorAll('button');
    buttons.forEach(btn => {
        if (btn.onclick) btn.disabled = true;
    });

    navigator.geolocation.getCurrentPosition(
        async (position) => {
            // Re-enable buttons
            buttons.forEach(btn => btn.disabled = false);
            
            const lat = position.coords.latitude;
            const lon = position.coords.longitude;
            const accuracy = position.coords.accuracy;

            console.log(`Location obtained: ${lat}, ${lon} (accuracy: ${accuracy}m)`);
            lastKnownPosition = position;
            
            // Update accuracy display
            updateLocationAccuracy(accuracy);
            updateDebugInfo(position, "getCurrentPosition");

            try {
                // Get location name
                document.getElementById("location").innerText = "📍 Identifying location...";
                const locationResult = await getLocationName(lat, lon);
                document.getElementById("location").innerText = `📍 ${locationResult.location}`;

                // Update debug method info
                const debugMethodEl = document.getElementById("debug-method");
                if (debugMethodEl) {
                    debugMethodEl.innerText = `GPS + ${locationResult.method}`;
                }

                // Get weather data
                document.getElementById("forecast").innerText = "🌤️ Fetching weather...";
                const weatherText = await getWeatherData(lat, lon);
                document.getElementById("forecast").innerText = weatherText;

                // If high accuracy mode is enabled, start continuous watching
                if (highAccuracy && accuracy > 20) {
                    startLocationWatch();
                }

            } catch (error) {
                console.error("Error processing location:", error);
                document.getElementById("location").innerText = `📍 Location processing error: ${error.message}`;
                document.getElementById("forecast").innerText = "🌤️ Weather unavailable due to location error";
            }
        },
        (error) => {
            // Re-enable buttons
            buttons.forEach(btn => btn.disabled = false);
            
            console.error("Geolocation error:", error);
            
            let errorMessage = "📍 ";
            let forecastMessage = "🌤️ ";
            
            switch(error.code) {
                case error.PERMISSION_DENIED:
                    errorMessage += "Location access denied - please allow location access in browser settings";
                    forecastMessage += "Enable location to get weather";
                    break;
                case error.POSITION_UNAVAILABLE:
                    errorMessage += "Location unavailable - GPS/network issue";
                    forecastMessage += "Cannot determine location";
                    break;
                case error.TIMEOUT:
                    errorMessage += `Location request timed out after ${options.timeout/1000}s - try again`;
                    forecastMessage += "Location timeout - retry";
                    break;
                default:
                    errorMessage += `Location error (code: ${error.code}) - ${error.message}`;
                    forecastMessage += "Location error";
                    break;
            }
            
            document.getElementById("location").innerText = errorMessage;
            document.getElementById("forecast").innerText = forecastMessage;
            document.getElementById("location-accuracy").innerText = "GPS accuracy: Error";
        },
        options
    );
}

function startLocationWatch() {
    if (locationWatchId) return; // Already watching
    
    console.log("Starting continuous location watch...");
    
    const watchOptions = {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 30000
    };
    
    locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            const accuracy = position.coords.accuracy;
            console.log(`Location watch update: accuracy ${accuracy}m`);
            
            // Update accuracy display
            updateLocationAccuracy(accuracy);
            updateDebugInfo(position, "watchPosition");
            
            // If we get much better accuracy, update location
            if (lastKnownPosition && accuracy < lastKnownPosition.coords.accuracy * 0.5) {
                console.log("Significantly better accuracy, updating location...");
                lastKnownPosition = position;
                
                // Re-fetch location name with better coordinates
                const lat = position.coords.latitude;
                const lon = position.coords.longitude;
                
                getLocationName(lat, lon).then(locationResult => {
                    document.getElementById("location").innerText = `📍 ${locationResult.location}`;
                }).catch(error => {
                    console.error("Error updating location name:", error);
                });
            }
        },
        (error) => {
            console.warn("Location watch error:", error);
        },
        watchOptions
    );
}

function stopLocationWatch() {
    if (locationWatchId) {
        navigator.geolocation.clearWatch(locationWatchId);
        locationWatchId = null;
        console.log("Stopped location watch");
    }
}

// ===== User Interface Functions =====
function getHighAccuracyLocation() {
    console.log("High accuracy GPS requested");
    getLocationAndForecast(true);
}

function refreshLocation() {
    console.log("Manual location refresh requested");
    stopLocationWatch(); // Stop any existing watch
    getLocationAndForecast(isHighAccuracyMode);
}

function toggleDebug() {
    const debugCard = document.getElementById("debug-card");
    const button = debugCard.querySelector("button");
    
    if (debugCard.style.display === "none") {
        debugCard.style.display = "block";
        button.innerText = "Hide Debug";
    } else {
        debugCard.style.display = "none";
        button.innerText = "Show Debug";
    }
}

// ===== Dashboard Update Functions =====
function updateDashboard() {
    console.log("Updating dashboard at:", new Date().toLocaleTimeString());
    
    // Update all sensor readings with better error handling
    const sensors = [
        { pin: "V0", id: "temp", timeId: "temp-time", unit: "°C" },
        { pin: "V1", id: "hum", timeId: "hum-time", unit: "%" },
        { pin: "V2", id: "rain", timeId: "rain-time", unit: "mm" },
        { pin: "V3", id: "pressure", timeId: "pressure-time", unit: "hPa" },
        { pin: "V4", id: "light", timeId: "light-time", unit: "Lux" }
    ];
    
    sensors.forEach(sensor => {
        fetchData(sensor.pin, sensor.id, sensor.timeId, sensor.unit);
    });
    
    // Check device connection status
    checkDeviceStatus();
}

// ===== Initialization and Event Handlers =====
function initializeDashboard() {
    console.log("Initializing Enhanced Weather Station Dashboard...");
    
    // Show debug info by default for testing (can be hidden in production)
    const debugCard = document.getElementById("debug-card");
    if (debugCard) {
        debugCard.style.display = "block";
    }
    
    // Initial data load
    updateDashboard();
    getLocationAndForecast(false); // Start with normal accuracy
    
    // Set up automatic updates
    setInterval(updateDashboard, 30000);        // Update sensors every 30 seconds
    setInterval(() => {
        if (!isHighAccuracyMode) { // Only auto-update if not in high accuracy mode
            getLocationAndForecast(false);
        }
    }, 600000); // Update location/weather every 10 minutes
    
    console.log("Dashboard initialized successfully!");
}

// ===== Event Listeners =====
// Initialize when page loads
document.addEventListener('DOMContentLoaded', initializeDashboard);

// Handle page visibility changes
document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') {
        console.log("Page became visible - refreshing data");
        updateDashboard();
    } else {
        console.log("Page became hidden - stopping location watch");
        stopLocationWatch(); // Save battery when page is hidden
    }
});

// Handle online/offline status
window.addEventListener('online', function() {
    console.log("Connection restored - refreshing data");
    updateDashboard();
    if (lastKnownPosition) {
        getLocationAndForecast(isHighAccuracyMode);
    }
});

window.addEventListener('offline', function() {
    console.log("Connection lost");
    // Update UI to show offline status
    const statusEl = document.getElementById("status");
    statusEl.innerText = "⚠️ No Internet Connection";
    statusEl.className = "status";
    statusEl.style.backgroundColor = "rgba(243, 156, 18, 0.1)";
    statusEl.style.color = "#f39c12";
});

// Add error handling for global errors
window.addEventListener('error', function(e) {
    console.error('Global error caught:', e.error);
});

window.addEventListener('unhandledrejection', function(e) {
    console.error('Unhandled promise rejection:', e.reason);
});

// ===== Utility Functions =====
// Format time for display
function formatTime(date = new Date()) {
    return date.toLocaleTimeString('en-US', { 
        hour12: true, 
        hour: 'numeric', 
        minute: '2-digit', 
        second: '2-digit' 
    });
}

// Check if device supports high accuracy GPS
function supportsHighAccuracyGPS() {
    return 'geolocation' in navigator && 
           'getCurrentPosition' in navigator.geolocation &&
           'watchPosition' in navigator.geolocation;
}

// Get location permission status
async function getLocationPermissionStatus() {
    if ('permissions' in navigator) {
        try {
            const result = await navigator.permissions.query({ name: 'geolocation' });
            return result.state; // 'granted', 'denied', or 'prompt'
        } catch (error) {
            console.warn('Could not query geolocation permission:', error);
            return 'unknown';
        }
    }
    return 'unknown';
}

// Check network connectivity
function checkOnlineStatus() {
    return navigator.onLine;
}

// Battery optimization - reduce update frequency when battery is low
function optimizeForBattery() {
    if ('getBattery' in navigator) {
        navigator.getBattery().then(function(battery) {
            console.log('Battery level: ' + (battery.level * 100) + '%');
            
            // If battery is low, reduce update frequency
            if (battery.level < 0.2 && locationWatchId) {
                console.log('Low battery detected - stopping continuous location watch');
                stopLocationWatch();
            }
            
            battery.addEventListener('levelchange', function() {
                if (battery.level < 0.15) {
                    stopLocationWatch();
                }
            });
        });
    }
}

// ===== Export functions for debugging =====
window.debugFunctions = {
    refreshLocation,
    updateDashboard,
    checkDeviceStatus,
    getLocationAndForecast,
    getHighAccuracyLocation,
    toggleDebug,
    startLocationWatch,
    stopLocationWatch,
    optimizeForBattery,
    getLocationPermissionStatus
};

// ===== Initialize battery optimization =====
setTimeout(optimizeForBattery, 2000); // Check battery after 2 seconds

// ===== Performance monitoring =====
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(function() {
            const perfData = performance.timing;
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            console.log('Page load time:', loadTime + 'ms');
        }, 0);
    });
}