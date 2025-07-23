import { NextRequest, NextResponse } from "next/server";

// Function to detect if HTML contains RCS pattern data
function isRCSPattern(htmlContent: string): boolean {
  const rcsIndicators = [
    /RCS.*Pattern/i,
    /Radar.*Cross.*Section/i,
    /Optimized.*RCS/i,
    /scatterpolar/i, // Plotly polar scatter plots
    /"mode":\s*"lines".*"fill":\s*"toself"/i, // Filled polar plots
  ];
  
  return rcsIndicators.some(pattern => pattern.test(htmlContent));
}

// Function to process RCS data in HTML content
function processRCSHTML(htmlContent: string): string {
  // Look for Plotly data in the HTML
  const plotlyDataRegex = /Plotly\.newPlot\s*\(\s*["']([^"']+)["']\s*,\s*(\[[^\]]+\])/g;
  
  let processedHTML = htmlContent;
  let match;
  
  while ((match = plotlyDataRegex.exec(htmlContent)) !== null) {
    const [fullMatch, elementId, dataString] = match;
    
    try {
      // Parse the Plotly data
      const plotData = JSON.parse(dataString);
      
      // Process each trace that looks like RCS data
      const processedData = plotData.map((trace: any) => {
        if (trace.type === 'scatterpolar' && trace.r && trace.theta) {
          // This looks like RCS data - process it
          const processedTrace = { ...trace };
          
          // Convert data to our format
          const rcsData = trace.r.map((rcs: number, idx: number) => ({
            theta: trace.theta[idx],
            rcs: rcs
          }));
          
          // Apply fixes
          const fixedData = processRCSData(rcsData);
          
          // Update the trace
          processedTrace.r = fixedData.map((d: any) => d.rcs);
          processedTrace.theta = fixedData.map((d: any) => d.theta);
          
          // Ensure proper styling to avoid blue line artifacts
          if (!processedTrace.line) {
            processedTrace.line = {};
          }
          
          // Use a color that's not blue for the main trace
          if (!processedTrace.line.color) {
            processedTrace.line.color = 'rgba(124, 252, 0, 0.8)'; // Green
          }
          
          // Ensure fill is properly configured
          if (processedTrace.fill === 'toself') {
            processedTrace.fillcolor = processedTrace.fillcolor || 'rgba(124, 252, 0, 0.3)';
          }
          
          return processedTrace;
        }
        
        return trace;
      });
      
      // Replace the data in the HTML
      const newDataString = JSON.stringify(processedData);
      processedHTML = processedHTML.replace(fullMatch, 
        `Plotly.newPlot('${elementId}', ${newDataString}`);
      
    } catch (error) {
      console.warn("Could not process Plotly data:", error);
      // Continue with original data if processing fails
    }
  }
  
  return processedHTML;
}

// Simplified RCS data processing function
function processRCSData(data: Array<{theta: number, rcs: number}>): Array<{theta: number, rcs: number}> {
  if (!data || data.length === 0) return data;
  
  let processed = [...data];
  
  // 1. Fix NaN/infinite values
  for (let i = 0; i < processed.length; i++) {
    if (!isFinite(processed[i].rcs)) {
      // Find nearest valid value
      let replacement = 1e-10;
      for (let j = 1; j < processed.length; j++) {
        const prevIdx = (i - j + processed.length) % processed.length;
        const nextIdx = (i + j) % processed.length;
        
        if (isFinite(processed[prevIdx].rcs)) {
          replacement = processed[prevIdx].rcs;
          break;
        }
        if (isFinite(processed[nextIdx].rcs)) {
          replacement = processed[nextIdx].rcs;
          break;
        }
      }
      processed[i].rcs = replacement;
    }
  }
  
  // 2. Fix negative values
  processed = processed.map(point => ({
    ...point,
    rcs: point.rcs <= 0 ? 1e-10 : point.rcs
  }));
  
  // 3. Light smoothing to reduce discontinuities
  if (processed.length > 2) {
    const smoothed = [...processed];
    for (let i = 0; i < processed.length; i++) {
      const prev = processed[(i - 1 + processed.length) % processed.length];
      const curr = processed[i];
      const next = processed[(i + 1) % processed.length];
      
      // Simple 3-point smoothing
      smoothed[i].rcs = (prev.rcs + 2 * curr.rcs + next.rcs) / 4;
    }
    processed = smoothed;
  }
  
  // 4. Fix boundary discontinuity
  if (processed.length > 1) {
    const first = processed[0].rcs;
    const last = processed[processed.length - 1].rcs;
    const avgBoundary = (first + last) / 2;
    processed[0].rcs = avgBoundary;
    processed[processed.length - 1].rcs = avgBoundary;
  }
  
  return processed;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> }
) {
  try {
    // Await the params since they're a Promise in Next.js 15
    const { path } = await params;
    // Reconstruct the full URL from the path segments
    const fullPath = path.join("/");
    const plotlyUrl = `https://${fullPath}`;

    // Fetch the HTML content from the storage URL
    const response = await fetch(plotlyUrl);
    
    if (!response.ok) {
      return new NextResponse("Graph not found", { status: 404 });
    }

    let htmlContent = await response.text();

    // Check if this is an RCS pattern and process it
    if (isRCSPattern(htmlContent)) {
      console.log("Detected RCS pattern, applying fixes for blue line issues...");
      htmlContent = processRCSHTML(htmlContent);
    }

    // Return the HTML with proper content-type headers
    return new NextResponse(htmlContent, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "X-Frame-Options": "SAMEORIGIN",
        "Content-Security-Policy": "frame-ancestors 'self'",
      },
    });
  } catch (error) {
    console.error("Error serving Plotly graph:", error);
    return new NextResponse("Error loading graph", { status: 500 });
  }
}