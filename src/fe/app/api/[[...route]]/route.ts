import { apiApp } from '../../../../be/api/src/app.js';

async function forward(request: Request): Promise<Response> {
  return apiApp.fetch(request);
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
