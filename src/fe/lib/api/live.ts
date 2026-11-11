import { currentProject } from '../screens';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// The project of the open page (set from the URL by Screen). Live calls need a real project id.
export function openProjectId(): string {
  const id = currentProject();
  if (!UUID.test(id)) throw new LiveError('NO_PROJECT', 'Open a project from the Projects page first.', 400);
  return id;
}

export class LiveError extends Error {
  constructor(public code: string, message: string, public status: number) {
    super(message);
  }
}
