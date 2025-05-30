/**
 * Google Apps Script for collecting WebAR performance data
 * 
 * This script receives performance metrics from the WebAR application
 * and stores them in a Google Sheet. To use this:
 * 
 * 1. Create a new Google Sheet
 * 2. Go to Extensions > Apps Script
 * 3. Replace the default content with this code
 * 4. Deploy as a web app (accessible to anyone)
 * 5. Copy the web app URL and use it in performance-tracker.js
 */

/**
 * Set CORS headers for cross-origin requests
 */
function setCorsHeaders(resp) {
  resp.setHeader('Access-Control-Allow-Origin', '*');
  resp.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  resp.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return resp;
}

/**
 * Explicitly set CORS headers for OPTIONS requests
 */
function doOptions(e) {
  return ContentService.createTextOutput("")
      .setMimeType(ContentService.MimeType.TEXT)
      .setHeader("Access-Control-Allow-Origin", "*")
      .setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS")
      .setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type")
      .setHeader("Access-Control-Max-Age", "86400");
}

/**
 * Add CORS headers to any response
 */
function addCorsHeaders(resp) {
  resp.setHeader("Access-Control-Allow-Origin", "*");
  resp.setHeader("Access-Control-Allow-Methods", "GET, POST, DELETE, PUT, OPTIONS");
  resp.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
  return resp;
}

// Updated sheet column headers to match all metrics from performance-tracker.js
const HEADERS = [
  'Session ID',
  'Timestamp',
  'Elapsed Time (s)',
  'FPS',
  'Latency (ms)',
  'Memory (MB)',
  'CPU (%)',
  'GPU Info',
  'GPU Usage (%)',
  'Tracking Quality',
  'Tracking Confidence',
  'Surfaces Detected',
  'Dropped Frames',
  'Total Frames',
  'Render Time (ms)',
  'JS Execution Time (ms)',
  'GC Time (ms)',
  'Object Timing Data',
  'AR Mode',
  'User Agent',
  'Screen Width',
  'Screen Height',
  'Device Pixel Ratio'
];

/**
 * Process GET requests (for testing the endpoint)
 */
function doGet() {
  var resp = ContentService.createTextOutput();
  resp = setCorsHeaders(resp);
  
  return resp.setContent(JSON.stringify({
    status: 'success',
    message: 'WebAR Performance Tracking API is active',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Process POST requests from the WebAR application
 */
function doPost(e) {
  try {
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);
    
    // Get active spreadsheet and sheet
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName('AR Performance Data WL');
    
    // Create sheet if it doesn't exist
    if (!sheet) {
      sheet = ss.insertSheet('AR Performance Data WL');
      sheet.appendRow(HEADERS);
      
      // Format headers
      sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
      sheet.setFrozenRows(1);
    }
    
    // Format date for Google Sheets
    const formatDate = (date) => {
      return Utilities.formatDate(new Date(date), Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm:ss");
    };
    
    // Process object timings
    let objectTimingsString = "";
    if (data.objectTimings) {
      try {
        // Check if objectTimings is already a string or an object
        if (typeof data.objectTimings === 'string') {
          objectTimingsString = data.objectTimings;
        } else {
          objectTimingsString = JSON.stringify(data.objectTimings);
        }
      } catch (err) {
        console.log("Error processing object timings: " + err);
        objectTimingsString = "Error: " + err.toString();
      }
    }

    // Prepare row data in the correct order, matching HEADERS
    const rowData = [
      data.sessionId || '',
      data.timestamp ? formatDate(new Date(data.timestamp)) : formatDate(new Date()),
      data.elapsedTime || '',
      data.fps || '',
      data.latency || '',
      data.memory || '',
      data.cpu || '',
      data.gpu || '',
      data.gpuUsage || '',
      data.trackingQuality || '',
      data.trackingConfidence || '',
      data.surfacesDetected || '',
      data.droppedFrames || '',
      data.totalFrames || '',
      data.renderTime || '',
      data.jsExecutionTime || '',
      data.gcTime || '',
      objectTimingsString || '',
      data.arMode || '',
      data.userAgent || '',
      data.screenWidth || '',
      data.screenHeight || '',
      data.devicePixelRatio || ''
    ];
    
    // Append data row
    sheet.appendRow(rowData);
    
    // Return success response
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      message: 'Data recorded successfully',
      recordedFields: HEADERS
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
    
  } catch (error) {
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    }))
    .setMimeType(ContentService.MimeType.JSON)
    .setHeader("Access-Control-Allow-Origin", "*");
  }
}

/**
 * Generate a summary report of performance data
 */
function generateSummaryReport() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('AR Performance Data WL');
  
  // Exit if no data sheet exists
  if (!dataSheet) {
    SpreadsheetApp.getUi().alert('No performance data found!');
    return;
  }
  
  // Get all data
  const data = dataSheet.getDataRange().getValues();
  const headers = data[0];
  const rows = data.slice(1);
  
  // Exit if no data rows
  if (rows.length === 0) {
    SpreadsheetApp.getUi().alert('No performance data rows found!');
    return;
  }
  
  // Create or get summary sheet
  let summarySheet = ss.getSheetByName('Performance Summary');
  if (!summarySheet) {
    summarySheet = ss.insertSheet('Performance Summary');
  } else {
    summarySheet.clear();
  }
  
  // Find column indexes
  const fpsIndex = headers.indexOf('FPS');
  const latencyIndex = headers.indexOf('Latency (ms)');
  const sessionIdIndex = headers.indexOf('Session ID');
  const trackingQualityIndex = headers.indexOf('Tracking Quality');
  const cpuIndex = headers.indexOf('CPU (%)');
  const gpuUsageIndex = headers.indexOf('GPU Usage (%)');
  const renderTimeIndex = headers.indexOf('Render Time (ms)');
  const memoryIndex = headers.indexOf('Memory (MB)');
  
  // Calculate metrics
  const sessions = {};
  
  rows.forEach(row => {
    const sessionId = row[sessionIdIndex];
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        fps: [],
        latency: [],
        cpu: [],
        gpuUsage: [],
        renderTime: [],
        memory: [],
        trackingQuality: {}
      };
    }
    
    if (!isNaN(row[fpsIndex]) && row[fpsIndex] !== '') {
      sessions[sessionId].fps.push(Number(row[fpsIndex]));
    }
    
    if (!isNaN(row[latencyIndex]) && row[latencyIndex] !== '') {
      sessions[sessionId].latency.push(Number(row[latencyIndex]));
    }
    
    if (!isNaN(row[cpuIndex]) && row[cpuIndex] !== '') {
      sessions[sessionId].cpu.push(Number(row[cpuIndex]));
    }
    
    if (!isNaN(row[gpuUsageIndex]) && row[gpuUsageIndex] !== '') {
      sessions[sessionId].gpuUsage.push(Number(row[gpuUsageIndex]));
    }
    
    if (!isNaN(row[renderTimeIndex]) && row[renderTimeIndex] !== '') {
      sessions[sessionId].renderTime.push(Number(row[renderTimeIndex]));
    }
    
    if (!isNaN(row[memoryIndex]) && row[memoryIndex] !== '') {
      sessions[sessionId].memory.push(Number(row[memoryIndex]));
    }
    
    const quality = row[trackingQualityIndex];
    if (quality) {
      sessions[sessionId].trackingQuality[quality] = 
        (sessions[sessionId].trackingQuality[quality] || 0) + 1;
    }
  });
  
  // Calculate averages for each session
  const summaryData = [];
  summaryData.push([
    'Session ID', 
    'Data Points', 
    'Avg FPS', 
    'Min FPS', 
    'Max FPS', 
    'Avg Latency (ms)',
    'Avg CPU (%)',
    'Avg GPU Usage (%)',
    'Avg Render Time (ms)',
    'Avg Memory (MB)',
    'Primary Tracking Quality'
  ]);
  
  Object.keys(sessions).forEach(sessionId => {
    const session = sessions[sessionId];
    
    const avgFps = session.fps.length > 0 ? 
      session.fps.reduce((a, b) => a + b, 0) / session.fps.length : 'N/A';
    
    const minFps = session.fps.length > 0 ? 
      Math.min(...session.fps) : 'N/A';
      
    const maxFps = session.fps.length > 0 ? 
      Math.max(...session.fps) : 'N/A';
    
    const avgLatency = session.latency.length > 0 ? 
      session.latency.reduce((a, b) => a + b, 0) / session.latency.length : 'N/A';
      
    const avgCpu = session.cpu.length > 0 ? 
      session.cpu.reduce((a, b) => a + b, 0) / session.cpu.length : 'N/A';
      
    const avgGpuUsage = session.gpuUsage.length > 0 ? 
      session.gpuUsage.reduce((a, b) => a + b, 0) / session.gpuUsage.length : 'N/A';
      
    const avgRenderTime = session.renderTime.length > 0 ? 
      session.renderTime.reduce((a, b) => a + b, 0) / session.renderTime.length : 'N/A';
      
    const avgMemory = session.memory.length > 0 ? 
      session.memory.reduce((a, b) => a + b, 0) / session.memory.length : 'N/A';
    
    // Find most common tracking quality
    let primaryQuality = 'N/A';
    let maxCount = 0;
    
    Object.keys(session.trackingQuality).forEach(quality => {
      if (session.trackingQuality[quality] > maxCount) {
        maxCount = session.trackingQuality[quality];
        primaryQuality = quality;
      }
    });
    
    summaryData.push([
      sessionId,
      session.fps.length,
      avgFps !== 'N/A' ? avgFps.toFixed(1) : 'N/A',
      minFps !== 'N/A' ? minFps : 'N/A',
      maxFps !== 'N/A' ? maxFps : 'N/A',
      avgLatency !== 'N/A' ? avgLatency.toFixed(1) : 'N/A',
      avgCpu !== 'N/A' ? avgCpu.toFixed(1) : 'N/A',
      avgGpuUsage !== 'N/A' ? avgGpuUsage.toFixed(1) : 'N/A',
      avgRenderTime !== 'N/A' ? avgRenderTime.toFixed(1) : 'N/A',
      avgMemory !== 'N/A' ? avgMemory.toFixed(1) : 'N/A',
      primaryQuality
    ]);
  });
  
  // Write summary data
  summarySheet.getRange(1, 1, summaryData.length, summaryData[0].length)
    .setValues(summaryData);
  
  // Format the summary sheet
  summarySheet.getRange(1, 1, 1, summaryData[0].length).setFontWeight('bold');
  summarySheet.setFrozenRows(1);
  summarySheet.autoResizeColumns(1, summaryData[0].length);
  
  // Create charts
  createPerformanceCharts(ss, rows, headers);
  
  SpreadsheetApp.getUi().alert('Performance summary report generated!');
}

/**
 * Create performance visualization charts
 */
function createPerformanceCharts(ss, rows, headers) {
  // Find column indexes
  const fpsIndex = headers.indexOf('FPS');
  const latencyIndex = headers.indexOf('Latency (ms)');
  const timestampIndex = headers.indexOf('Timestamp');
  const sessionIdIndex = headers.indexOf('Session ID');
  const cpuIndex = headers.indexOf('CPU (%)');
  const gpuUsageIndex = headers.indexOf('GPU Usage (%)');
  const memoryIndex = headers.indexOf('Memory (MB)');
  
  // Create or get charts sheet
  let chartsSheet = ss.getSheetByName('Performance Charts');
  if (!chartsSheet) {
    chartsSheet = ss.insertSheet('Performance Charts');
  } else {
    chartsSheet.clear();
    const charts = chartsSheet.getCharts();
    charts.forEach(chart => chartsSheet.removeChart(chart));
  }
  
  // Create headers for chart data
  chartsSheet.getRange(1, 1).setValue('Timestamp');
  chartsSheet.getRange(1, 2).setValue('FPS');
  chartsSheet.getRange(1, 3).setValue('Latency (ms)');
  chartsSheet.getRange(1, 4).setValue('CPU (%)'); 
  chartsSheet.getRange(1, 5).setValue('GPU Usage (%)');
  chartsSheet.getRange(1, 6).setValue('Memory (MB)');
  chartsSheet.getRange(1, 7).setValue('Session ID');
  
  // Get the most recent session
  const sessions = [...new Set(rows.map(row => row[sessionIdIndex]))];
  const recentSession = sessions[sessions.length - 1];
  
  // Filter data for the most recent session
  const sessionData = rows.filter(row => row[sessionIdIndex] === recentSession);
  
  // Add data to charts sheet
  for (let i = 0; i < sessionData.length; i++) {
    const row = sessionData[i];
    chartsSheet.getRange(i + 2, 1).setValue(row[timestampIndex]);
    chartsSheet.getRange(i + 2, 2).setValue(row[fpsIndex]);
    chartsSheet.getRange(i + 2, 3).setValue(row[latencyIndex]);
    chartsSheet.getRange(i + 2, 4).setValue(row[cpuIndex]);
    chartsSheet.getRange(i + 2, 5).setValue(row[gpuUsageIndex]);
    chartsSheet.getRange(i + 2, 6).setValue(row[memoryIndex]);
    chartsSheet.getRange(i + 2, 7).setValue(row[sessionIdIndex]);
  }
  
  // Create FPS chart
  const fpsRange = chartsSheet.getRange(1, 1, sessionData.length + 1, 2);
  const fpsChart = chartsSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(fpsRange)
    .setPosition(5, 1, 0, 0)
    .setOption('title', 'FPS Over Time')
    .setOption('legend', {position: 'none'})
    .setOption('hAxis.title', 'Time')
    .setOption('vAxis.title', 'FPS')
    .setOption('width', 600)
    .setOption('height', 400)
    .build();
  
  chartsSheet.insertChart(fpsChart);
  
  // Create Latency chart
  const latencyRange = chartsSheet.getRange(1, 1, sessionData.length + 1, 3);
  const latencyChart = chartsSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(latencyRange)
    .setPosition(5, 10, 0, 0)
    .setOption('title', 'Latency Over Time')
    .setOption('legend', {position: 'none'})
    .setOption('hAxis.title', 'Time')
    .setOption('vAxis.title', 'Latency (ms)')
    .setOption('width', 600)
    .setOption('height', 400)
    .build();
  
  chartsSheet.insertChart(latencyChart);
  
  // Create CPU/GPU Usage chart
  const cpuGpuRange = chartsSheet.getRange(1, 1, sessionData.length + 1, 6);
  cpuGpuRange.setValues(cpuGpuRange.getValues());
  
  const cpuGpuChart = chartsSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(chartsSheet.getRange(1, 1, sessionData.length + 1, 1)) // Timestamp
    .addRange(chartsSheet.getRange(1, 4, sessionData.length + 1, 2)) // CPU & GPU
    .setPosition(415, 1, 0, 0)
    .setOption('title', 'CPU & GPU Usage Over Time')
    .setOption('series', {
      0: {targetAxisIndex: 0, label: 'CPU (%)'},
      1: {targetAxisIndex: 0, label: 'GPU (%)'}
    })
    .setOption('hAxis.title', 'Time')
    .setOption('vAxis.title', 'Usage (%)')
    .setOption('width', 600)
    .setOption('height', 400)
    .build();
  
  chartsSheet.insertChart(cpuGpuChart);
  
  // Create Memory Usage chart
  const memoryRange = chartsSheet.getRange(1, 1, sessionData.length + 1, 1) // Timestamp
    .getSheet().getRange(1, 1, sessionData.length + 1, 1);
  const memoryDataRange = chartsSheet.getRange(1, 6, sessionData.length + 1, 1); // Memory
  
  const memoryChart = chartsSheet.newChart()
    .setChartType(Charts.ChartType.LINE)
    .addRange(memoryRange)
    .addRange(memoryDataRange)
    .setPosition(415, 10, 0, 0)
    .setOption('title', 'Memory Usage Over Time')
    .setOption('legend', {position: 'none'})
    .setOption('hAxis.title', 'Time')
    .setOption('vAxis.title', 'Memory (MB)')
    .setOption('width', 600)
    .setOption('height', 400)
    .build();
  
  chartsSheet.insertChart(memoryChart);
}

/**
 * Add menu when spreadsheet opens
 */
function onOpen() {
  const ui = SpreadsheetApp.getUi();
  ui.createMenu('WebAR Analytics')
    .addItem('Generate Summary Report', 'generateSummaryReport')
    .addSeparator()
    .addItem('Clear All Data', 'clearAllData')
    .addToUi();
}

/**
 * Clear all collected data
 */
function clearAllData() {
  const ui = SpreadsheetApp.getUi();
  const response = ui.alert(
    'Clear all data?',
    'Are you sure you want to clear all performance data? This cannot be undone.',
    ui.ButtonSet.YES_NO
  );
  
  if (response !== ui.Button.YES) {
    return;
  }
  
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const dataSheet = ss.getSheetByName('AR Performance Data WL');
  
  if (dataSheet) {
    const headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
    dataSheet.clear();
    dataSheet.appendRow(headers);
  }
  
  // Also clear summary and charts
  const summarySheet = ss.getSheetByName('Performance Summary');
  if (summarySheet) {
    summarySheet.clear();
  }
  
  const chartsSheet = ss.getSheetByName('Performance Charts');
  if (chartsSheet) {
    chartsSheet.clear();
    const charts = chartsSheet.getCharts();
    charts.forEach(chart => chartsSheet.removeChart(chart));
  }
  
  ui.alert('All performance data has been cleared.');
}