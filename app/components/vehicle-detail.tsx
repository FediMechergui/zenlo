import type { ReactNode } from 'react';
import { vehicleFamily,type BodyType,type InspectionView } from '@/lib/inspection';

const paper='var(--vehicle-paper, #fafbf9)',glass='var(--vehicle-glass, #e9eee9)';
function Part({name,children}:{name:string;children:ReactNode}){return <g data-part={name} className="vehicle-part" aria-label={name}><title>{name}</title>{children}</g>;}
function Seat({x,y,name}:{x:number;y:number;name:string}){return <Part name={name}><g transform={`translate(${x} ${y})`}><rect x="-16" y="-18" width="32" height="38" rx="7" fill={paper}/><path d="M-12 -9 H12 M-11 -6 V11 Q0 17 11 11 V-6 M-16 13 H16"/><rect x="-9" y="-23" width="18" height="9" rx="3" fill={glass}/><path d="M-12 -10 L12 10" className="vehicle-fine-line"/></g></Part>;}

/** Generic component-level reference only. Model-specific sheets replace this drawing in full. */
export function VehicleDetail({bodyType,view}:{bodyType:BodyType;view:InspectionView}){
 const family=vehicleFamily(bodyType),bike=family==='two_wheeler'||family==='quad',truck=family==='truck',bus=family==='bus',side=view==='left'||view==='right';
 if(['top','cabin','dashboard','cargo'].includes(view))return <g className="vehicle-outline vehicle-detail">
  {view==='top'?(bike?<>
   <Part name="Pneu avant"><rect x="180" y="16" width="40" height="34" rx="9" fill={glass}/><path d="M190 20 V45 M200 20 V45 M210 20 V45"/></Part>
   <Part name="Guidon et rétroviseurs"><path d="M143 59 H257 M167 59 L155 43 H133 V54 H153 M233 59 L245 43 H267 V54 H247"/><path d="M157 56 V64 M243 56 V64"/></Part>
   <Part name="Réservoir / carénage"><path d="M177 61 Q200 48 223 61 L229 93 Q200 111 171 93 Z" fill={glass}/><circle cx="200" cy="73" r="6"/></Part>
   <Part name="Selle"><path d="M178 105 Q200 95 222 105 L219 140 H181 Z" fill={paper}/><path d="M181 120 H219"/></Part>
   <Part name="Repose-pieds"><path d="M178 114 H153 V120 H178 M222 114 H247 V120 H222"/></Part>
   <Part name="Feu et roue arrière"><rect x="181" y="146" width="38" height="26" rx="7" fill={glass}/><path d="M184 148 H216 M190 154 V168 M210 154 V168"/></Part>
  </>:<>
   <Part name="Carrosserie vue de dessus"><path d="M132 37 Q135 18 155 16 H245 Q265 18 268 37 L274 151 Q273 171 252 174 H148 Q127 171 126 151 Z" fill={paper}/><path d="M138 38 H262 M135 151 H265"/></Part>
   <Part name="Capot"><path d="M145 28 H255 L259 55 H141 Z"/><path d="M150 33 L147 49 M250 33 L253 49" className="vehicle-fine-line"/></Part>
   <Part name="Pare-brise"><path d="M141 60 H259 L252 80 H148 Z" fill={glass}/><path d="M152 77 L183 67 M212 77 L242 67"/></Part>
   <Part name={truck?'Caisse / plateau':bus?'Toit et issues de secours':'Pavillon / toit ouvrant'}><path d="M149 85 H251 V133 H149 Z" fill={glass}/>{bus?<path d="M170 92 H230 V105 H170 Z M170 112 H230 V126 H170 Z"/>:<path d="M163 94 H237 V120 H163 Z"/>}</Part>
   <Part name="Lunette arrière"><path d="M149 138 H251 L262 153 H138 Z" fill={glass}/><path d="M153 143 H247 M147 148 H253"/></Part>
   <Part name="Rétroviseur gauche"><path d="M131 67 L115 62 Q106 65 111 73 L130 77 Z" fill={paper}/></Part><Part name="Rétroviseur droit"><path d="M269 67 L285 62 Q294 65 289 73 L270 77 Z" fill={paper}/></Part>
   <Part name="Portes et poignées"><path d="M136 83 V133 M264 83 V133 M130 104 H147 M253 104 H270 M132 89 V98 M268 89 V98 M131 116 V126 M269 116 V126"/></Part>
  </>):view==='cabin'?(bike?<>
   <Part name="Selle conducteur"><path d="M133 45 Q190 24 240 45 L255 88 Q192 110 129 84 Z" fill={paper}/><path d="M145 49 Q193 36 232 49 M141 61 Q192 48 239 61 M140 73 Q190 60 244 74"/></Part>
   <Part name="Selle passager / poignées"><path d="M145 111 Q194 96 245 111 L231 151 H155 Z" fill={glass}/><path d="M136 112 L124 146 H147 M254 112 L266 146 H243"/></Part>
   <Part name="Repose-pieds et supports"><path d="M118 75 H83 V83 H118 M268 75 H303 V83 H268 M138 133 H104 V141 H138 M254 133 H288 V141 H254"/></Part>
  </>:<>
   <Part name="Habitacle et garnitures"><rect x={bus?74:116} y="20" width={bus?252:168} height="153" rx="22" fill={paper}/><path d={bus?'M84 48 H316 M197 55 V161 M203 55 V161':'M127 52 H273 M125 65 V150 M275 65 V150 M193 60 V153 H207 V60'}/></Part>
   <Part name="Volant"><circle cx={bus?105:158} cy="44" r="13"/><circle cx={bus?105:158} cy="44" r="5"/><path d={bus?'M93 44 H117 M105 49 V57':'M146 44 H170 M158 49 V57'}/></Part>
   {bus?[91,135,240,284].flatMap((x,i)=>[80,136].map((y,j)=><Seat key={`${x}-${y}`} x={x} y={y} name={`Siège passager ${i*2+j+1} (schématique)`}/>)):<><Seat x={158} y={85} name="Siège conducteur / ceinture"/><Seat x={242} y={85} name="Siège passager avant / ceinture"/>{!truck&&<><Seat x={158} y={140} name="Siège arrière gauche / ceinture"/><Seat x={242} y={140} name="Siège arrière droit / ceinture"/></>}</>}
   <Part name="Console / allée"><path d={bus?'M190 60 V165 M210 60 V165':'M197 72 H203 V94 H197 Z M195 109 H205 V133 H195 Z'}/></Part>
  </>):view==='dashboard'?<>
   <Part name={bike?'Guidon et commandes':'Planche de bord'}><path d={bike?'M70 86 L113 97 H287 L330 86 M113 97 L151 65 H249 L287 97':'M43 73 Q48 39 88 38 H312 Q352 39 357 73 V139 H43 Z'} fill={paper}/></Part>
   <Part name="Compteurs et témoins"><path d={bike?'M152 52 Q200 35 248 52 V89 H152 Z':'M73 59 Q122 39 171 59 V88 H73 Z'} fill={glass}/>{[bike?176:99,bike?224:145].map(x=><g key={x}><circle cx={x} cy="68" r="15"/><path d={`M${x-9} 72 L${x} 68 L${x+5} 57 M${x-6} 78 H${x+6}`}/></g>)}</Part>
   {bike?<><Part name="Poignées / leviers"><path d="M65 78 L111 88 L108 102 L63 91 Z M289 88 L335 78 L337 91 L292 102 Z M62 65 L109 79 M291 79 L338 65" fill={glass}/></Part><Part name="Commodos / contact"><rect x="116" y="90" width="24" height="23" rx="3"/><rect x="260" y="90" width="24" height="23" rx="3"/><circle cx="200" cy="113" r="9"/><path d="M200 107 V119"/></Part><Part name="Rétroviseurs"><path d="M100 80 L90 41 H58 V25 H93 V41 M300 80 L310 41 H342 V25 H307 V41" fill={paper}/></Part></>:<>
    <Part name="Volant / airbag"><circle cx="121" cy="108" r="35" fill={paper}/><circle cx="121" cy="108" r="26"/><path d="M89 104 H108 M134 104 H153 M121 121 V140"/><rect x="108" y="97" width="26" height="23" rx="7" fill={glass}/></Part>
    <Part name="Écran / autoradio"><rect x="192" y="64" width="62" height="34" rx="3" fill={glass}/><path d="M200 72 H245 M200 80 H234 M200 88 H240"/></Part>
    <Part name="Aérateurs"><path d="M52 60 H73 V87 H52 Z M270 59 H341 V82 H270 Z M56 65 H69 M56 72 H69 M56 79 H69 M277 65 H335 M277 72 H335"/></Part>
    <Part name="Climatisation / commandes"><rect x="191" y="104" width="63" height="28" rx="3"/>{[203,222,241].map(x=><circle key={x} cx={x} cy="118" r="6"/>)}</Part>
    <Part name="Boîte à gants"><path d="M271 96 H344 V128 H271 Z M300 102 H316"/></Part><Part name="Pédales"><path d="M88 153 H101 V168 H88 Z M114 153 H128 V168 H114 Z M144 149 H155 V171 H144 Z" fill={glass}/></Part>
   </>}
  </>:<>
   <Part name={bike?'Top-case / bagagerie (si équipé)':truck?'Caisse / plateau et arrimage':'Coffre / compartiment de chargement'}><path d={bike?'M129 54 Q200 30 271 54 V146 H129 Z':'M81 44 Q81 28 98 28 H302 Q319 28 319 44 V157 H81 Z'} fill={paper}/><path d={bike?'M133 76 H267 M187 80 H213 V90 H187 Z':'M94 56 H306 V145 H94 Z M103 65 H297 M103 135 H297'}/></Part>
   {!bike&&<><Part name="Plancher / tapis"><path d="M104 81 H296 V130 H104 Z" fill={glass}/>{truck?[126,153,180,207,234,261].map(x=><path key={x} d={`M${x} 84 V127`}/>):<path d="M157 88 H243 V121 H157 Z"/>}</Part><Part name="Points d’arrimage / crochets">{[102,298].flatMap(x=>[70,137].map(y=><circle key={`${x}-${y}`} cx={x} cy={y} r="4"/>))}</Part><Part name="Seuil / joint de coffre"><path d="M89 151 H311 M118 155 V163 H282 V155"/></Part><Part name="Éclairage / prise"><rect x="87" y="89" width="10" height="18" rx="2"/><circle cx="309" cy="98" r="4"/></Part></>}
  </>}
 </g>;
 // Detailed exterior components follow the existing family outline, preserving its scale.
 return <g className="vehicle-outline vehicle-detail" transform={side&&view==='right'?'translate(400 0) scale(-1 1)':undefined}>
  {side?(bike?<>
   <Part name="Rétroviseur / levier"><path d="M155 27 L171 22 V32 H155 M101 39 H84 M130 59 L143 66" fill={paper}/></Part><Part name="Disque de frein avant"><circle cx="100" cy="143" r="13"/><circle cx="100" cy="143" r="8"/></Part><Part name="Chaîne / courroie"><path d="M192 140 L290 137 V149 L192 151 Z M198 145 H280"/></Part><Part name="Amortisseur"><path d="M249 101 L266 132 M251 105 L261 108 L255 113 L265 116 L259 121 L269 124"/></Part><Part name="Échappement"><path d="M211 155 H277 L311 145 V154 L278 162 H211 Z" fill={paper}/></Part><Part name="Béquille / repose-pied"><path d="M189 143 L176 164 H165 M194 132 H213"/></Part>
  </>:<>
   <Part name={`Rétroviseur ${view==='left'?'gauche':'droit'}`}><path d={truck||bus?'M42 72 L25 68 V91 H36 L42 86 Z':'M126 85 L115 80 Q108 80 107 87 L110 94 H123 Z'} fill={glass}/><path d={truck||bus?'M26 73 V86':'M112 84 L120 86'}/></Part>
   <Part name="Poignées / serrures"><path d={truck?'M85 104 H105 V109 H85 Z':bus?'M272 94 V109 M296 94 V109':'M153 104 H173 V108 H153 Z M243 104 H263 V108 H243 Z'}/><circle cx={truck?109:177} cy="106" r="1.5"/></Part>
   <Part name="Trappe carburant / recharge"><rect x={truck?110:bus?337:318} y={truck?115:bus?104:99} width="13" height="13" rx="2" fill={paper}/></Part>
   <Part name="Bas de caisse / marchepied"><path d={truck?'M35 122 H64 V128 H35 Z':bus?'M264 123 H303 M264 127 H303':'M140 136 H260 M143 139 H258'}/></Part>
   <Part name="Essuie-glace"><path d={truck||bus?'M45 82 L65 57':'M124 88 L145 68'}/></Part>
   <Part name="Pneus / valves">{(truck?[82,281,332]:bus?[83,319]:[bodyType==='pickup'?98:101,bodyType==='pickup'?304:bodyType==='sedan'?298:bodyType==='van'?301:294]).map(x=><g key={x}><circle cx={x} cy="143" r="20" className="vehicle-fine-line"/><path d={`M${x+14} 129 L${x+17} 126 M${x-14} 157 L${x-17} 160`}/></g>)}</Part>
  </>):bike?<>
   <Part name="Verres de rétroviseurs"><path d="M140 45 H152 V51 H140 Z M248 45 H260 V51 H248 Z" fill={glass}/></Part><Part name="Clignotants"><rect x="167" y="91" width="13" height="7" rx="3" fill={glass}/><rect x="220" y="91" width="13" height="7" rx="3" fill={glass}/></Part><Part name="Sculpture du pneu"><path d="M192 133 L208 141 M192 143 L208 151 M192 153 L208 161"/></Part>
  </>:<>
   <Part name={view==='front'?'Rétroviseur droit':'Rétroviseur gauche'}><path d={truck||bus?'M83 71 H92 V88 H83 Z':'M86 85 L99 88 L97 90 L85 88 Z'} fill={glass}/></Part><Part name={view==='front'?'Rétroviseur gauche':'Rétroviseur droit'}><path d={truck||bus?'M308 71 H317 V88 H308 Z':'M301 88 L314 85 L315 88 L303 90 Z'} fill={glass}/></Part>
   <Part name={view==='rear'?'Dégivrage / essuie-glace arrière':'Essuie-glaces'}><path d={truck||bus?'M133 82 L173 66 M225 82 L269 66':view==='rear'?'M146 70 H254 M139 76 H261 M132 82 H268':'M141 82 L181 70 M210 82 L252 70'}/></Part>
   <Part name={view==='rear'?'Feux arrière':'Optiques / clignotants'}><path d="M113 109 H132 M114 113 H135 M268 109 H287 M265 113 H286"/></Part>
   <Part name={view==='rear'?'Capteurs / échappement':'Calandre / antibrouillards'}>{view==='rear'?<><circle cx="132" cy="143" r="2"/><circle cx="268" cy="143" r="2"/><path d="M121 152 V157 H141 V152"/></>:<><path d="M169 114 H231 M172 118 H228 M175 122 H225"/><circle cx="122" cy="137" r="4"/><circle cx="278" cy="137" r="4"/></>}</Part>
  </>}
 </g>;
}
