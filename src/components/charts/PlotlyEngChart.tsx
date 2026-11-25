import { useMemo } from 'react';
import createPlotlyComponent from 'react-plotly.js/factory';
import Plotly from 'plotly.js/dist/plotly';

const Plot = createPlotlyComponent(Plotly);

const DARK_LAYOUT = {
  paper_bgcolor: '#1c2128',
  plot_bgcolor: '#161b22',
  font: { color: '#8b949e', family: "'JetBrains Mono', 'Fira Code', 'Consolas', monospace", size: 10.5 },
  xaxis: {
    gridcolor: '#21262d',
    zerolinecolor: '#30363d',
    tickfont: { color: '#8b949e', size: 10 },
    titlefont: { color: '#8b949e', size: 10.5 },
    automargin: true,
  },
  yaxis: {
    gridcolor: '#21262d',
    zerolinecolor: '#30363d',
    tickfont: { color: '#8b949e', size: 10 },
    titlefont: { color: '#8b949e', size: 10.5 },
    automargin: true,
  },
  margin: { l: 54, r: 24, t: 44, b: 48 },
  legend: {
    x: 0.02,
    y: 0.98,
    xanchor: 'left' as const,
    yanchor: 'top' as const,
    bgcolor: 'rgba(22, 27, 34, 0.85)',
    bordercolor: '#30363d',
    borderwidth: 1,
    font: { color: '#cbd5e1', size: 9.5 },
  },
};

interface PlotlyEngChartProps {
  data: Plotly.Data[];
  layout?: Partial<Plotly.Layout>;
  title?: string;
  style?: React.CSSProperties;
  className?: string;
}

export function PlotlyEngChart({ data, layout = {}, title, style, className }: PlotlyEngChartProps) {
  const mergedLayout = useMemo(() => {
    const hasY2 = Boolean((layout as any).yaxis2);
    const baseMargin = {
      ...DARK_LAYOUT.margin,
      r: hasY2 ? 58 : DARK_LAYOUT.margin.r,
    };

    return {
      ...DARK_LAYOUT,
      ...layout,
      title: title
        ? {
            text: title,
            x: 0.02,
            xanchor: 'left',
            y: 0.96,
            yanchor: 'top',
            font: { color: '#e6edf3', size: 11.5 },
          }
        : undefined,
      xaxis: { ...DARK_LAYOUT.xaxis, ...(layout.xaxis ?? {}) },
      yaxis: { ...DARK_LAYOUT.yaxis, ...(layout.yaxis ?? {}) },
      ...(hasY2
        ? {
            yaxis2: {
              gridcolor: 'rgba(0,0,0,0)',
              tickfont: { color: '#8b949e', size: 10 },
              titlefont: { color: '#8b949e', size: 10.5 },
              automargin: true,
              ...((layout as any).yaxis2 ?? {}),
            },
          }
        : {}),
      legend: { ...DARK_LAYOUT.legend, ...((layout as any).legend ?? {}) },
      paper_bgcolor: layout.paper_bgcolor ?? DARK_LAYOUT.paper_bgcolor,
      plot_bgcolor: layout.plot_bgcolor ?? DARK_LAYOUT.plot_bgcolor,
      font: { ...DARK_LAYOUT.font, ...(layout.font ?? {}) },
      margin: { ...baseMargin, ...(layout.margin ?? {}) },
    };
  }, [layout, title]);

  return (
    <Plot
      data={data}
      layout={mergedLayout as Partial<Plotly.Layout>}
      config={{
        responsive: true,
        displayModeBar: 'hover',
        displaylogo: false,
        modeBarButtonsToRemove: ['select2d', 'lasso2d', 'zoomIn2d', 'zoomOut2d', 'autoScale2d'],
      }}
      style={{ width: '100%', height: '100%', ...style }}
      className={className}
      useResizeHandler
    />
  );
}
