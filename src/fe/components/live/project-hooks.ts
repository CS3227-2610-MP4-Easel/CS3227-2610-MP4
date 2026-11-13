'use client';
import { useEffect, useState } from 'react';
import { getLiveProject_7, isLive, listLiveProjects_6, type LiveProject } from '../../lib/api';
import { currentProject } from '../../lib/screens';

// The signed-in user's projects (endpoint 6), for the project switcher. Null while loading or when not live.
export function useLiveProjects(): LiveProject[] | null {
  const [projects, setProjects] = useState<LiveProject[] | null>(null);
  useEffect(() => {
    if (!isLive()) return;
    let on = true;
    listLiveProjects_6().then((p) => on && setProjects(p.items)).catch(() => on && setProjects([]));
    return () => {
      on = false;
    };
  }, []);
  return projects;
}

// The project of the open page (endpoint 7), for the page header. Null while loading, when not live or outside a project.
export function useLiveProject(): LiveProject | null {
  const id = currentProject();
  const [project, setProject] = useState<LiveProject | null>(null);
  useEffect(() => {
    if (!isLive() || !/^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(id)) return;
    let on = true;
    setProject(null);
    getLiveProject_7(id).then((p) => on && setProject(p)).catch(() => {});
    return () => {
      on = false;
    };
  }, [id]);
  return project;
}
