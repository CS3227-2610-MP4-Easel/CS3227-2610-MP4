// @ts-nocheck
// Generated from the design canvas page MembersRemove.dc.html. Source of truth from here on is this file.
import { Fragment } from 'react';
import { A, css, r, useRole } from '../../lib/nav';
import RemoveMember from '../live/remove-member';
import Top from './Top';
import ProjectHead from './ProjectHead';
import ConfirmDialog from './ConfirmDialog';
import ModalRoute from '../modal-route';

class Logic {
props: any;
constructor(p: any) { this.props = p; }

renderVals() { return {}; }
}

export default function MembersRemove(props: any = {}) {
  const v = new Logic(props).renderVals();
  return <ModalRoute closeTo="Members.dc.html"><RemoveMember /></ModalRoute>;
}
