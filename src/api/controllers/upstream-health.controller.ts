import type { Request, Response } from 'express';

export interface UpstreamHealthReader {
  getHealth(): unknown;
}

export function createUpstreamHealthController(reader: UpstreamHealthReader) {
  return (_request: Request, response: Response): void => {
    response.json(reader.getHealth());
  };
}
