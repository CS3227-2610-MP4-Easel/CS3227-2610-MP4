// @ts-nocheck
// Generated from the design canvas page BacklogAddTask.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { AddTaskForm } from '../live/forms';
import Top from './Top';
import ProjectHead from './ProjectHead';
import ModalRoute from '../modal-route';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function BacklogAddTask(props: any = {}) {
  const v = new Logic(props).renderVals();
  return <ModalRoute closeTo="Backlog.dc.html"><AddTaskForm /></ModalRoute>;
}
