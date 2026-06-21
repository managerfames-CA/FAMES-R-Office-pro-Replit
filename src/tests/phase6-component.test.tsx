import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { AppProvider } from '../components/AppContext';
import { GlobalSearch } from '../components/GlobalSearch';
import { StartupRecovery } from '../components/StartupRecovery';
import { DashboardPage } from '../pages/DashboardPage';
import { DataIntegrityPage } from '../pages/DataIntegrityPage';
import { NumberingSettingsPage } from '../pages/NumberingSettingsPage';
import { services } from '../services';
import { emptyClient } from '../constants/defaults';

function renderWithApp(ui:React.ReactNode,path='/'){return render(<AppProvider><MemoryRouter initialEntries={[path]}>{ui}</MemoryRouter></AppProvider>)}
let seq=0;
beforeEach(()=>{localStorage.clear();seq+=1});afterEach(()=>{cleanup();vi.restoreAllMocks()});

describe('Phase 6 integrated React interactions',()=>{
  it('renders the five grouped final dashboard sections',async()=>{renderWithApp(<DashboardPage/>);for(const heading of ['Core Operations','Audit Progress','Listed / PIE','Service Operations','Practice Management and Finance'])expect(await screen.findByRole('heading',{name:heading})).toBeVisible();});
  it('renders the global search empty-result state cleanly',async()=>{const user=userEvent.setup();renderWithApp(<GlobalSearch/>);await user.type(screen.getByLabelText('Search the application'),'no matching record');expect(await screen.findByText('No matching records')).toBeVisible();});
  it('global search finds a real client and opens a valid route',async()=>{const user=userEvent.setup();const client=await services.clients.create({...emptyClient,clientCode:`CL-GS-${seq}`,legalName:`Search Client ${seq}`,status:'Active'},'Tester');renderWithApp(<Routes><Route path="*" element={<><GlobalSearch/><div data-testid="route-view">route</div></>}/></Routes>);await user.type(screen.getByLabelText('Search the application'),client.clientCode);const result=await screen.findByRole('link',{name:new RegExp(client.legalName)});expect(result).toHaveAttribute('href',`/clients/${client.id}`);await user.click(result);expect(screen.getByTestId('route-view')).toBeVisible();});
  it('Ctrl+K focuses global search',async()=>{const user=userEvent.setup();renderWithApp(<GlobalSearch/>);await user.keyboard('{Control>}k{/Control}');expect(screen.getByLabelText('Search the application')).toHaveFocus();});
  it('data integrity page handles an empty repository without blank screen',async()=>{renderWithApp(<DataIntegrityPage/>);expect(await screen.findByRole('heading',{name:'Data Integrity and Recovery'})).toBeVisible();expect(await screen.findByText('No integration conflicts detected')).toBeVisible();});
  it('data integrity page exposes corrupt-module recovery control',async()=>{localStorage.setItem('afm:tasks','{bad');renderWithApp(<DataIntegrityPage/>);expect(await screen.findByText('Corrupt')).toBeVisible();expect(screen.getByRole('button',{name:'Snapshot & Reset'})).toBeVisible();});
  it('numbering settings displays operational prefixes and suggestions',async()=>{renderWithApp(<NumberingSettingsPage/>);expect(await screen.findByRole('heading',{name:'Numbering Settings'})).toBeVisible();expect(screen.getByLabelText('Invoice Prefix')).toHaveValue('INV-');expect(await screen.findByText('INV-0001')).toBeVisible();});
  it('startup recovery renders script-like errors as plain text and keeps recovery actions',async()=>{const exportFn=vi.fn();const resetFn=vi.fn();const user=userEvent.setup();render(<StartupRecovery message={'<script>window.hacked=true</script>'} onExport={exportFn} onReset={resetFn}/>);expect(screen.getByTestId('startup-error')).toHaveTextContent('<script>window.hacked=true</script>');expect(document.querySelector('script')).toBeNull();await user.click(screen.getByRole('button',{name:'Export Raw Recovery Snapshot'}));await user.click(screen.getByRole('button',{name:'Reset Startup Configuration'}));expect(exportFn).toHaveBeenCalledOnce();expect(resetFn).toHaveBeenCalledOnce();});
  it('dashboard filter clear action restores the unfiltered state',async()=>{const user=userEvent.setup();renderWithApp(<DashboardPage/>);const period=await screen.findByLabelText('Period');await user.type(period,'2026');expect(screen.getByText('Filtered view')).toBeVisible();await user.click(screen.getByRole('button',{name:'Reset'}));await waitFor(()=>expect(period).toHaveValue(''));});
});
