'use client';

import { createContext, useContext } from 'react';

const PROJECT_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type ProjectMode = 'prototype' | 'live';

export type ProjectRoute = {
  pathname: string;
  projectId: string | null;
  mode: ProjectMode;
};

export function isProjectUuid(value: unknown): value is string {
  return typeof value === 'string' && PROJECT_UUID.test(value);
}

function projectSegment(pathname: string): string | null {
  const match = pathname.match(/^\/projects\/([^/?#]+)/i);
  return match?.[1] ?? null;
}

/** The route adapter is the only place that decides whether a project id is live. */
export function projectRoute(pathname: string, projectId = projectSegment(pathname)): ProjectRoute {
  const liveId = isProjectUuid(projectId) ? projectId : null;
  return { pathname, projectId: liveId, mode: liveId ? 'live' : 'prototype' };
}

export const ProjectRouteContext = createContext<ProjectRoute>(projectRoute(''));

export function useProjectRoute(): ProjectRoute {
  return useContext(ProjectRouteContext);
}
