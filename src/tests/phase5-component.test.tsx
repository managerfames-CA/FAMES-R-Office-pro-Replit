import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../components/AppContext';
import { BillingPage, CommunicationsPage, ExpensesPage, ReportsPage, TimesheetsPage, WorkloadPage } from '../features/phase5/Phase5Pages';
import { DashboardPage } from '../pages/DashboardPage';
import { AppShell } from '../layouts/AppShell';
import { NotFoundPage } from '../pages/NotFoundPage';
import { services } from '../services';
import { repositories } from '../repositories';
import { emptyClient, emptyEngagement, emptyStaff } from '../constants/defaults';
import { todayIso } from '../utils/dates';

function renderPage(ui:React.ReactNode,path='/'){return render(<AppProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></AppProvider>)}
let seq=0;
async function seed(){const n=++seq;const client=await services.clients.create({...emptyClient,clientCode:`CL-P5-${n}`,legalName:`Phase 5 Client ${n}`,status:'Active'},'Tester');const partner=await services.staff.save({...emptyStaff,staffCode:`P-P5-${n}`,fullName:`Partner ${n}`,role:'Partner'},'Tester');const manager=await services.staff.save({...emptyStaff,staffCode:`M-P5-${n}`,fullName:`Manager ${n}`,role:'Manager'},'Tester');const assistant=await services.staff.save({...emptyStaff,staffCode:`A-P5-${n}`,fullName:`Assistant ${n}`,role:'Assistant'},'Tester');const engagement=await services.engagements.create({...emptyEngagement,engagementCode:`ENG-P5-${n}`,clientId:client.id,serviceType:'Audit',engagementType:'Audit',responsiblePartnerId:partner.id,responsibleManagerId:manager.id},'Tester');return{client,partner,manager,assistant,engagement}}
beforeEach(()=>localStorage.clear());afterEach(()=>cleanup());

describe('Phase 5 route rendering',()=>{
 it.each([
  ['Staff Workload Planner',<WorkloadPage/>],['Timesheet Management',<TimesheetsPage/>],['Expense Register',<ExpensesPage/>],['Billing and Collection',<BillingPage/>],['Communication and Follow-up',<CommunicationsPage/>],['Management Reports',<ReportsPage/>]
 ])('renders %s',async(heading,page)=>{renderPage(page);expect(await screen.findByRole('heading',{name:heading})).toBeVisible()});
 it('renders Phase 5 dashboard indicators',async()=>{renderPage(<DashboardPage/>);expect(await screen.findByRole('heading',{name:'Practice Management and Finance'})).toBeVisible();expect(screen.getByText('Timesheets awaiting review')).toBeVisible()});
 it('shows Phase 5 navigation in mobile menu',async()=>{const user=userEvent.setup();renderPage(<Routes><Route element={<AppShell/>}><Route path="*" element={<NotFoundPage/>}/></Route></Routes>,'/missing');await user.click(screen.getByRole('button',{name:/open navigation/i}));expect(screen.getByRole('link',{name:'Workload'})).toBeVisible();expect(screen.getByRole('link',{name:'Billing'})).toBeVisible();expect(screen.getByRole('link',{name:'Reports'})).toBeVisible()});
});

describe('Phase 5 React interactions',()=>{
 it('submits a timesheet through the service-backed form',async()=>{const user=userEvent.setup();const c=await seed();renderPage(<TimesheetsPage/>);await screen.findByRole('heading',{name:'Timesheet Management'});await user.selectOptions(screen.getByLabelText(/^Staff/),c.assistant.id);await user.selectOptions(screen.getByLabelText('Engagement'),c.engagement.id);await user.type(screen.getByLabelText(/^Activity Code/),'AUD');await user.type(screen.getByLabelText(/^Description/),'Performed audit procedures');await user.click(screen.getByRole('button',{name:'Save Timesheet'}));await waitFor(async()=>expect((await repositories.timesheets.list()).length).toBe(1));expect(await screen.findByText(/1h/)).toBeVisible()});
 it('shows expense threshold validation in the form',async()=>{const user=userEvent.setup();const c=await seed();renderPage(<ExpensesPage/>);await screen.findByRole('heading',{name:'Expense Register'});await user.selectOptions(screen.getByLabelText('Engagement'),c.engagement.id);await user.type(screen.getByLabelText(/^Category/),'Travel');await user.clear(screen.getByLabelText(/^Amount/));await user.type(screen.getByLabelText(/^Amount/),'6000');await user.type(screen.getByLabelText(/^Description/),'Travel cost');await user.selectOptions(screen.getByLabelText(/^Claimed By/),c.assistant.id);await user.click(screen.getByRole('button',{name:'Save Expense'}));expect(await screen.findByText(/Receipt Reference is required above/i)).toBeVisible()});
});
