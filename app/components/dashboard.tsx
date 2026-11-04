'use client';

import { useState } from 'react';
import { ArrowDownLeft, ArrowRight, ArrowUpRight, CarFront, CircleAlert, Clock3, ShieldCheck, Wallet, Wrench } from 'lucide-react';
import { formatMoney, formatDateTime, formatDate } from '@/lib/format';
import { rentalReceivable } from '@/lib/format';
import { AddButton, Badge, Button, EmptyState, PageHeading, RentalRows, Stat, depositFor, localDay, paidFor, useZenlo, vehicleState } from './common';

export default function Dashboard(){
 const {data,navigate,open,showRental,canEdit}=useZenlo();
 const [schedule,setSchedule]=useState('departures');
 const now=new Date(),today=localDay(now.toISOString());
 const active=data.rentals.filter(r=>r.status==='active');
 const ready=data.vehicles.filter(v=>vehicleState(v,data)==='ready');
 const preparing=data.vehicles.filter(v=>vehicleState(v,data)==='preparing');
 const reserved=data.vehicles.filter(v=>vehicleState(v,data)==='reserved');
 const maintenance=data.vehicles.filter(v=>vehicleState(v,data)==='maintenance');
 const departures=data.rentals.filter(r=>r.status==='confirmed'&&localDay(r.startAt)===today).sort((a,b)=>a.startAt.localeCompare(b.startAt));
 const returns=active.filter(r=>localDay(r.endAt)<=today).sort((a,b)=>a.endAt.localeCompare(b.endAt));
 const month=today.slice(0,7);
 const collected=data.payments.filter(p=>localDay(p.createdAt).startsWith(month)).reduce((n,p)=>n+(p.kind==='payment'?p.amount:p.kind==='refund'?-p.amount:0),0);
 const deposits=data.rentals.reduce((n,r)=>n+depositFor(r.id,data.payments),0);
 const outstanding=data.rentals.filter(r=>!['draft','cancelled'].includes(r.status)).reduce((n,r)=>n+Math.max(0,rentalReceivable(r,data.invoices)-paidFor(r.id,data.payments)),0);
 const overdue=active.filter(r=>Date.parse(r.endAt)<now.getTime());
 const expiring=data.vehicles.filter(v=>[v.insuranceUntil,v.inspectionUntil].some(d=>d&&Date.parse(d+'T23:59:59+01:00')<now.getTime()+30*86400000));
 const refundable=data.rentals.filter(r=>['returned','cancelled'].includes(r.status)&&depositFor(r.id,data.payments)>0);
 const overdueWork=data.maintenance.filter(m=>m.status!=='completed'&&Date.parse(m.endAt)<Date.now());
 const alerts=overdue.length+expiring.length+refundable.length+overdueWork.length;
 const dateLabel=new Intl.DateTimeFormat('fr-TN',{timeZone:'Africa/Tunis',weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(now);
 const rows=schedule==='departures'?departures:returns;
 const occupied=Math.round(active.length/Math.max(1,data.vehicles.filter(v=>v.status!=='retired').length)*100);
 return <>
  <PageHeading eyebrow="VOTRE AGENCE, EN MOUVEMENT" title={`Bonjour${data.user.name?' '+data.user.name.split(' ')[0]:''}.`} description="Voici l’essentiel pour une journée bien organisée.">{canEdit&&<AddButton onClick={()=>open({kind:'rental'})}>Nouvelle réservation</AddButton>}</PageHeading>
  <div className="dashboard-date"><span className="live-dot"/> {dateLabel}<span className="date-divider"/> Heure de Tunis</div>
  <div className="stats-grid">
   <Stat label="Véhicules disponibles" value={<>{ready.length}<span className="stat-denominator"> / {data.vehicles.filter(v=>v.status!=='retired').length}</span></>} description={<><span className="small-dot green"/>{maintenance.length} en maintenance</>} icon={<CarFront size={20}/>} accent/>
   <Stat label="Locations en cours" value={active.length} description={<><ArrowDownLeft size={14}/>{returns.length} retour{returns.length>1?'s':''} à traiter</>} icon={<ArrowUpRight size={20}/>}/>
   <Stat label="Encaissements du mois" value={<span className="stat-money">{formatMoney(collected)}</span>} description="Règlements nets, hors cautions" icon={<Wallet size={20}/>}/>
   <Stat label="Cautions détenues" value={<span className="stat-money">{formatMoney(deposits)}</span>} description={<><ShieldCheck size={14}/>{refundable.length} dossier{refundable.length>1?'s':''} à restituer</>} icon={<ShieldCheck size={20}/>}/>
  </div>
  <div className="dashboard-columns">
   <div className="dashboard-main">
    <section className="panel daily-panel"><div className="panel-heading"><div><h2>Le programme du jour <span className="count-pill">{departures.length+returns.length}</span></h2><p>Les prochaines clés à remettre et à récupérer.</p></div><Button variant="ghost" onClick={()=>navigate('planning')}>Planning <ArrowRight size={16}/></Button></div><div className="tabbar"><button className={schedule==='departures'?'selected':''} onClick={()=>setSchedule('departures')}><ArrowUpRight size={16}/> Départs <span>{departures.length}</span></button><button className={schedule==='returns'?'selected':''} onClick={()=>setSchedule('returns')}><ArrowDownLeft size={16}/> Retours <span>{returns.length}</span></button></div>{rows.length?<RentalRows rentals={rows} compact/>:<EmptyState title={schedule==='departures'?'Aucun départ prévu aujourd’hui':'Tous les retours sont à jour'} description="Le planning reste disponible pour préparer les prochains mouvements." action={<Button variant="secondary" onClick={()=>navigate('planning')}>Consulter le planning</Button>}/>}</section>
    <section className="panel"><div className="panel-heading"><div><h2>L’activité de l’agence</h2><p>Les dernières opérations enregistrées.</p></div><Button variant="ghost" onClick={()=>navigate('settings')}>Journal <ArrowRight size={16}/></Button></div><div className="activity-list">{data.audit.slice(0,5).map(a=><div className="activity-item" key={a.id}><div className="activity-marker"><Clock3 size={15}/></div><div><strong>{auditLabel(a.action)}</strong><p>{a.detail||a.entityType} <span>· {a.actor}</span></p></div><time>{formatDateTime(a.createdAt)}</time></div>)}{!data.audit.length&&<p className="muted activity-empty">Les actions de votre équipe apparaîtront ici.</p>}</div></section>
   </div>
   <aside className="dashboard-side">
    <section className="panel attention-panel"><div className="panel-heading"><h2><CircleAlert size={18}/> À suivre</h2><span className="count-pill amber">{alerts}</span></div><div className="attention-list">
     {overdue.slice(0,2).map(r=><button key={r.id} onClick={()=>showRental(r.id)} className="attention-item"><span className="attention-icon red"><Clock3 size={16}/></span><span><strong>Retour en retard</strong><small>{data.vehicles.find(v=>v.id===r.vehicleId)?.registration} · attendu le {formatDate(r.endAt)}</small></span><ArrowRight size={15}/></button>)}
     {expiring.slice(0,2).map(v=><button key={v.id} onClick={()=>{navigate('fleet');open({kind:'vehicle',id:v.id});}} className="attention-item"><span className="attention-icon amber"><ShieldCheck size={16}/></span><span><strong>Document à renouveler</strong><small>{v.make} {v.model} · {v.registration}</small></span><ArrowRight size={15}/></button>)}
     {refundable.slice(0,2).map(r=><button key={r.id} onClick={()=>showRental(r.id)} className="attention-item"><span className="attention-icon green"><Wallet size={16}/></span><span><strong>Caution à traiter</strong><small>{r.number} · {formatMoney(depositFor(r.id,data.payments))}</small></span><ArrowRight size={15}/></button>)}
     {overdueWork.slice(0,2).map(m=><button key={m.id} onClick={()=>{navigate('maintenance');open({kind:'maintenance',id:m.id});}} className="attention-item"><span className="attention-icon amber"><Wrench size={16}/></span><span><strong>Intervention à terminer</strong><small>{data.vehicles.find(v=>v.id===m.vehicleId)?.registration} · {m.title}</small></span><ArrowRight size={15}/></button>)}{!alerts&&<div className="all-clear"><ShieldCheck size={25}/><strong>Tout est sous contrôle</strong><p>Aucun retard ni document à renouveler dans les 30 prochains jours.</p></div>}
    </div></section>
    <section className="fleet-overview"><div className="fleet-overview-header"><span>Votre flotte, maintenant</span><CarFront size={20}/></div><div className="occupancy-number">{occupied}<span>%</span></div><p>des véhicules en location</p><div className="fleet-bars" aria-label={`${active.length} véhicules loués, ${ready.length} disponibles, ${maintenance.length} en maintenance`}>{data.vehicles.filter(v=>v.status!=='retired').map(v=><span key={v.id} className={`fleet-bar ${vehicleState(v,data)}`}/>)}</div><div className="fleet-legend"><span><i className="small-dot mint"/>En location <b>{active.length}</b></span><span><i className="small-dot pale"/>Disponibles <b>{ready.length}</b></span><span><i className="small-dot gold"/>Maintenance <b>{maintenance.length}</b></span><span><i className="small-dot gold"/>Préparation <b>{preparing.length}</b></span><span><i className="small-dot pale"/>Réservés maintenant <b>{reserved.length}</b></span></div><button onClick={()=>navigate('fleet')}>Voir le parc automobile <ArrowRight size={16}/></button></section>
    <section className="balance-note"><div><Wallet size={18}/><span>Solde clients à recevoir</span></div><strong>{formatMoney(outstanding)}</strong><button onClick={()=>navigate('finance')}>Ouvrir la trésorerie <ArrowRight size={14}/></button></section>
   </aside>
  </div>
 </>;
}

export function auditLabel(action:string){const map:Record<string,string>={'rental.created':'Réservation créée','rental.confirmed':'Réservation confirmée','rental.checkout':'Départ du véhicule','rental.checkin':'Retour du véhicule','rental.cancelled':'Réservation annulée','rental.extended':'Location prolongée','rental.swapped':'Véhicule remplacé','vehicle.created':'Véhicule ajouté au parc','vehicle.updated':'Fiche véhicule mise à jour','customer.created':'Nouveau client','payment.created':'Mouvement financier enregistré','settings.updated':'Paramètres mis à jour','workspace.created':'Espace agence créé','invoice.created':'Facture préparée','invoice.issued':'Facture émise','invoice.credited':'Avoir enregistré','maintenance.created':'Intervention planifiée','maintenance.completed':'Intervention terminée','cash.opened':'Caisse ouverte','cash.closed':'Caisse clôturée','member.created':'Membre ajouté','member.updated':'Droits mis à jour','expense.created':'Dépense enregistrée'};const actual:Record<string,string>={'finance.payment':'Règlement enregistré','finance.refund':'Remboursement enregistré','finance.deposit_received':'Caution reçue','finance.deposit_returned':'Caution restituée','finance.deposit_applied':'Caution affectée','rental.confirm':'Réservation confirmée','rental.cancel':'Réservation annulée','rental.extend':'Location prolongée','rental.swap':'Véhicule remplacé','invoice.draft':'Facture préparée','maintenance.planned':'Intervention planifiée','expense.recorded':'Dépense enregistrée','member.added':'Membre ajouté','member.role_changed':'Droits mis à jour','customer.updated':'Fiche client mise à jour','photo.added':'Photo ajoutée au dossier','photo.viewed':'Photo consultée','data.imported':'Données importées'};return actual[action]||map[action]||action.replaceAll('_',' ').replaceAll('.',' · ');}
