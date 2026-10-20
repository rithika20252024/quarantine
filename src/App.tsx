import { useEffect, useMemo, useState } from 'react'
import {
  Activity, ArrowDownRight, ArrowUpRight, Bell, Check, ChevronDown, CircleHelp,
  Clock3, Command, Cpu, Database, Download, FileClock, Gauge, HardDrive,
  LayoutDashboard, ListFilter, LockKeyhole, Play, RotateCcw, Search, Shield,
  ShieldAlert, ShieldCheck, SlidersHorizontal, Square, Terminal, X,
} from 'lucide-react'

type Stage = 'NORMAL' | 'SUSPECT' | 'QUARANTINE L1' | 'QUARANTINE L2'
type Process = { pid: number; name: string; owner: string; cpu: number; memory: number; io: number; score: number; stage: Stage; trend: number[]; detail: string }
type Event = { id: number; time: string; pid: number; name: string; message: string; kind: 'warn' | 'good' | 'info' }
type Section = 'Overview' | 'Processes' | 'Event log' | 'Evaluation'

const seedProcesses: Process[] = [
  { pid: 4182, name: 'media-transcoder', owner: 'svc-media', cpu: 84, memory: 1260, io: 18.4, score: 6.2, stage: 'QUARANTINE L2', trend: [26,31,38,43,52,58,63,69,75,71,68,64], detail: 'Sustained CPU and write activity across 6 monitoring windows.' },
  { pid: 3916, name: 'postgres-writer', owner: 'svc-data', cpu: 61, memory: 842, io: 12.8, score: 4.1, stage: 'SUSPECT', trend: [30,34,39,41,47,50,55,57,59,62,60,61], detail: 'I/O is above the process baseline. No limits applied yet.' },
  { pid: 2250, name: 'batch-compiler', owner: 'build-agent', cpu: 73, memory: 564, io: 4.2, score: 2.6, stage: 'NORMAL', trend: [19,21,20,24,26,22,24,27,25,22,24,26], detail: 'Short CPU burst was dampened by the burst window.' },
  { pid: 1502, name: 'api-gateway', owner: 'svc-edge', cpu: 28, memory: 312, io: 1.1, score: 0.8, stage: 'NORMAL', trend: [22,21,24,23,22,20,21,22,24,23,25,24], detail: 'Operating within its recent baseline.' },
  { pid: 3721, name: 'thumbnail-worker', owner: 'svc-media', cpu: 46, memory: 688, io: 6.3, score: 3.4, stage: 'SUSPECT', trend: [23,25,31,37,39,44,47,49,45,43,46,44], detail: 'Memory growth is elevated. Watching for another 2 windows.' },
  { pid: 880, name: 'cache-refresh', owner: 'svc-data', cpu: 19, memory: 206, io: 3.1, score: 1.1, stage: 'NORMAL', trend: [19,21,20,18,19,21,20,22,21,20,19,20], detail: 'Operating within its recent baseline.' },
]
const initialEvents: Event[] = [
  { id: 1, time: '12:05:25', pid: 4182, name: 'media-transcoder', message: 'Limits removed · returned to NORMAL', kind: 'good' },
  { id: 2, time: '12:04:40', pid: 4182, name: 'media-transcoder', message: 'QUARANTINE L2 · cpu.max 20%, io.max enabled', kind: 'warn' },
  { id: 3, time: '12:04:34', pid: 4182, name: 'media-transcoder', message: 'QUARANTINE L1 · cpu.weight reduced', kind: 'warn' },
  { id: 4, time: '12:04:31', pid: 3916, name: 'postgres-writer', message: 'SUSPECT · elevated I/O, monitoring only', kind: 'info' },
]

const navItems: { name: Section; icon: typeof LayoutDashboard; count?: number }[] = [
  { name: 'Overview', icon: LayoutDashboard },
  { name: 'Processes', icon: Cpu, count: 6 },
  { name: 'Event log', icon: FileClock, count: 4 },
  { name: 'Evaluation', icon: Gauge },
]

function Sparkline({ values, color = '#315f50' }: { values: number[]; color?: string }) {
  const points = values.map((v, i) => `${(i / (values.length - 1)) * 100},${36 - v * 0.34}`).join(' ')
  return <svg className="sparkline" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} fill="none" stroke={color} strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinecap="round" strokeLinejoin="round" /></svg>
}

function StateTag({ stage }: { stage: Stage }) {
  const cls = stage === 'NORMAL' ? 'state-normal' : stage === 'SUSPECT' ? 'state-suspect' : stage === 'QUARANTINE L1' ? 'state-l1' : 'state-l2'
  return <span className={`state-tag ${cls}`}><i />{stage}</span>
}

function Score({ value }: { value: number }) {
  const cls = value >= 5 ? 'score-high' : value >= 3 ? 'score-mid' : 'score-low'
  return <span className={`score ${cls}`}><span className="score-dot" />{value.toFixed(1)}</span>
}

function Header({ section, onRun, running }: { section: Section; onRun: () => void; running: boolean }) {
  return <header className="topbar">
    <div className="crumb"><span>ARQ</span><span className="crumb-slash">/</span>{section}</div>
    <div className="top-actions">
      <div className="mode-chip"><span className="mode-dot" /> Simulation mode</div>
      <button className="icon-button" aria-label="Notifications"><Bell size={17} /><span className="notification-dot" /></button>
      <button className="user-avatar" aria-label="Open account menu">RS</button>
      <button className={`button button-primary top-run ${running ? 'is-running' : ''}`} onClick={onRun}>{running ? <><Square size={14} fill="currentColor" /> Stop demo</> : <><Play size={14} fill="currentColor" /> Run demo</>}</button>
    </div>
  </header>
}

function Sidebar({ section, setSection }: { section: Section; setSection: (s: Section) => void }) {
  return <aside className="sidebar">
    <div className="brand"><div className="brand-mark"><Shield size={21} strokeWidth={2.1} /></div><div><strong>ARQ</strong><small>Resource quarantine</small></div><button className="workspace-menu" aria-label="Workspace menu"><ChevronDown size={14} /></button></div>
    <div className="workspace"><span className="workspace-label">WORKSPACE</span><div className="workspace-name"><span className="workspace-glyph">V</span><span>VIT Systems Lab</span><ChevronDown size={14} /></div></div>
    <nav className="primary-nav" aria-label="Primary navigation">
      <span className="nav-label">MONITOR</span>
      {navItems.map(({ name, icon: Icon, count }) => <button key={name} className={`nav-item ${section === name ? 'active' : ''}`} onClick={() => setSection(name)}><Icon size={17} /><span>{name}</span>{count !== undefined && <span className="nav-count">{count}</span>}</button>)}
    </nav>
    <div className="side-policy">
      <div className="policy-top"><span className="policy-icon"><SlidersHorizontal size={15} /></span><span>Active policy</span><span className="live-label">LIVE</span></div>
      <p>Adaptive resource<br />control · v0.1</p>
      <div className="policy-rule"><span>T1 · Suspect</span><b>3.0σ</b></div>
      <div className="policy-rule"><span>T2 · Quarantine</span><b>5.0σ</b></div>
      <div className="policy-rule"><span>Release window</span><b>4 cycles</b></div>
      <button className="policy-link" onClick={() => setSection('Evaluation')}>View policy details <ArrowUpRight size={13} /></button>
    </div>
    <div className="side-bottom">
      <button className="nav-item"><CircleHelp size={17} /><span>Documentation</span><ArrowUpRight className="nav-external" size={13} /></button>
      <div className="sidebar-user"><div className="user-avatar small">RS</div><div className="user-meta"><b>Rithika S</b><small>Project administrator</small></div><button className="more-button" aria-label="More account options"><Command size={15} /></button></div>
    </div>
  </aside>
}

function MetricCard({ label, value, unit, note, icon: Icon, tone, trend, positive }: { label: string; value: string; unit?: string; note: string; icon: typeof Cpu; tone: string; trend: number[]; positive?: boolean }) {
  return <article className="metric-card">
    <div className="metric-head"><span>{label}</span><span className={`metric-icon ${tone}`}><Icon size={16} /></span></div>
    <div className="metric-value">{value}<small>{unit}</small></div>
    <div className="metric-foot"><span className={positive ? 'metric-positive' : 'metric-neutral'}>{positive ? <ArrowDownRight size={13} /> : <ArrowUpRight size={13} />}{note.split(' ')[0]}</span><span className="metric-context">{note.substring(note.indexOf(' ') + 1)}</span><Sparkline values={trend} color={positive ? '#45745f' : '#b57c2e'} /></div>
  </article>
}

function WorkloadChart() {
  const [range, setRange] = useState('30 min')
  const [metric, setMetric] = useState('Resource pressure')
  const values=metric==='CPU utilization'?[21,23,19,27,31,30,38,43,48,46,51,57,62,55,68,72,74,81,77,70,73,66,62,69,57,61,55,49,54,46]:[31,35,29,41,38,48,44,56,52,49,63,58,67,61,72,68,64,77,71,65,74,68,59,64,55,61,52,47,53,44]
  const split=values.map((v,i)=>[30+i*28,180-v*1.62] as const)
  return <section className="panel chart-panel">
    <div className="panel-heading"><div><div className="eyebrow">RESOURCE TELEMETRY</div><h2>System pressure</h2><p>Average activity across monitored processes</p></div><div className="chart-controls"><button className="select-button" onClick={()=>setMetric(metric==='Resource pressure'?'CPU utilization':'Resource pressure')}>{metric}<ChevronDown size={13}/></button><button className="select-button" onClick={()=>setRange(range==='30 min'?'1 hour':'30 min')}>{range}<ChevronDown size={13}/></button></div></div>
    <div className="chart-legend"><span><i className="legend-line green" />CPU utilization</span><span><i className="legend-line amber" />CPU trigger · demo</span><span className="legend-note">SIMULATED TELEMETRY</span></div>
    <div className="chart-wrap"><div className="chart-ylabels"><span>100%</span><span>75%</span><span>50%</span><span>25%</span><span>0%</span></div><svg viewBox="0 0 872 200" className="main-chart" role="img" aria-label="Simulated process CPU telemetry over the past 30 minutes">
      {[18,58,98,138,178].map(y=><line key={y} x1="28" y1={y} x2="842" y2={y} className="gridline"/>)}
      <line x1="28" y1="58" x2="842" y2="58" className="threshold-line"/><text x="846" y="54" className="chart-label">75%</text>
      <path d={`M ${split.map(p=>p.join(',')).join(' L ')} L 842,180 L 30,180 Z`} className="chart-fill"/>
      <polyline points={split.map(p=>p.join(',')).join(' ')} className="chart-line"/>
      <circle cx={split[17][0]} cy={split[17][1]} r="4" className="chart-point"/>
      <text x="30" y="196" className="x-label">11:35</text><text x="220" y="196" className="x-label">11:45</text><text x="424" y="196" className="x-label">11:55</text><text x="632" y="196" className="x-label">12:05</text><text x="812" y="196" className="x-label">12:15</text>
    </svg></div>
    <div className="chart-caption"><span><span className="chart-caption-dot" /> 6 processes monitored</span><span>Window ends 12:15:00</span></div>
  </section>
}

function ProcessTable({ processes, onSelect, selected, query, setQuery, stateFilter, setStateFilter }: { processes: Process[]; onSelect: (p: Process) => void; selected: number; query: string; setQuery: (s: string) => void; stateFilter: string; setStateFilter: (s: string) => void }) {
  const shown=processes.filter(p=>(p.name.toLowerCase().includes(query.toLowerCase())||String(p.pid).includes(query))&&(stateFilter==='All states'||p.stage===stateFilter))
  return <section className="panel process-panel">
    <div className="panel-heading panel-heading-inline"><div><div className="eyebrow">PROCESS MONITOR</div><h2>Monitored processes <span className="heading-count">{shown.length}</span></h2></div><div className="table-tools"><label className="search-box"><Search size={14}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find process" aria-label="Find process"/><kbd>⌘ K</kbd></label><label className="filter-select"><ListFilter size={14}/><select value={stateFilter} onChange={e=>setStateFilter(e.target.value)} aria-label="Filter by state"><option>All states</option><option>NORMAL</option><option>SUSPECT</option><option>QUARANTINE L1</option><option>QUARANTINE L2</option></select></label></div></div>
    <div className="table-scroll"><table className="process-table"><thead><tr><th>PROCESS</th><th>CPU</th><th>MEMORY</th><th>I/O RATE</th><th>SCORE</th><th>STATE</th><th aria-label="Actions" /></tr></thead><tbody>
      {shown.map(p=><tr key={p.pid} className={selected===p.pid?'selected-row':''} onClick={()=>onSelect(p)}>
        <td><div className="process-name"><span className={`process-icon ${p.stage.includes('QUARANTINE')?'warn':'soft'}`}><Terminal size={15}/></span><span><b>{p.name}</b><small>PID {p.pid} · {p.owner}</small></span></div></td>
        <td><div className="cell-value">{p.cpu}<small>%</small></div><div className="mini-bar"><i style={{width:`${p.cpu}%`}} className={p.cpu>75?'bar-warn':''}/></div></td>
        <td><div className="cell-value">{p.memory.toLocaleString()}<small> MB</small></div></td>
        <td><div className="cell-value">{p.io.toFixed(1)}<small> MB/s</small></div></td>
        <td><Score value={p.score}/></td><td><StateTag stage={p.stage}/></td>
        <td><button className="row-action" aria-label={`Open ${p.name} details`} onClick={e=>{e.stopPropagation();onSelect(p)}}>···</button></td>
      </tr>)}
      {shown.length===0&&<tr><td colSpan={7} className="empty-state">No processes match this filter.</td></tr>}
    </tbody></table></div>
    <div className="table-footer"><span>Showing <b>{shown.length}</b> of <b>{processes.length}</b> processes</span><button className="text-button" onClick={()=>{setQuery('');setStateFilter('All states')}}>Clear filters <X size={13}/></button></div>
  </section>
}

function SelectedProcess({ process, onAction, onClose }: { process: Process; onAction: (p: Process) => void; onClose: () => void }) {
  const color=process.score>=5?'#a35e28':process.score>=3?'#bf8b38':'#396c59'
  return <aside className="detail-panel panel">
    <div className="detail-head"><div><div className="eyebrow">PROCESS DETAILS</div><h2>{process.name}</h2></div><button className="icon-button subtle" onClick={onClose} aria-label="Close details"><X size={16}/></button></div>
    <div className="detail-id">PID {process.pid}<span>·</span>{process.owner}</div>
    <div className="detail-state"><StateTag stage={process.stage}/><span>Updated just now</span></div>
    <div className="score-detail"><div className="score-detail-top"><span>ANOMALY SCORE</span><b>{process.score.toFixed(1)}<small> σ</small></b></div><div className="score-track"><i style={{width:`${Math.min(process.score*10,100)}%`,background:color}}/></div><div className="score-scale"><span>Baseline</span><span>T1 3.0σ</span><span>T2 5.0σ</span></div></div>
    <div className="detail-section-title">CURRENT TELEMETRY <span>LAST WINDOW</span></div>
    <div className="detail-metrics"><div><Cpu size={15}/><span>CPU usage</span><b>{process.cpu}%</b></div><div><Database size={15}/><span>Memory RSS</span><b>{process.memory.toLocaleString()} MB</b></div><div><HardDrive size={15}/><span>Disk I/O</span><b>{process.io.toFixed(1)} MB/s</b></div></div>
    <div className="detail-section-title">BEHAVIOR SUMMARY</div><p className="detail-copy">{process.detail}</p>
    <div className="detail-section-title">ACTIVE CONTROLS</div>
    {process.stage.includes('QUARANTINE')?<div className="control-list"><span><Check size={14}/>CPU quota <b>{process.stage.endsWith('L2')?'20%':'50%'}</b></span><span><Check size={14}/>Memory guard <b>memory.high</b></span><span><Check size={14}/>I/O limit <b>{process.stage.endsWith('L2')?'Enabled':'Watch'}</b></span></div>:<div className="no-controls"><ShieldCheck size={15}/><span>No resource controls applied</span></div>}
    <button className={process.stage.includes('QUARANTINE')?'button button-outline action-button':'button button-primary action-button'} onClick={()=>onAction(process)}>{process.stage.includes('QUARANTINE')?<><ShieldCheck size={15}/> Release process</>:<><ShieldAlert size={15}/> Quarantine process</>}</button>
    <p className="simulation-note"><LockKeyhole size={12}/> Simulation only. No host process will be changed.</p>
  </aside>
}

function EventLog({ events, compact=false }: { events: Event[]; compact?: boolean }) {
  const list=compact?events.slice(0,4):events
  return <div className={`event-list ${compact?'compact':''}`}>
    {list.map(e=><div className="event-row" key={e.id}><span className={`event-icon ${e.kind}`}>{e.kind==='good'?<Check size={13}/>:e.kind==='warn'?<ShieldAlert size={13}/>:<Activity size={13}/>}</span><div className="event-copy"><b>{e.name}</b><span>{e.message}</span></div><time>{e.time}</time></div>)}
  </div>
}

function EvaluationView() {
  const experiments=[
    ['E1 · CPU hog','Busy loop beside a latency-sensitive service','Service response time','Stay close to no-hog baseline'],
    ['E2 · Memory leak','Allocate until memory pressure rises','System memory and swap','Restrict before swap storm or OOM kill'],
    ['E3 · I/O flood','Heavy writer beside database benchmark','Benchmark throughput','Keep most baseline throughput'],
    ['E4 · Benign burst','Short legitimate resource spike','False quarantines','No quarantine for short bursts'],
    ['E5 · Recovery','Abnormal process returns to normal','Time to full allocation','Restore within M windows, without flapping'],
  ]
  return <div className="evaluation-view">
    <div className="page-title-row"><div><div className="eyebrow">REVIEW 3 · EXPERIMENT PLAN</div><h1>Evaluation</h1><p>Acceptance criteria defined before measurement. Results are not yet recorded.</p></div><button className="button button-outline" disabled title="Available when measured results are recorded"><Download size={15}/> Export results</button></div>
    <div className="callout warm"><span className="callout-icon"><CircleHelp size={17}/></span><div><b>Targets are proposed, not measured</b><p>The deck defines five experiments and acceptance targets. Add measured values after running each configuration. This view does not invent benchmark results.</p></div></div>
    <section className="panel evaluation-panel"><div className="panel-heading"><div><div className="eyebrow">EXPERIMENT MATRIX</div><h2>Five workloads · four configurations</h2></div><span className="measure-chip"><Clock3 size={13}/> Awaiting runs</span></div><div className="table-scroll"><table className="evaluation-table"><thead><tr><th>EXPERIMENT</th><th>SCENARIO</th><th>MEASURE</th><th>ACCEPTANCE TARGET</th><th>RESULT</th></tr></thead><tbody>{experiments.map((e)=><tr key={e[0]}><td><b>{e[0]}</b></td><td>{e[1]}</td><td>{e[2]}</td><td>{e[3]}</td><td><span className="pending-chip">Not run</span></td></tr>)}</tbody></table></div></section>
    <div className="evaluation-grid"><section className="panel config-panel"><div className="eyebrow">CONFIGURATIONS</div><h2>Comparison set</h2><div className="config-list">{[['No protection','Observe only'],['Kill on threshold','Terminate at T2'],['Static cgroup cap','Fixed resource limits'],['Adaptive quarantine','Score, restrict, reassess']].map(([a,b],i)=><div className="config-row" key={a}><span className={`config-num n${i+1}`}>0{i+1}</span><div><b>{a}</b><small>{b}</small></div><span className="config-status">Planned</span></div>)}</div></section><section className="panel metrics-panel"><div className="eyebrow">RECORDED METRICS</div><h2>Evidence to collect</h2><div className="metric-checks">{['CPU utilization','Memory and swap','Response time (p95)','I/O performance','Recovery time','False quarantines','Monitor overhead'].map((x,i)=><div key={x}><span className="check-empty">{i<6?'':'+'}</span>{x}<span className="metric-missing">{i<6?'Pending':'Optional'}</span></div>)}</div></section></div>
    <div className="evaluation-footnote"><ShieldCheck size={15}/><span>Run each configuration under the same hardware, workload, and monitoring window. Report repeated trials and variability alongside any average.</span></div>
  </div>
}

function EventsView({ events }: { events: Event[] }) {
  return <div className="standard-view"><div className="page-title-row"><div><div className="eyebrow">AUDIT TRAIL</div><h1>Event log</h1><p>Every state change includes its reason and the limits applied.</p></div><span className="measure-chip"><Activity size={13}/> {events.length} events</span></div><section className="panel full-events"><div className="panel-heading"><div><h2>Recent activity</h2><p>Simulation timeline · newest first</p></div><button className="select-button">All event types <ChevronDown size={13}/></button></div><EventLog events={events}/></section></div>
}

export default function App() {
  const [section,setSection]=useState<Section>('Overview')
  const [processes,setProcesses]=useState(seedProcesses)
  const [selectedId,setSelectedId]=useState(4182)
  const [events,setEvents]=useState(initialEvents)
  const [query,setQuery]=useState('')
  const [stateFilter,setStateFilter]=useState('All states')
  const [running,setRunning]=useState(false)
  const [notice,setNotice]=useState('')
  const selected=useMemo(()=>processes.find(p=>p.pid===selectedId),[processes,selectedId])
  const quarantined=processes.filter(p=>p.stage.includes('QUARANTINE')).length
  const addEvent=(pid:number,name:string,message:string,kind:Event['kind'])=>setEvents(current=>[{id:Date.now(),time:new Date().toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit'}),pid,name,message,kind},...current])
  const changeStage=(p:Process)=>{
    const next:Stage=p.stage.includes('QUARANTINE')?'NORMAL':'QUARANTINE L1'
    setProcesses(current=>current.map(item=>item.pid===p.pid?{...item,stage:next,score:next==='NORMAL'?1.2:5.4,detail:next==='NORMAL'?'Released in the simulation. Limits removed after manual review.':'Manual quarantine applied in the simulation. Review telemetry before escalation.'}:item))
    addEvent(p.pid,p.name,next==='NORMAL'?'Limits removed · returned to NORMAL':'QUARANTINE L1 · manual restriction applied',next==='NORMAL'?'good':'warn')
    setNotice(`${p.name} ${next==='NORMAL'?'released':'quarantined'} in the simulation`)
  }
  const startDemo=()=>{
    if(running){setRunning(false);setNotice('Demo stopped');return}
    setRunning(true);setNotice('Demo started · replaying a CPU anomaly')
    setProcesses(current=>current.map(p=>p.pid===4182?{...p,cpu:93,score:7.1,stage:'QUARANTINE L2',detail:'Demo replay: CPU activity rose above T2 for three consecutive windows.'}:p))
    addEvent(4182,'media-transcoder','DEMO · anomaly escalated to QUARANTINE L2', 'warn')
  }
  const resetDemo=()=>{setRunning(false);setProcesses(seedProcesses);setEvents(initialEvents);setNotice('Demo state reset')}
  useEffect(()=>{if(!notice)return;const t=window.setTimeout(()=>setNotice(''),3200);return()=>window.clearTimeout(t)},[notice])
  useEffect(()=>{if(!running)return;const t=window.setTimeout(()=>{setProcesses(current=>current.map(p=>p.pid===4182?{...p,cpu:38,score:1.1,stage:'NORMAL',detail:'Demo replay: behavior returned to baseline and restrictions were released.'}:p));addEvent(4182,'media-transcoder','DEMO · score below release threshold · limits removed','good');setRunning(false);setNotice('Recovery complete · process returned to NORMAL')},4500);return()=>window.clearTimeout(t)},[running])
  return <div className="app-shell">
    <Sidebar section={section} setSection={setSection}/>
    <div className="main-shell"><Header section={section} onRun={startDemo} running={running}/>
      <main className="main-content">
        {section==='Overview'&&<>
          <div className="page-title-row"><div><div className="eyebrow">MONITORING CENTER <span className="title-divider">/</span> TUESDAY, 20 OCTOBER</div><h1>Process overview</h1><p>A live view of resource activity and quarantine decisions.</p></div><div className="title-actions"><button className="button button-outline" onClick={resetDemo}><RotateCcw size={14}/> Reset demo</button><button className="button button-outline"><SlidersHorizontal size={14}/> Configure policy</button></div></div>
          <div className="simulation-banner"><div className="banner-icon"><Shield size={16}/></div><div><b>Simulation environment</b><span>Sample processes and telemetry are for demonstration. No host processes are monitored or controlled.</span></div><button aria-label="Dismiss simulation note" onClick={e=>e.currentTarget.parentElement?.classList.add('dismissed')}><X size={15}/></button></div>
          <div className="metrics-grid"><MetricCard label="Processes monitored" value={`${processes.length}`} note="2 new since last window" icon={Activity} tone="green" trend={[19,24,21,30,28,32,29,35,33,39,42,44]}/><MetricCard label="In quarantine" value={`${quarantined}`} note="1 escalated this window" icon={ShieldAlert} tone="amber" trend={[14,20,19,22,25,30,26,34,32,41,44,52]}/><MetricCard label="Protected service · p95" value="42" unit="ms" note="−18% vs. baseline" icon={Gauge} tone="green" trend={[52,49,47,50,46,44,46,42,43,40,41,38]} positive/><MetricCard label="False quarantines" value="0" note="No benign bursts flagged" icon={ShieldCheck} tone="blue" trend={[18,17,19,18,18,17,18,18,17,18,18,18]}/></div>
          <div className="dashboard-grid"><div className="dashboard-main"><WorkloadChart/><ProcessTable processes={processes} onSelect={p=>setSelectedId(p.pid)} selected={selectedId} query={query} setQuery={setQuery} stateFilter={stateFilter} setStateFilter={setStateFilter}/></div><div className="dashboard-aside">{selected&&<SelectedProcess process={selected} onAction={changeStage} onClose={()=>setSelectedId(-1)}/>}<section className="panel activity-panel"><div className="panel-heading panel-heading-inline"><div><div className="eyebrow">AUDIT TRAIL</div><h2>Recent events</h2></div><button className="text-button" onClick={()=>setSection('Event log')}>View all <ArrowUpRight size={13}/></button></div><EventLog events={events} compact/><button className="download-link" onClick={()=>setNotice('CSV export is available after recording measured results')}><Download size={13}/> Export event log</button></section></div></div>
          <footer className="page-footer"><span><span className="footer-green-dot"/> All systems nominal · Simulation</span><span>Last updated just now <span className="footer-separator">·</span> Policy v0.1</span></footer>
        </>}
        {section==='Processes'&&<div className="standard-view"><div className="page-title-row"><div><div className="eyebrow">MONITOR</div><h1>Processes</h1><p>Inspect telemetry and review state changes for every simulated workload.</p></div><button className="button button-outline" onClick={resetDemo}><RotateCcw size={14}/> Reset demo</button></div><div className="simulation-banner"><div className="banner-icon"><Shield size={16}/></div><div><b>Simulation environment</b><span>Process rows are sample data. Actions change the demo state only.</span></div></div><ProcessTable processes={processes} onSelect={p=>setSelectedId(p.pid)} selected={selectedId} query={query} setQuery={setQuery} stateFilter={stateFilter} setStateFilter={setStateFilter}/></div>}
        {section==='Event log'&&<EventsView events={events}/>}
        {section==='Evaluation'&&<EvaluationView/>}
      </main>
    </div>
    {notice&&<div className="toast" role="status"><Check size={15}/>{notice}<button onClick={()=>setNotice('')} aria-label="Dismiss message"><X size={14}/></button></div>}
  </div>
}
