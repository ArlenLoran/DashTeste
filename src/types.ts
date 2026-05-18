export type Status = 'ok' | 'error';

export interface MetricHistory {
  timestamp: string;
  value: number;
}

export interface Metric {
  id: string;
  title: string;
  value: number | string;
  status: Status;
  lastUpdate: string;
  objective?: string;
  rules?: string[];
  history?: MetricHistory[];
  details?: any[];
  isDynamic?: boolean;
  sqlQuery?: string;
}

export interface Section {
  title: string;
  metrics: Metric[];
}
