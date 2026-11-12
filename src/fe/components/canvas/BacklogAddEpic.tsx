// @ts-nocheck
// Generated from the design canvas page BacklogAddEpic.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import { AddEpicForm } from '../live/forms';
import Top from './Top';
import ProjectHead from './ProjectHead';
import ModalRoute from '../modal-route';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function BacklogAddEpic(props: any = {}) {
  const v = new Logic(props).renderVals();
  return <ModalRoute closeTo="Backlog.dc.html"><AddEpicForm /></ModalRoute>;
}
