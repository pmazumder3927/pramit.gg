import { NextRequest, NextResponse } from "next/server";

/**
 * API endpoint to process RCS data and fix common visualization issues
 * that cause blue lines in polar plots.
 * 
 * This endpoint can be called with RCS data to clean and process it
 * before visualization.
 */

interface RCSDataPoint {
  theta: number;  // Angle in degrees
  rcs: number;    // RCS value
}

interface ProcessRCSRequest {
  data: RCSDataPoint[];
  options?: {
    smoothData?: boolean;
    convertToDb?: boolean;
    minDbValue?: number;
    smoothingSigma?: number;
  };
}

interface ProcessRCSResponse {
  processedData: RCSDataPoint[];
  processingInfo: {
    originalIssues: string[];
    fixesApplied: string[];
    finalRange: [number, number];
    dataPoints: number;
  };
  success: boolean;
  error?: string;
}

function validateRCSData(data: RCSDataPoint[]): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  if (!data || data.length === 0) {
    issues.push("No data provided");
    return { isValid: false, issues };
  }
  
  // Check for NaN or infinite values
  const nanCount = data.filter(point => !isFinite(point.rcs)).length;
  if (nanCount > 0) {
    issues.push(`Found ${nanCount} NaN/infinite values`);
  }
  
  // Check for negative values (physically impossible for RCS)
  const negativeCount = data.filter(point => point.rcs < 0).length;
  if (negativeCount > 0) {
    issues.push(`Found ${negativeCount} negative RCS values`);
  }
  
  // Check for sharp discontinuities
  if (data.length > 1) {
    let sharpTransitions = 0;
    const rcsValues = data.map(p => p.rcs).filter(v => isFinite(v));
    const meanRcs = rcsValues.reduce((a, b) => a + b, 0) / rcsValues.length;
    
    for (let i = 1; i < data.length; i++) {
      const diff = Math.abs(data[i].rcs - data[i-1].rcs);
      if (diff > meanRcs * 2 && isFinite(data[i].rcs) && isFinite(data[i-1].rcs)) {
        sharpTransitions++;
      }
    }
    
    if (sharpTransitions > data.length * 0.05) {
      issues.push(`Found ${sharpTransitions} sharp discontinuities`);
    }
  }
  
  // Check boundary continuity for polar plots
  if (data.length > 1) {
    const first = data[0].rcs;
    const last = data[data.length - 1].rcs;
    if (isFinite(first) && isFinite(last)) {
      const boundaryDiff = Math.abs(first - last);
      const meanValue = data.filter(p => isFinite(p.rcs))
                           .reduce((sum, p) => sum + p.rcs, 0) / 
                        data.filter(p => isFinite(p.rcs)).length;
      
      if (boundaryDiff > 0.1 * meanValue) {
        issues.push("Discontinuity at 0°/360° boundary");
      }
    }
  }
  
  return { isValid: issues.length === 0, issues };
}

function interpolateNaNValues(data: RCSDataPoint[]): RCSDataPoint[] {
  const result = [...data];
  
  // Find NaN/infinite values and interpolate
  for (let i = 0; i < result.length; i++) {
    if (!isFinite(result[i].rcs)) {
      // Find nearest valid values
      let prevValid = -1;
      let nextValid = -1;
      
      // Look backwards
      for (let j = i - 1; j >= 0; j--) {
        if (isFinite(result[j].rcs)) {
          prevValid = j;
          break;
        }
      }
      
      // Look forwards
      for (let j = i + 1; j < result.length; j++) {
        if (isFinite(result[j].rcs)) {
          nextValid = j;
          break;
        }
      }
      
      // Interpolate
      if (prevValid >= 0 && nextValid >= 0) {
        const ratio = (i - prevValid) / (nextValid - prevValid);
        result[i].rcs = result[prevValid].rcs + 
                       ratio * (result[nextValid].rcs - result[prevValid].rcs);
      } else if (prevValid >= 0) {
        result[i].rcs = result[prevValid].rcs;
      } else if (nextValid >= 0) {
        result[i].rcs = result[nextValid].rcs;
      } else {
        result[i].rcs = 1e-10; // Minimum positive value
      }
    }
  }
  
  return result;
}

function fixNegativeValues(data: RCSDataPoint[], minValue: number = 1e-10): RCSDataPoint[] {
  return data.map(point => ({
    ...point,
    rcs: point.rcs <= 0 ? minValue : point.rcs
  }));
}

function smoothData(data: RCSDataPoint[], sigma: number = 1.0): RCSDataPoint[] {
  if (data.length < 3) return data;
  
  // Simple Gaussian-like smoothing
  const result = [...data];
  const window = Math.max(3, Math.floor(sigma * 2));
  
  for (let i = 0; i < data.length; i++) {
    let sum = 0;
    let count = 0;
    
    for (let j = -window; j <= window; j++) {
      // Wrap around for polar data
      let idx = (i + j + data.length) % data.length;
      const weight = Math.exp(-(j * j) / (2 * sigma * sigma));
      sum += data[idx].rcs * weight;
      count += weight;
    }
    
    result[i].rcs = sum / count;
  }
  
  return result;
}

function convertToDb(data: RCSDataPoint[], minDb: number = -50): RCSDataPoint[] {
  return data.map(point => ({
    ...point,
    rcs: Math.max(10 * Math.log10(Math.max(point.rcs, 1e-10)), minDb)
  }));
}

function fixBoundaryDiscontinuity(data: RCSDataPoint[]): RCSDataPoint[] {
  if (data.length < 2) return data;
  
  const result = [...data];
  const first = result[0].rcs;
  const last = result[result.length - 1].rcs;
  
  const boundaryDiff = Math.abs(first - last);
  const meanValue = result.reduce((sum, p) => sum + p.rcs, 0) / result.length;
  
  if (boundaryDiff > 0.1 * meanValue) {
    const avgBoundary = (first + last) / 2;
    result[0].rcs = avgBoundary;
    result[result.length - 1].rcs = avgBoundary;
  }
  
  return result;
}

export async function POST(req: NextRequest) {
  try {
    const body: ProcessRCSRequest = await req.json();
    
    if (!body.data || !Array.isArray(body.data)) {
      return NextResponse.json({
        success: false,
        error: "Invalid data format. Expected array of {theta, rcs} objects."
      } as ProcessRCSResponse, { status: 400 });
    }
    
    const options = {
      smoothData: body.options?.smoothData ?? true,
      convertToDb: body.options?.convertToDb ?? true,
      minDbValue: body.options?.minDbValue ?? -50,
      smoothingSigma: body.options?.smoothingSigma ?? 1.0,
    };
    
    // Validate original data
    const { isValid, issues } = validateRCSData(body.data);
    
    // Process the data step by step
    let processedData = [...body.data];
    const fixesApplied: string[] = [];
    
    // 1. Interpolate NaN/infinite values
    const hasNaN = processedData.some(p => !isFinite(p.rcs));
    if (hasNaN) {
      processedData = interpolateNaNValues(processedData);
      fixesApplied.push("Interpolated NaN/infinite values");
    }
    
    // 2. Fix negative values
    const hasNegative = processedData.some(p => p.rcs < 0);
    if (hasNegative) {
      processedData = fixNegativeValues(processedData);
      fixesApplied.push("Fixed negative RCS values");
    }
    
    // 3. Apply smoothing if requested
    if (options.smoothData) {
      processedData = smoothData(processedData, options.smoothingSigma);
      fixesApplied.push("Applied smoothing");
    }
    
    // 4. Fix boundary discontinuity
    processedData = fixBoundaryDiscontinuity(processedData);
    fixesApplied.push("Fixed boundary continuity");
    
    // 5. Convert to dB scale if requested
    if (options.convertToDb) {
      processedData = convertToDb(processedData, options.minDbValue);
      fixesApplied.push("Converted to dB scale");
    }
    
    // Calculate final range
    const rcsValues = processedData.map(p => p.rcs);
    const finalRange: [number, number] = [
      Math.min(...rcsValues),
      Math.max(...rcsValues)
    ];
    
    const response: ProcessRCSResponse = {
      processedData,
      processingInfo: {
        originalIssues: issues,
        fixesApplied,
        finalRange,
        dataPoints: processedData.length
      },
      success: true
    };
    
    return NextResponse.json(response, {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Cache-Control": "no-cache",
      },
    });
    
  } catch (error) {
    console.error("Error processing RCS data:", error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error occurred"
    } as ProcessRCSResponse, { status: 500 });
  }
}

// Also support GET for health check
export async function GET() {
  return NextResponse.json({
    message: "RCS data processing endpoint is active",
    endpoints: {
      POST: "/api/plotly/process-rcs - Process RCS data to fix visualization issues"
    }
  });
}