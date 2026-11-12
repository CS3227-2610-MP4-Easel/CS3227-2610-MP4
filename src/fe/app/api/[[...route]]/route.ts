import { getApiApp } from '@agile/api';

async function forward(request: Request): Promise<Response> {
  return getApiApp().fetch(request);
}

export const GET = forward;
export const POST = forward;
export const PATCH = forward;
export const DELETE = forward;
export const HEAD = forward;
export const OPTIONS = forward;
