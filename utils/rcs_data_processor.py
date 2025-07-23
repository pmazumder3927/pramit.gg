"""
RCS Data Processing Utility

This module provides functions to clean and fix RCS (Radar Cross Section) data
that commonly causes visualization artifacts like unwanted blue lines in polar plots.

Common issues addressed:
1. NaN or infinite values
2. Negative RCS values (physically impossible)
3. Sharp discontinuities from insufficient mesh resolution
4. Boundary condition errors at 0°/360°
5. Numerical artifacts from method of moments calculations
"""

import numpy as np
from typing import Tuple, Optional
import logging

logger = logging.getLogger(__name__)

def validate_rcs_data(theta: np.ndarray, rcs_data: np.ndarray) -> Tuple[bool, list]:
    """
    Validate RCS data and identify potential issues.
    
    Args:
        theta: Angular positions in radians
        rcs_data: RCS values
        
    Returns:
        Tuple of (is_valid, issues_list)
    """
    issues = []
    
    # Check for NaN or infinite values
    nan_count = np.sum(~np.isfinite(rcs_data))
    if nan_count > 0:
        issues.append(f"Found {nan_count} NaN/infinite values")
    
    # Check for negative values (physically impossible for RCS)
    negative_count = np.sum(rcs_data < 0)
    if negative_count > 0:
        issues.append(f"Found {negative_count} negative RCS values")
    
    # Check for sharp discontinuities
    if len(rcs_data) > 1:
        gradients = np.abs(np.gradient(rcs_data))
        high_gradient_threshold = np.percentile(gradients, 95)
        high_gradient_count = np.sum(gradients > high_gradient_threshold * 3)
        if high_gradient_count > len(rcs_data) * 0.05:  # More than 5% high gradients
            issues.append(f"Found {high_gradient_count} sharp discontinuities")
    
    # Check boundary continuity for polar plots
    if len(rcs_data) > 1:
        boundary_diff = abs(rcs_data[0] - rcs_data[-1])
        mean_value = np.mean(rcs_data[np.isfinite(rcs_data)])
        if boundary_diff > 0.1 * mean_value:
            issues.append("Discontinuity at 0°/360° boundary")
    
    return len(issues) == 0, issues

def fix_rcs_data(theta: np.ndarray, rcs_data: np.ndarray, 
                 smooth_sigma: float = 1.0, 
                 min_rcs_value: float = 1e-10) -> np.ndarray:
    """
    Fix common issues in RCS data that cause visualization artifacts.
    
    Args:
        theta: Angular positions in radians
        rcs_data: RCS values to fix
        smooth_sigma: Gaussian smoothing sigma for discontinuities
        min_rcs_value: Minimum positive RCS value to use
        
    Returns:
        Fixed RCS data array
    """
    fixed_data = rcs_data.copy()
    
    # 1. Handle NaN and infinite values
    nan_mask = ~np.isfinite(fixed_data)
    if np.any(nan_mask):
        logger.info(f"Interpolating {np.sum(nan_mask)} NaN/infinite values")
        # Interpolate NaN values
        valid_indices = np.where(~nan_mask)[0]
        if len(valid_indices) > 1:
            fixed_data[nan_mask] = np.interp(
                np.where(nan_mask)[0], 
                valid_indices, 
                fixed_data[valid_indices]
            )
        else:
            # If too few valid points, set to minimum value
            fixed_data[nan_mask] = min_rcs_value
    
    # 2. Handle negative values (set to small positive value)
    negative_mask = fixed_data < 0
    if np.any(negative_mask):
        logger.info(f"Setting {np.sum(negative_mask)} negative values to minimum positive value")
        fixed_data[negative_mask] = min_rcs_value
    
    # 3. Ensure minimum positive values
    zero_mask = fixed_data <= 0
    if np.any(zero_mask):
        fixed_data[zero_mask] = min_rcs_value
    
    # 4. Smooth sharp discontinuities
    try:
        from scipy import ndimage
        # Apply light Gaussian smoothing with wrap-around for polar data
        fixed_data = ndimage.gaussian_filter1d(fixed_data, sigma=smooth_sigma, mode='wrap')
    except ImportError:
        # Fallback: simple moving average with wrap-around
        logger.warning("scipy not available, using simple moving average")
        window = max(3, int(smooth_sigma * 2))
        if window >= len(fixed_data):
            window = 3
        
        # Pad with wrap-around for polar data
        padded = np.concatenate([fixed_data[-window//2:], fixed_data, fixed_data[:window//2]])
        smoothed = np.convolve(padded, np.ones(window)/window, mode='valid')
        
        # Ensure we get the right length
        if len(smoothed) == len(fixed_data):
            fixed_data = smoothed
        else:
            # Trim to correct size
            start_idx = (len(smoothed) - len(fixed_data)) // 2
            fixed_data = smoothed[start_idx:start_idx + len(fixed_data)]
    
    # 5. Ensure boundary continuity for polar plots
    if len(fixed_data) > 1:
        boundary_diff = abs(fixed_data[0] - fixed_data[-1])
        mean_value = np.mean(fixed_data)
        if boundary_diff > 0.1 * mean_value:
            logger.info("Fixing discontinuity at 0°/360° boundary")
            avg_boundary = (fixed_data[0] + fixed_data[-1]) / 2
            fixed_data[0] = avg_boundary
            fixed_data[-1] = avg_boundary
    
    return fixed_data

def convert_rcs_to_db(rcs_linear: np.ndarray, min_db: float = -50.0) -> np.ndarray:
    """
    Convert linear RCS values to dB scale with proper handling of small values.
    
    Args:
        rcs_linear: RCS values in linear scale
        min_db: Minimum dB value to clamp to
        
    Returns:
        RCS values in dB scale
    """
    # Ensure positive values
    rcs_positive = np.maximum(rcs_linear, 1e-10)
    
    # Convert to dB
    rcs_db = 10 * np.log10(rcs_positive)
    
    # Clamp minimum dB value to avoid extremely negative values
    rcs_db = np.maximum(rcs_db, min_db)
    
    return rcs_db

def process_rcs_for_visualization(theta: np.ndarray, rcs_data: np.ndarray,
                                  smooth_data: bool = True,
                                  convert_to_db: bool = True,
                                  validate_first: bool = True) -> Tuple[np.ndarray, np.ndarray, dict]:
    """
    Complete processing pipeline for RCS data before visualization.
    
    Args:
        theta: Angular positions in radians
        rcs_data: Raw RCS values
        smooth_data: Whether to apply smoothing
        convert_to_db: Whether to convert to dB scale
        validate_first: Whether to validate and report issues
        
    Returns:
        Tuple of (processed_theta, processed_rcs, processing_info)
    """
    processing_info = {
        'original_issues': [],
        'fixes_applied': [],
        'final_range': None,
        'data_points': len(rcs_data)
    }
    
    # Validate input data
    if validate_first:
        is_valid, issues = validate_rcs_data(theta, rcs_data)
        processing_info['original_issues'] = issues
        if not is_valid:
            logger.warning(f"RCS data validation found issues: {issues}")
    
    # Fix the data
    processed_rcs = fix_rcs_data(
        theta, 
        rcs_data, 
        smooth_sigma=1.0 if smooth_data else 0.1
    )
    processing_info['fixes_applied'].append("Data cleaning and interpolation")
    
    if smooth_data:
        processing_info['fixes_applied'].append("Smoothing applied")
    
    # Convert to dB if requested
    if convert_to_db:
        processed_rcs = convert_rcs_to_db(processed_rcs)
        processing_info['fixes_applied'].append("Converted to dB scale")
    
    processing_info['final_range'] = (np.min(processed_rcs), np.max(processed_rcs))
    
    return theta, processed_rcs, processing_info

def create_clean_plotly_config(title: str = "RCS Pattern") -> dict:
    """
    Create a Plotly configuration optimized for RCS pattern visualization.
    
    Args:
        title: Plot title
        
    Returns:
        Dictionary with Plotly figure configuration
    """
    return {
        'title': title,
        'polar': {
            'radialaxis': {
                'visible': True,
                'title': "RCS (dBsm)",
                'gridcolor': 'rgba(255,255,255,0.2)',
                'linecolor': 'rgba(255,255,255,0.3)',
            },
            'angularaxis': {
                'direction': "counterclockwise",
                'period': 360,
                'gridcolor': 'rgba(255,255,255,0.2)',
                'linecolor': 'rgba(255,255,255,0.3)',
            },
            'bgcolor': 'rgba(0,0,0,0.8)'
        },
        'showlegend': True,
        'paper_bgcolor': 'rgba(0,0,0,0)',
        'plot_bgcolor': 'rgba(0,0,0,0)',
        'font': {'color': 'white'},
        'width': 600,
        'height': 600
    }

# Example usage and testing functions
def test_rcs_processor():
    """Test the RCS data processor with sample data."""
    # Generate test data with common issues
    theta = np.linspace(0, 2*np.pi, 360)
    
    # Create problematic RCS data
    rcs_data = 10 * np.cos(theta)**4 + 2 * np.cos(2*theta)**2
    
    # Add problems
    rcs_data[50:60] = np.nan  # NaN values
    rcs_data[100:110] = -5    # Negative values
    rcs_data[200] = 1000      # Sharp spike
    
    print("Testing RCS data processor...")
    
    # Validate original data
    is_valid, issues = validate_rcs_data(theta, rcs_data)
    print(f"Original data valid: {is_valid}")
    print(f"Issues found: {issues}")
    
    # Process the data
    theta_clean, rcs_clean, info = process_rcs_for_visualization(
        theta, rcs_data, smooth_data=True, convert_to_db=True
    )
    
    print(f"Processing info: {info}")
    print(f"Final RCS range: {info['final_range']}")
    
    return theta_clean, rcs_clean

if __name__ == "__main__":
    test_rcs_processor()