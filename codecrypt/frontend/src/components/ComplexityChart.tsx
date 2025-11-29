/**
 * Line chart for code complexity over time
 */

import { Line } from 'react-chartjs-2';
import { MetricsSnapshot } from '../types';
import { getLineChartOptions, CHART_COLORS, formatTimestamp } from '../utils/chartConfig';
import '../utils/chartSetup';

interface ComplexityChartProps {
  metricsHistory: MetricsSnapshot[];
}

export function ComplexityChart({ metricsHistory }: ComplexityChartProps) {
  const data = {
    labels: metricsHistory.map((m) => formatTimestamp(m.timestamp)),
    datasets: [
      {
        label: 'Code Complexity',
        data: metricsHistory.map((m) => m.complexity),
        borderColor: CHART_COLORS.warning,
        backgroundColor: 'rgba(245, 158, 11, 0.1)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS.warning,
        pointBorderColor: CHART_COLORS.dark,
        pointBorderWidth: 2,
      },
    ],
  };

  const options = getLineChartOptions('Code Complexity Over Time');

  return (
    <div className="chart-container">
      <Line data={data} options={options} />
    </div>
  );
}
