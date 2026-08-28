export interface LinkedInRequest {
  operation: string;
  path: string;
  query?: URLSearchParams;
  method?: 'GET' | 'POST';
  body?: string;
  headers?: Readonly<Record<string, string>>;
}

export interface LinkedInResponse {
  statusCode: number;
  data: unknown;
  contentType: string;
}
