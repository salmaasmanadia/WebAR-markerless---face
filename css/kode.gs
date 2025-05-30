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
 * Set CORS headers untuk mengizinkan permintaan cross-origin
 */
function setCorsHeaders(resp) {
  resp.setHeader('Access-Control-Allow-Origin', '*');
  resp.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  resp.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  return resp;
}

/**
 * Explicitly set CORS headers
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

// Lalu di doPost()
function doPost(e) {
  const resp = ContentService.createTextOutput();
  const contentType = e.postData.type;
  if (contentType !== 'application/json' && contentType !== 'text/plain') {
    throw new Error("Unsupported content type: " + contentType);
  }
  
  try {
    // Parsing data 
    let data;
    if (e.postData && e.postData.contents) {
      data = JSON.parse(e.postData.contents);
    } else if (e.parameter && e.parameter.data) {
      data = JSON.parse(e.parameter.data);
    } else {
      throw new Error("No data received");
    }
    
    // Proses data seperti biasa...
    
    // Return success dengan CORS headers
    return addCorsHeaders(resp.setContent(JSON.stringify({
      status: 'success',
      message: 'Data recorded successfully'
    })).setMimeType(ContentService.MimeType.JSON));
    
  } catch (error) {
    return addCorsHeaders(resp.setContent(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON));
  }
}
function doGet() {
  var resp = ContentService.createTextOutput();
  resp = setCorsHeaders(resp);
  
  return resp.setContent(JSON.stringify({
    status: 'success',
    message: 'WebAR Performance Tracking API is active',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
}


// Sheet column headers
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



function doGet(e) {
  const origin = e?.parameter?.origin ?? '';
  const allowedOrigins = ['https://armarkerlesswl.netlify.app'];
  const isAllowed = allowedOrigins.includes(origin);

  const response = ContentService.createTextOutput("✅ WebAR API aktif.")
    .setMimeType(ContentService.MimeType.TEXT);

  if (isAllowed) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "Content-Type");
  }

  return response;
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
    
    // Prepare row data in the correct order

  const formatDate = (date) => {
    return Utilities.formatDate(date, Session.getScriptTimeZone(), "dd-MMM-yyyy HH:mm");
  };


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
      message: 'Data recorded successfully'
    })).setMimeType(ContentService.MimeType.JSON);
    
  } catch (error) {
    // Return error response
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: error.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Process GET requests (for testing the endpoint)
 */
function doGet() {
  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    message: 'WebAR Performance Tracking API is active',
    timestamp: new Date().toISOString()
  })).setMimeType(ContentService.MimeType.JSON);
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
  
  // Calculate metrics
  const sessions = {};
  
  rows.forEach(row => {
    const sessionId = row[sessionIdIndex];
    if (!sessions[sessionId]) {
      sessions[sessionId] = {
        fps: [],
        latency: [],
        trackingQuality: {}
      };
    }
    
    if (!isNaN(row[fpsIndex]) && row[fpsIndex] !== '') {
      sessions[sessionId].fps.push(Number(row[fpsIndex]));
    }
    
    if (!isNaN(row[latencyIndex]) && row[latencyIndex] !== '') {
      sessions[sessionId].latency.push(Number(row[latencyIndex]));
    }
    
    const quality = row[trackingQualityIndex];
    if (quality) {
      sessions[sessionId].trackingQuality[quality] = 
        (sessions[sessionId].trackingQuality[quality] || 0) + 1;
    }
  });
  
  // Calculate averages for each session
  const summaryData = [];
  summaryData.push(['Session ID', 'Data Points', 'Avg FPS', 'Min FPS', 'Max FPS', 
                   'Avg Latency (ms)', 'Primary Tracking Quality']);
  
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
  
  // Create or get charts sheet
  let chartsSheet = ss.getSheetByName('Performance Charts');
  if (!chartsSheet) {
    chartsSheet = ss.insertSheet('Performance Charts');
  } else {
    chartsSheet.clear();
    const charts = chartsSheet.getCharts();
    charts.forEach(chart => chartsSheet.removeChart(chart));
  }
  
  // Create data for charts
  chartsSheet.getRange(1, 1).setValue('Timestamp');
  chartsSheet.getRange(1, 2).setValue('FPS');
  chartsSheet.getRange(1, 3).setValue('Latency (ms)');
  chartsSheet.getRange(1, 4).setValue('Session ID');
  
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
    chartsSheet.getRange(i + 2, 4).setValue(row[sessionIdIndex]);
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
  latencyRange.setValues(latencyRange.getValues());
  
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
    .setOption('series', {1: {targetAxisIndex: 1}})
    .build();
  
  chartsSheet.insertChart(latencyChart);
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