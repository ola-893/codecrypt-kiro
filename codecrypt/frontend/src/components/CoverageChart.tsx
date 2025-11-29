/**
 * Line chart for test coverage over time
 */

import { Line } from 'react-chartjs-2';
import { MetricsSnapshot } from '../types';
import { getLineChartOptions, CHART_COLORS, formatTimestamp } from '../utils/chartConfig';
import '../utils/chartSetup';

interface CoverageChartProps {
  metricsHistory: MetricsSnapshot[];
}

export function CoverageChart({ metricsHistory }: CoverageChartProps) {
  const data = {
    labels: metricsHistory.map((m) => formatTimestamp(m.timestamp)),
    datasets: [
      {
        label: 'Test Coverage (%)',
        data: metricsHistory.map((m) => m.coverage * 100),
        borderColor: CHART_COLORS.success,
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS.success,
        pointBorderColor: CHART_COLORS.dark,
        pointBorderWidth: 2,
      },
    ],
  };

  const options = {
    ...getLineChartOptions('Test Coverage Over Time'),
    scales: {
      ...getLineChartOptions('Test Coverage Over Time').scales,
      y: {
        ...getLineChartOptions('Test Coverage Over Time').scales?.y,
        min: 0,
        max: 100,
        ticks: {
          ...getLineChartOptions('Test Coverage Over Time').scales?.y?.ticks,
          callback: function(value: number | string) {
            return value + '%';
          },
        },
      },
    },
  };

  return (
    <div className="chart-container">
      <Line data={data} options={options} />
    </div>
  );
}
