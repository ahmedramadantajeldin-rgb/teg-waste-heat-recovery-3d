import { useMemo } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js/dist/plotly';

const Plot = createPlotlyComponent(Plotly);

const DARK_LAYOUT = {
  paper_bgcolor: '#1c2128',
  plot_bgcolor: '#161b22',
  font: { color: '#8b949e', family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", size: 10.5 },
  xaxis: { gridcolor: '#21262d', zerolinecolor: '#30363d', tickfont: { color: '#8b949e' }, titlefont: { color: '#8b949e' } },
  yaxis: { gridcolor: '#21262d', zerolinecolor: '#30363d', tickfont: { color: '#8b949e' }, titlefont: { color: '#8b949e' } },
  margin: { l: 55, r: 20, t: 36, b: 48 },
  legend: { bgcolor: '#1c2128', bordercolor: '#30363d', borderwidth: 1, font: { color: '#8b949e' } },
};

interface PlotlyEngChartProps {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function PlotlyEngChart({ data, layout = {}, title, style, className }: PlotlyEngChartProps) {
  const mergedLayout = useMemo(() => ({
    ...DARK_LAYOUT,
    ...layout,
    title: title ? { text: title, font: { color: '#e6edf3', size: 12 } } : undefined,
    xaxis: { ...DARK_LAYOUT.xaxis, ...(layout.xaxis ?? {}) },
    yaxis: { ...DARK_LAYOUT.yaxis, ...(layout.yaxis ?? {}) },
    paper_bgcolor: layout.paper_bgcolor ?? DARK_LAYOUT.paper_bgcolor,
    plot_bgcolor: layout.plot_bgcolor ?? DARK_LAYOUT.plot_bgcolor,
    font: { ...DARK_LAYOUT.font, ...(layout.font ?? {}) },
    margin: { ...DARK_LAYOUT.margin, ...(layout.margin ?? {}) },
  }), [layout, title]);

  return (
    <Plot
      data={data}
      layout={mergedLayout as Partial<Plotly.Layout>}
      config={{ responsive: true, displayModeBar: true, modeBarButtonsToRemove: ['select2d', 'lasso2d'] }}
      style={{ width: '100%', height: '100%', ...style }}
      className={className}
      useResizeHandler
    />
  );
}
