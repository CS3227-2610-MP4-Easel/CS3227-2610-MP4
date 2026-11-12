// @ts-nocheck
// Generated from the design canvas page TaskDetail.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { useProjectRoute } from '../../lib/api/project-mode';
import TaskDrawer from '../live/task-drawer';
import { Act } from '../live/act';
import { setTaskStatus_24 } from '../../lib/api';
import Top from './Top';
import ProjectHead from './ProjectHead';
import StatusChip from './StatusChip';
import ModalRoute from '../modal-route';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function TaskDetail(props: any = {}) {
  const route = useProjectRoute();
  const v = new Logic(props).renderVals();
  return <ModalRoute closeTo="Board.dc.html" className="end"><TaskDrawer projectId={route.projectId} /></ModalRoute>;
}
