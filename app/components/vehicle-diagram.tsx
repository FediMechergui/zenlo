'use client';
import { originalVehicle } from '@/lib/original-vehicles';
import { OriginalVehicleDrawing } from '@/app/components/original-vehicle-drawing';
import { VehicleDetail } from '@/app/components/vehicle-detail';
import { useState, useId, type MouseEvent } from 'react';
import { viewsForProfile, BODY_TYPES, DEFAULT_DIAGRAM_PROFILE, vehicleFamily, INSPECTION_VIEWS, VIEW_LABELS, DAMAGE_TYPES, type DiagramProfile, type BodyType, type DamageMark, type InspectionView } from '@/lib/inspection';
import './vehicle-experience.css';

type Outline={body:string;windows:string;door?:string;detail?:string};
const OUTLINES:Partial<Record<BodyType,Outline>>={
  hatchback:{body:'M40 139 L40 115 Q41 104 56 99 L107 91 L147 54 Q154 48 167 48 L257 48 Q272 49 281 64 L307 91 L339 99 Q354 103 356 119 L356 141 L324 141 A30 30 0 0 0 264 141 L134 141 A30 30 0 0 0 74 141 Z',windows:'M121 89 L153 59 L199 59 L199 89 Z M209 59 L253 59 Q264 60 271 71 L284 89 L209 89 Z',door:'M202 94 L202 136 M122 94 L117 113 M285 94 L291 109',detail:'M157 104 L174 104 M244 104 L260 104'},
  sedan:{body:'M34 140 L34 119 Q35 108 49 104 L110 93 L152 56 Q158 51 169 51 L240 51 Q251 52 260 60 L299 91 L348 99 Q363 103 365 118 L365 140 L328 140 A30 30 0 0 0 268 140 L131 140 A30 30 0 0 0 71 140 Z',windows:'M123 91 L157 62 L197 62 L197 91 Z M208 62 L237 62 Q244 62 251 69 L279 91 L208 91 Z',door:'M202 96 L202 136 M124 96 L119 111 M282 96 L290 109',detail:'M154 106 L171 106 M246 106 L262 106 M301 94 L343 102'},
  suv:{body:'M34 140 L34 109 Q36 96 52 90 L106 81 L143 43 Q152 35 166 35 L269 35 Q280 36 288 49 L316 82 L350 91 Q365 96 366 112 L366 140 L330 140 A33 33 0 0 0 264 140 L135 140 A33 33 0 0 0 69 140 Z',windows:'M122 81 L151 48 L198 48 L198 81 Z M210 48 L260 48 L281 81 L210 81 Z M271 48 L279 54 L299 81 L290 81 Z',door:'M204 85 L204 135 M124 85 L119 107 M285 85 L289 105',detail:'M157 97 L174 97 M246 97 L262 97 M157 28 L263 28 M48 128 L63 128 M337 128 L353 128'},
  van:{body:'M34 140 L34 104 Q34 94 44 89 L98 78 L132 36 Q139 28 153 28 L337 28 Q353 28 357 44 L366 105 L366 140 L332 140 A31 31 0 0 0 270 140 L133 140 A31 31 0 0 0 71 140 Z',windows:'M114 79 L142 41 L191 41 L191 79 Z M204 41 L259 41 L259 79 L204 79 Z M270 41 L335 41 L342 79 L270 79 Z',door:'M198 84 L198 136 M265 84 L265 136 M348 87 L350 135',detail:'M164 94 L180 94 M212 94 L229 94 M211 116 L255 116'},
  pickup:{body:'M28 140 L28 110 Q28 100 43 96 L100 83 L132 44 Q139 36 153 36 L232 36 Q243 37 247 48 L259 84 L367 84 L370 139 L337 139 A33 33 0 0 0 271 139 L131 139 A33 33 0 0 0 65 139 Z',windows:'M114 82 L142 48 L184 48 L184 82 Z M196 48 L229 48 L242 82 L196 82 Z',door:'M190 87 L190 136 M249 88 L249 136 M264 90 L264 132',detail:'M152 97 L170 97 M211 97 L228 97 M268 94 L358 94 M273 108 L354 108'},
  coupe:{body:'M30 141 L30 124 Q33 113 49 108 L118 97 L158 66 Q172 55 192 55 L235 55 Q251 55 265 67 L305 96 L349 105 Q367 111 369 125 L369 141 L332 141 A30 30 0 0 0 272 141 L131 141 A30 30 0 0 0 71 141 Z',windows:'M137 95 L169 70 Q178 65 192 65 L221 65 L237 95 Z M233 65 Q246 65 256 76 L280 95 L249 95 Z',door:'M247 100 L248 137 M138 100 L130 116',detail:'M214 111 L234 111 M314 101 L350 110'},
  convertible:{body:'M30 141 L30 123 Q33 113 48 108 L122 98 L155 66 L168 66 L150 98 L205 98 L214 85 L230 85 L239 98 L274 97 L294 89 L315 89 L327 99 L353 109 Q366 116 367 128 L367 141 L331 141 A30 30 0 0 0 271 141 L131 141 A30 30 0 0 0 71 141 Z',windows:'M137 96 L158 73 L162 73 L147 96 Z',door:'M247 103 L246 137 M139 103 L132 116',detail:'M214 113 L234 113 M280 103 L318 103'},
};

function SideOutline({bodyType,mirror,wheelScale=100}:{bodyType:BodyType;mirror:boolean;wheelScale?:number}){
  const shape=OUTLINES[bodyType]!,frontWheel=bodyType==='pickup'?98:bodyType==='suv'?102:101,rearWheel=bodyType==='van'?301:bodyType==='pickup'?304:bodyType==='suv'?297:bodyType==='sedan'?298:bodyType==='coupe'||bodyType==='convertible'?302:294;
  return <g transform={mirror?'translate(400 0) scale(-1 1)':undefined} className="vehicle-outline"><path d={shape.body} fill="var(--vehicle-paper, #fafbf9)"/><path d={shape.windows} fill="var(--vehicle-glass, #e9eee9)"/><path d={shape.door||''}/><path d={shape.detail||''}/>{[frontWheel,rearWheel].map(x=><g key={x} transform={`translate(${x} 141) scale(${wheelScale/100}) translate(${-x} -141)`}><circle cx={x} cy="141" r={bodyType==='suv'||bodyType==='pickup'?26:24} fill="var(--vehicle-paper, #fafbf9)"/><circle cx={x} cy="141" r="15"/><circle cx={x} cy="141" r="4"/><path d={`M${x-11} 130 L${x+11} 152 M${x-11} 152 L${x+11} 130 M${x-15} 141 H${x+15}`}/></g>)}<path d="M48 108 L66 108 L61 117 L42 117 M340 106 L354 110 L356 120 L344 119"/><path d="M142 132 H259" className="vehicle-fine-line"/></g>;
}
function EndOutline({bodyType,rear}:{bodyType:BodyType;rear:boolean}){
  const tall=['suv','van','pickup'].includes(bodyType),van=bodyType==='van',low=bodyType==='coupe'||bodyType==='convertible';
  const top=van?26:tall?36:low?61:48,bottom=tall?154:low?151:151;
  const left=van?115:130,right=400-left;
  return <g className="vehicle-outline"><path d={`M95 ${bottom-10} L95 103 Q96 92 107 87 L${left} ${top+9} Q${left+4} ${top} ${left+14} ${top} H${right-14} Q${right-4} ${top} ${right} ${top+9} L293 87 Q304 92 305 103 L305 ${bottom-10} Q305 ${bottom} 294 ${bottom} H106 Q95 ${bottom} 95 ${bottom-10} Z`} fill="var(--vehicle-paper, #fafbf9)"/>
    <path d={`M${left+7} ${top+12} H${right-7} L${rear&&van?right-3:283} 87 H${rear&&van?left+3:117} Z`} fill="var(--vehicle-glass, #e9eee9)"/>
    <path d={`M104 ${bottom} V165 H124 V${bottom} M276 ${bottom} V165 H296 V${bottom}`} fill="var(--vehicle-glass, #e9eee9)"/>
    <path d="M104 85 L87 82 Q82 83 82 89 L99 92 M296 85 L313 82 Q318 83 318 89 L301 92"/>
    {rear?<><path d="M107 101 H137 L143 116 H106 Z M263 101 H293 L294 116 H257 Z" fill="var(--vehicle-glass, #e9eee9)"/><path d={`M143 99 H257 M108 ${bottom-12} H292 M160 119 H240 V137 H160 Z`}/>{van?<path d={`M200 ${top+7} V${bottom-15} M182 105 H190 M210 105 H218`}/>:<path d="M178 108 H222 M200 81 L229 81"/>}</>:<><path d="M105 104 L151 108 L145 119 H107 Z M295 104 L249 108 L255 119 H293 Z" fill="var(--vehicle-glass, #e9eee9)"/><path d={`M158 109 H242 L235 125 H165 Z M139 134 H261 M169 134 V144 H231 V134 M111 ${bottom-10} H134 M266 ${bottom-10} H289`}/><path d="M132 92 L145 103 M268 92 L255 103" className="vehicle-fine-line"/></>}
    <path d={`M103 ${bottom-4} H297`} className="vehicle-fine-line"/>
  </g>;
}

function FleetOutline({bodyType,view,wheelScale}:{bodyType:BodyType;view:InspectionView;wheelScale:number}){
  const side=view==='left'||view==='right',rear=view==='rear',family=vehicleFamily(bodyType),two=family==='two_wheeler';
  const paint='var(--vehicle-paper, #fafbf9)',glass='var(--vehicle-glass, #e9eee9)';
  const wheel=(x:number,r=25)=><g key={x} transform={`translate(${x} 143) scale(${wheelScale/100})`}><circle r={r} fill={paint}/><circle r={r-8}/><circle r="4"/><path d={`M-${r-9} 0 H${r-9} M0 -${r-9} V${r-9}`}/></g>;
  return <g className="vehicle-outline" transform={side&&view==='right'?'translate(400 0) scale(-1 1)':undefined}>
    {side?(two||family==='quad'?<>
      {family==='quad'?<><path d="M58 119 L70 85 L133 80 L156 98 L251 98 L272 80 L332 88 L346 122 L316 130 H88 Z" fill={paint}/><path d="M151 94 L138 70 H192 L217 94 M142 71 L128 54 H108 M239 89 H288"/><path d="M115 103 H285 L264 133 H139 Z" fill={glass}/></>:<>
        <path d={bodyType==='scooter'?'M101 133 L123 70 L143 57 L159 62 L148 112 H237 L248 75 L291 75 Q314 83 311 112 L291 134 H151 Z':'M108 142 L151 93 L229 99 L278 143 L181 143 L151 93 M181 143 L229 99 L252 76 H296'} fill={paint}/>
        {bodyType==='motorcycle'?<><path d="M158 91 Q165 66 191 68 L231 91 L227 102 H171 Z" fill={glass}/><path d="M225 82 H285 L298 90 H231 Z M179 112 H222 V135 H184 Z" fill={paint}/></>:<path d="M245 71 H296 L304 79 H242 Z" fill={glass}/>}
        <path d="M101 143 L130 61 L123 42 H101 M126 56 L152 53 M141 55 L154 37 L155 24"/><path d="M242 143 L289 124 H315 M126 109 Q104 90 80 112 M260 115 Q286 96 310 119"/>
      </>}{wheel(100)}{wheel(291)}
    </>:family==='truck'?<>
      <path d="M32 139 V96 L59 48 H123 V139 Z" fill={paint}/><path d="M43 95 L68 59 H112 V95 Z" fill={glass}/><path d="M120 40 H139 V140 H121 M39 110 H66 M86 106 H103 M47 134 H348 V146 H322"/>
      {bodyType==='truck'?<><path d="M142 33 H364 V133 H142 Z" fill={paint}/><path d="M151 42 H354 V123 H151 Z M151 113 H354"/></>:bodyType==='tipper'?<><path d="M144 63 H365 L337 131 H170 Z" fill={paint}/><path d="M173 74 L187 119 M220 74 L229 119 M269 74 L272 119 M316 74 L311 119"/></>:<><path d="M144 118 H365 V135 H144 Z" fill={paint}/><path d="M150 118 V87 M361 118 V87 M157 110 H354"/></>}
      {wheel(82,26)}{wheel(281,26)}{wheel(332,26)}
    </>:<>
      <path d="M32 139 V76 L54 34 Q57 27 69 27 H346 Q363 27 365 45 V139 Z" fill={paint}/>
      <path d="M42 76 L64 40 H99 V80 H42 Z" fill={glass}/>
      {(bodyType==='minibus'?[111,160,209,258,307]:[106,145,184,223,262,301]).map(x=><path key={x} d={`M${x} 40 H${x+(bodyType==='minibus'?37:29)} V79 H${x} Z`} fill={glass}/>)}
      <path d="M103 84 V132 M40 94 H357 M43 118 H62 M344 115 H358 M115 107 H248 M115 115 H248 M263 88 V128 H303 V88"/>{wheel(83)}{wheel(319)}
    </>):two?<>
      <path d="M189 122 H211 V166 H189 Z" fill={glass}/><path d="M181 146 V101 Q200 87 219 101 V146 M188 98 L178 67 H222 L212 98" fill={paint}/>
      <path d="M155 59 L175 70 H225 L245 59 M154 59 V42 H137 V53 H155 M246 59 V42 H263 V53 H245 M178 64 L183 32 H217 L222 64" fill={glass}/>
      {rear?<><path d="M179 78 H221 V90 H179 Z M185 104 H215 V123 H185 Z" fill={paint}/><path d="M175 133 V162 H182"/></>:<><path d="M182 73 H218 L211 91 H189 Z" fill={glass}/><path d="M170 94 H178 M222 94 H230"/></>}
    </>:family==='quad'?<>
      <path d="M102 116 H145 V163 H102 Z M255 116 H298 V163 H255 Z" fill={glass}/><path d="M104 119 L114 91 H153 L166 102 H234 L247 91 H286 L296 119 L262 136 H138 Z" fill={paint}/><path d="M151 96 L165 70 H235 L249 96 M165 70 L148 54 H132 M235 70 L252 54 H268 M162 123 H238"/>
      {rear?<path d="M167 105 H233 V119 H167 Z"/>:<path d="M118 105 H147 V114 H118 Z M253 105 H282 V114 H253 Z" fill={glass}/>}
    </>:<>
      <path d="M116 141 H141 V166 H116 Z M259 141 H284 V166 H259 Z" fill={glass}/><path d="M101 148 V38 Q101 26 114 26 H286 Q299 26 299 38 V148 Z" fill={paint}/>
      {rear&&family==='truck'?<><path d={bodyType==='truck'?'M111 35 H289 V134 H111 Z M200 35 V134 M185 99 V118 M215 99 V118':'M111 65 H289 V134 H111 Z M115 77 H285 M115 120 H285'}/><path d="M111 139 H139 M261 139 H289 M174 139 H226"/></>:<><path d={`M112 39 H288 V${family==='bus'?94:88} H112 Z`} fill={glass}/><path d="M127 80 H175 M224 80 H273 M107 100 H293 M117 111 H155 V122 H117 Z M245 111 H283 V122 H245 Z M168 111 H232 V131 H168 Z M111 141 H289"/>{rear&&<path d="M153 51 H247 M163 57 H237"/>}</>}
      {!rear&&<path d="M101 66 H82 V93 H94 M299 66 H318 V93 H306"/>}
    </>}
  </g>;
}

export interface VehicleDiagramProps {
  profile?:DiagramProfile|null;
  bodyType?:BodyType;marks?:DamageMark[];selectedId?:string|null;
  onAdd?:(view:InspectionView,x:number,y:number,part?:string)=>void;onSelect?:(id:string)=>void;
  readOnly?:boolean;className?:string;caption?:boolean;
}
export function VehicleDiagram({bodyType='hatchback',profile,marks=[],selectedId,onAdd,onSelect,readOnly=false,className='',caption=true}:VehicleDiagramProps){
  const [expanded,setExpanded]=useState<InspectionView|null>(null);const uid=useId();const custom=profile||DEFAULT_DIAGRAM_PROFILE;const original=custom.original?originalVehicle(custom.original.id,custom.original.revision):undefined;const interactive=!readOnly&&!!onAdd;
  function place(event:MouseEvent<SVGSVGElement>,view:InspectionView){
    if(!interactive)return;const svg=event.currentTarget;const matrix=svg.getScreenCTM();if(!matrix)return;
    const point=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    if(point.x<0||point.x>400||point.y<0||point.y>190)return;
    onAdd?.(view,Math.round(point.x/4*10)/10,Math.round(point.y/1.9*10)/10,(event.target as Element).closest('[data-part]')?.getAttribute('data-part')||undefined);
  }
  return <div className={`vehicle-diagram ${interactive?'is-interactive':''} ${className}`}><div className="vehicle-diagram-grid">{viewsForProfile(profile).map(view=><figure className={`vehicle-view ${interactive?'is-editable':''} ${expanded===view?'is-expanded':''}`} key={view}><figcaption><span>{VIEW_LABELS[view]}</span><small>{view==='left'?'← Avant':view==='right'?'Avant →':bodyType==='van'?'Utilitaire':BODY_TYPES.find(t=>t.value===bodyType)?.label}</small>{custom.detailVersion===2&&<button type="button" className="vehicle-zoom" aria-label={`${expanded===view?'Réduire':'Agrandir'} ${VIEW_LABELS[view]}`} aria-pressed={expanded===view} onClick={()=>setExpanded(expanded===view?null:view)}>{expanded===view?'Réduire':'Agrandir'}</button>}</figcaption>{custom.detailVersion===2&&<p className="vehicle-view-source">{original?`Dessin Zenlo r${original.revision} · ${custom.original?.reviewed?'correspondance vérifiée par l’agence':'à vérifier sur le véhicule'}`:custom.reference?.sheets.some(s=>s.view===view)?custom.reference.reviewed?'Référence vérifiée par l’agence':'Référence importée · à vérifier':'Gabarit générique · référence absente'}</p>}<svg viewBox="0 0 400 190" role={interactive?'button':'img'} aria-labelledby={`${uid}-${view}`} tabIndex={interactive?0:undefined} onClick={event=>place(event,view)} onKeyDown={event=>{if(interactive&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onAdd?.(view,50,50);}}}><title id={`${uid}-${view}`}>{`${VIEW_LABELS[view]} du véhicule${interactive?' — cliquez pour positionner un repère ; Entrée pour l’ajouter au centre.':''}`}</title>{original?<OriginalVehicleDrawing id={original.id} revision={original.revision} view={view}/>:custom.reference?.sheets.find(s=>s.view===view)?<>
<ReferenceSheet key={custom.reference.sheets.find(s=>s.view===view)!.assetId} assetId={custom.reference.sheets.find(s=>s.view===view)!.assetId}/>
{custom.reference.zones.filter(z=>z.view===view).map((z,i)=><rect key={i} className="vehicle-reference-zone" data-part={z.name} x={z.x*4} y={z.y*1.9} width={z.width*4} height={z.height*1.9}><title>{z.name}</title></rect>)}
</>:['top','cabin','dashboard','cargo'].includes(view)?<VehicleDetail bodyType={bodyType} view={view}/>:<><path d="M24 172 H376" className="vehicle-ground-line"/><g transform={`translate(200 172) scale(${(view==='left'||view==='right'?custom.length:custom.width)/100} ${custom.height/100}) translate(-200 -172)`}>{vehicleFamily(bodyType)==='car'?(view==='left'||view==='right'?<SideOutline bodyType={bodyType} mirror={view==='right'} wheelScale={custom.wheelScale}/>:<EndOutline bodyType={bodyType} rear={view==='rear'}/>):<FleetOutline bodyType={bodyType} view={view} wheelScale={custom.wheelScale}/>} {custom.roofRack&&<path className="vehicle-outline" d={view==='left'||view==='right'?'M151 24 H265 M157 24 V18 H259 V24':'M139 20 H261 M146 20 V15 H254 V20'}/>}{custom.detailVersion===2&&<VehicleDetail bodyType={bodyType} view={view}/>}</g></>}{marks.map((mark,index)=>mark.view!==view?null:<g className={`vehicle-mark mark-${mark.status} severity-${mark.severity} ${selectedId===mark.id?'is-selected':''}`} key={mark.id} transform={`translate(${mark.x*4} ${mark.y*1.9})`} role={onSelect?'button':undefined} tabIndex={onSelect?0:undefined} aria-label={`Repère ${index+1} : ${DAMAGE_TYPES[mark.type]}, ${mark.note||VIEW_LABELS[mark.view]}`} onClick={event=>{event.stopPropagation();onSelect?.(mark.id);}} onKeyDown={event=>{if(onSelect&&(event.key==='Enter'||event.key===' ')){event.preventDefault();event.stopPropagation();onSelect(mark.id);}}}><title>{`${index+1}. ${DAMAGE_TYPES[mark.type]}${mark.note?` — ${mark.note}`:''}`}</title><circle r="15" className="vehicle-mark-hit"/><circle r="11"/><text textAnchor="middle" dominantBaseline="central">{index+1}</text></g>)}</svg></figure>)}</div>{caption&&<p className="vehicle-diagram-caption">{custom.label&&<strong>{custom.label} · </strong>}{original?`${original.make} ${original.model} · ${original.generation} · ${original.yearFrom}–${original.yearTo} · ${original.variant}. Illustration originale Zenlo, révision ${original.revision}. ${original.limitations} `:''}{custom.reference?`${custom.reference.make} ${custom.reference.model} · ${custom.reference.generation||'Génération à préciser'} · ${custom.reference.yearFrom}–${custom.reference.yearTo} · ${custom.reference.variant||'Variante à préciser'}. Source : ${custom.reference.source||'à renseigner'}. `:''}Schéma de repérage ; les vues génériques ne reproduisent pas un modèle exact. Les photos complètent le constat.</p>}</div>;
}
function ReferenceSheet({assetId}:{assetId:string}){const [failed,setFailed]=useState(false);return <><image href={`/api/diagram-assets/${assetId}`} x="0" y="0" width="400" height="190" preserveAspectRatio="xMidYMid meet" onError={()=>setFailed(true)}/>{failed&&<text x="200" y="95" textAnchor="middle" fontSize="12" fill="#984832">Vue indisponible — rechargez le document.</text>}</>;}
export default VehicleDiagram;
