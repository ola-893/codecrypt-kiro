/**
 * Bar chart for dependencies updated
 */

import { Bar } from 'react-chartjs-2';
import { MetricsSnapshot } from '../types';
import { getBarChartOptions, CHART_COLORS, formatTimestamp } from '../utils/chartConfig';
import '../utils/chartSetup';

interface DependenciesChartProps {
  metricsHistory: MetricsSnapshot[];
}

export function DependenciesChart({ metricsHistory }: DependenciesChartProps) {
  const data = {
    labels: metricsHistory.map((m) => formatTimestamp(m.timestamp)),
    datasets: [
      {
        label: 'Dependencies Updated',
        data: metricsHistory.map((m) => m.depsUpdated),
        backgroundColor: CHART_COLORS.primary,
        borderColor: CHART_COLORS.border,
        borderWidth: 1,
        borderRadius: 4,
      },
    ],
  };

  const options = getBarChartOptions('Dependencies Updated');

  return (
    <div className="chart-container">
      <Bar data={data} options={options} />
    </div>
  );
}
