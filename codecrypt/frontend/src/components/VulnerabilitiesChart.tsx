/**
 * Area chart for vulnerabilities fixed over time
 */

import { Line } from 'react-chartjs-2';
import { MetricsSnapshot } from '../types';
import { getLineChartOptions, CHART_COLORS, formatTimestamp } from '../utils/chartConfig';
import '../utils/chartSetup';

interface VulnerabilitiesChartProps {
  metricsHistory: MetricsSnapshot[];
}

export function VulnerabilitiesChart({ metricsHistory }: VulnerabilitiesChartProps) {
  const data = {
    labels: metricsHistory.map((m) => formatTimestamp(m.timestamp)),
    datasets: [
      {
        label: 'Vulnerabilities Fixed',
        data: metricsHistory.map((m) => m.vulnsFixed),
        borderColor: CHART_COLORS.danger,
        backgroundColor: 'rgba(239, 68, 68, 0.2)',
        borderWidth: 2,
        tension: 0.4,
        fill: true,
        pointRadius: 4,
        pointHoverRadius: 6,
        pointBackgroundColor: CHART_COLORS.danger,
        pointBorderColor: CHART_COLORS.dark,
        pointBorderWidth: 2,
      },
    ],
  };

  const options = getLineChartOptions('Vulnerabilities Fixed Over Time');

  return (
    <div className="chart-container">
      <Line data={data} options={options} />
    </div>
  );
}
