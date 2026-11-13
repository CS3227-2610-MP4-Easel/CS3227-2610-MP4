'use client';
import Link from 'next/link';
import { createContext, useContext, type CSSProperties, type MouseEvent, type ReactNode } from 'react';
import { useProjectRoute } from './api/project-mode';
import { routeOf, type Role } from './screens';

export const RoleCtx = createContext<Role>('pm');
export const useRole = () => useContext(RoleCtx);

export type ModalRequest = { file: string; closeTo: string; params?: Record<string, string> };
type ModalContextValue = { modal: ModalRequest | null; open: (request: ModalRequest) => void; close: () => void };
export const ModalCtx = createContext<ModalContextValue>({ modal: null, open: () => {}, close: () => {} });
export const useModal = () => useContext(ModalCtx);

/** Resolve modal links without changing the page route. Deep links still work through Screen. */
export function modalForHref(href: string): ModalRequest | null {
  const url = new URL(href, 'http://easel.local');
  const view = url.searchParams.get('view');
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const closeTo = path;
  const viewFiles: Record<string, string> = {
    'add-task': 'BacklogAddTask',
    'add-epic': 'BacklogAddEpic',
    add: path.endsWith('/checkpoints') ? 'CheckpointAdd' : '',
    new: path === '/projects' ? 'NewProject' : '',
    remove: path.endsWith('/members') ? 'MembersRemove' : '',
  };
  const params = Object.fromEntries(url.searchParams.entries());
  delete params.view;
  if (view && viewFiles[view]) return { file: viewFiles[view], closeTo, params };
  if (path.endsWith('/board') && url.searchParams.has('task')) return { file: 'TaskDetail', closeTo, params };
  return null;
}

const camel = (s: string) => s.replace(/-([a-z])/g, (_, c) => c.toUpperCase());

/** Canvas hole values give inline styles as a CSS string. */
export function css(str: string | undefined): CSSProperties {
  const o: Record<string, string> = {};
  for (const part of (str || '').split(';')) {
    const i = part.indexOf(':');
    if (i < 0) continue;
    const k = part.slice(0, i).trim();
    o[k.startsWith('--') ? k : camel(k)] = part.slice(i + 1).trim();
  }
  return o as CSSProperties;
}

export const r = routeOf;

/** Generate a route for an imperative navigation, preserving the active project id. */
export function routeFor(href: string, projectId?: string | null): string {
  return routeOf(href, projectId ?? undefined);
}

export function useRoute(): (href: string) => string {
  const { projectId } = useProjectRoute();
  return (href) => routeFor(href, projectId);
}

function withProjectId(href: string, projectId: string | null): string {
  if (!projectId) return href;
  return href.replace(/^\/projects\/[^/?#]+(?=\/|\?|#|$)/i, `/projects/${projectId}`);
}

export function A({ href, children, onClick, ...rest }: { href: string; children?: ReactNode; onClick?: (event: MouseEvent<HTMLAnchorElement>) => void; [k: string]: unknown }) {
  const { projectId } = useProjectRoute();
  const target = withProjectId(href, projectId);
  const modal = useModal();
  const request = modalForHref(target);
  return <Link href={target} onClick={(event) => {
    onClick?.(event);
    if (event.defaultPrevented) return;
    if (request) {
      event.preventDefault();
      modal.open(request);
    } else if (modal.modal && target === modal.modal.closeTo) {
      event.preventDefault();
      modal.close();
    }
  }} {...(rest as object)}>{children}</Link>;
}
