/**
 * Chart.js configuration utilities for CodeCrypt dashboard
 * Provides consistent styling and configuration for all charts
 */

import { ChartOptions } from 'chart.js';

/**
 * Gothic/spooky color palette for charts
 */
export const CHART_COLORS = {
  primary: '#8b5cf6', // Purple
  secondary: '#ec4899', // Pink
  success: '#10b981', // Green
  warning: '#f59e0b', // Amber
  danger: '#ef4444', // Red
  dark: '#1f2937', // Dark gray
  light: '#f3f4f6', // Light gray
  background: 'rgba(139, 92, 246, 0.1)', // Transparent purple
  border: 'rgba(139, 92, 246, 0.5)', // Semi-transparent purple
};

/**
 * Default chart options with gothic theme
 */
export const getDefaultChartOptions = (): ChartOptions<'line'> => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 750,
    easing: 'easeInOutQuart',
  },
  plugins: {
    legend: {
      display: true,
      position: 'top',
      labels: {
        color: CHART_COLORS.light,
        font: {
          family: "'Courier New', monospace",
          size: 12,
        },
      },
    },
    tooltip: {
      backgroundColor: CHART_COLORS.dark,
      titleColor: CHART_COLORS.light,
      bodyColor: CHART_COLORS.light,
      borderColor: CHART_COLORS.border,
      borderWidth: 1,
      padding: 12,
      displayColors: true,
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: CHART_COLORS.light,
        font: {
          family: "'Courier New', monospace",
        },
      },
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: CHART_COLORS.light,
        font: {
          family: "'Courier New', monospace",
        },
      },
      beginAtZero: true,
    },
  },
});

/**
 * Line chart configuration for time-series data
 */
export const getLineChartOptions = (title: string): ChartOptions<'line'> => ({
  ...getDefaultChartOptions(),
  plugins: {
    ...getDefaultChartOptions().plugins,
    title: {
      display: true,
      text: title,
      color: CHART_COLORS.light,
      font: {
        family: "'Courier New', monospace",
        size: 16,
        weight: 'bold',
      },
    },
  },
});

/**
 * Bar chart configuration
 */
export const getBarChartOptions = (title: string): ChartOptions<'bar'> => ({
  responsive: true,
  maintainAspectRatio: false,
  animation: {
    duration: 750,
    easing: 'easeInOutQuart',
  },
  plugins: {
    legend: {
      display: false,
    },
    title: {
      display: true,
      text: title,
      color: CHART_COLORS.light,
      font: {
        family: "'Courier New', monospace",
        size: 16,
        weight: 'bold',
      },
    },
    tooltip: {
      backgroundColor: CHART_COLORS.dark,
      titleColor: CHART_COLORS.light,
      bodyColor: CHART_COLORS.light,
      borderColor: CHART_COLORS.border,
      borderWidth: 1,
      padding: 12,
    },
  },
  scales: {
    x: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: CHART_COLORS.light,
        font: {
          family: "'Courier New', monospace",
        },
      },
    },
    y: {
      grid: {
        color: 'rgba(255, 255, 255, 0.1)',
      },
      ticks: {
        color: CHART_COLORS.light,
        font: {
          family: "'Courier New', monospace",
        },
      },
      beginAtZero: true,
    },
  },
});

/**
 * Format timestamp for chart labels
 */
export const formatTimestamp = (timestamp: number): string => {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

/**
 * Format percentage for display
 */
export const formatPercentage = (value: number): string => {
  return `${Math.round(value * 100)}%`;
};

/**
 * Format number with commas
 */
export const formatNumber = (value: number): string => {
  return value.toLocaleString('en-US');
};
