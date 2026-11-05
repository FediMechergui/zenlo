import type { BodyType } from './inspection';

/** Local, editable suggestions complement vPIC; they are not a homologation or equipment database. */
const SOURCE:Record<string,Partial<Record<BodyType,string>>>={
  'Abarth':{hatchback:'500|595|695|500e'},
  'Acura':{sedan:'ILX|TLX|Integra',suv:'RDX|MDX|ZDX'},
  'Alfa Romeo':{hatchback:'MiTo|Giulietta',sedan:'Giulia|159',suv:'Stelvio|Tonale|Junior',coupe:'4C|Brera'},
  'Alpine':{coupe:'A110',hatchback:'A290',suv:'A390'},
  'Aston Martin':{coupe:'DB11|DB12|Vantage|Vanquish|DBS',suv:'DBX'},
  'Audi':{hatchback:'A1|A3',sedan:'A4|A5|A6|A7|A8|e-tron GT',suv:'Q2|Q3|Q4 e-tron|Q5|Q6 e-tron|Q7|Q8|Q8 e-tron',coupe:'TT|R8'},
  'BAIC':{sedan:'U5 Plus',suv:'X35|X55|X7|BJ40|BJ60'},
  'Bentley':{sedan:'Flying Spur',coupe:'Continental GT',suv:'Bentayga'},
  'BMW':{hatchback:'Série 1|i3',sedan:'Série 2|Série 3|Série 4|Série 5|Série 6|Série 7|i4|i5|i7',suv:'X1|X2|X3|X4|X5|X6|X7|iX|iX1|iX2|iX3|XM',convertible:'Z3|Z4'},
  'BYD':{hatchback:'Dolphin|Dolphin Surf|Seagull',sedan:'Seal|Han|King',suv:'Atto 2|Atto 3|Seal U|Sealion 7|Tang',pickup:'Shark'},
  'Cadillac':{sedan:'CT4|CT5',suv:'Escalade|XT4|XT5|XT6|Lyriq|Optiq'},
  'Changan':{sedan:'Alsvin|Eado',suv:'CS15|CS35 Plus|CS55 Plus|CS75 Plus|UNI-T|UNI-K'},
  'Chery':{sedan:'Arrizo 5|Arrizo 6|Arrizo 8',suv:'Tiggo 2|Tiggo 3|Tiggo 4|Tiggo 4 Pro|Tiggo 7|Tiggo 7 Pro|Tiggo 8|Tiggo 8 Pro|Tiggo 9'},
  'Chevrolet':{hatchback:'Spark|Aveo|Sonic',sedan:'Cruze|Malibu|Impala',suv:'Trax|Tracker|Captiva|Equinox|Blazer|Traverse|Tahoe|Suburban',pickup:'Colorado|Silverado',coupe:'Camaro|Corvette'},
  'Citroën':{hatchback:'C1|C2|C3|C4',sedan:'C-Elysée|C4 X|C5|C5 X',suv:'C3 Aircross|C5 Aircross',van:'Berlingo|Jumpy|Jumper|SpaceTourer|C4 Picasso|Grand C4 Picasso'},
  'Cupra':{hatchback:'Leon|Born',suv:'Formentor|Ateca|Terramar|Tavascan'},
  'Dacia':{hatchback:'Sandero|Sandero Stepway|Spring',sedan:'Logan',suv:'Duster|Bigster',van:'Dokker|Lodgy|Jogger'},
  'Daewoo':{hatchback:'Matiz|Lanos',sedan:'Nubira|Lacetti|Leganza'},
  'Daihatsu':{hatchback:'Sirion|Cuore|Charade|Ayla',suv:'Terios|Rocky',van:'Gran Max|Luxio'},
  'DFSK':{suv:'500|580|Glory 500|Glory 580|Fengon 5|Fengon 7',van:'C35|C36|K05S',pickup:'K01S|C31'},
  'Dodge':{sedan:'Charger|Avenger',coupe:'Challenger',suv:'Durango|Journey|Hornet'},
  'Dongfeng':{sedan:'Shine|Aeolus S50',suv:'AX7|T5 Evo|Mage|Huge',pickup:'Rich 6|Rich 7'},
  'DS':{hatchback:'DS 3|DS 4',sedan:'DS 9',suv:'DS 3 Crossback|DS 7|DS 7 Crossback|N°8'},
  'Ferrari':{coupe:'Roma|296 GTB|SF90 Stradale|812 Superfast|12Cilindri',convertible:'Portofino|296 GTS|F8 Spider',suv:'Purosangue'},
  'Fiat':{hatchback:'500|500e|Panda|Grande Panda|Punto|Grande Punto|Tipo',sedan:'Linea|Albea',suv:'500X|600',van:'500L|Doblò|Fiorino|Scudo|Ducato|Talento',pickup:'Fullback'},
  'Ford':{hatchback:'Fiesta|Focus|Ka|Figo',sedan:'Mondeo|Fusion|Taurus',suv:'Puma|Kuga|EcoSport|Edge|Explorer|Escape|Expedition|Bronco|Mustang Mach-E',van:'Transit|Transit Custom|Tourneo|Tourneo Connect|S-Max|Galaxy',pickup:'Ranger|F-150|Maverick',coupe:'Mustang'},
  'Foton':{pickup:'Tunland|Tunland G7',van:'View|Toano'},
  'GAC':{sedan:'GA4|GA6|Empow',suv:'GS3|GS4|GS5|GS8|Emkoo',van:'M8'},
  'Geely':{hatchback:'LC|GC2',sedan:'GC6|Emgrand|Preface',suv:'GX3 Pro|Coolray|Atlas|Starray|Monjaro|Okavango|EX5'},
  'Genesis':{sedan:'G70|G80|G90',suv:'GV60|GV70|GV80'},
  'GMC':{suv:'Terrain|Acadia|Yukon|Hummer EV',pickup:'Canyon|Sierra'},
  'Great Wall':{pickup:'Wingle 5|Wingle 6|Wingle 7|Poer',suv:'Hover'},
  'Haval':{suv:'H1|H2|H6|H9|Jolion|Dargo'},
  'Honda':{hatchback:'Jazz|Fit|Civic|e',sedan:'City|Accord',suv:'HR-V|CR-V|ZR-V|Pilot|Passport|e:Ny1',van:'Odyssey',pickup:'Ridgeline'},
  'Hyundai':{hatchback:'i10|Grand i10|i20|i30|Getz|Atos|Accent',sedan:'Elantra|Sonata|Azera|Ioniq 6',suv:'Venue|Bayon|Kona|Creta|Tucson|Santa Fe|Palisade|Ioniq 5|Ioniq 9',van:'H-1|Staria',pickup:'H100|Santa Cruz'},
  'Infiniti':{sedan:'Q50|Q70',coupe:'Q60',suv:'QX30|QX50|QX55|QX60|QX80'},
  'Isuzu':{pickup:'D-Max',suv:'MU-X',van:'N-Series'},
  'Iveco':{van:'Daily'},
  'JAC':{hatchback:'J2|JS2',sedan:'J4|J7',suv:'S2|S3|S4|JS3|JS4|JS6',pickup:'T6|T8|T9'},
  'Jaguar':{sedan:'XE|XF|XJ',suv:'E-Pace|F-Pace|I-Pace',coupe:'F-Type'},
  'Jeep':{suv:'Avenger|Renegade|Compass|Cherokee|Grand Cherokee|Wrangler|Wagoneer',pickup:'Gladiator'},
  'Jetour':{suv:'X50|X70|X70 Plus|X90|Dashing|T2'},
  'KGM':{suv:'Tivoli|Korando|Torres|Rexton',pickup:'Musso'},
  'Kia':{hatchback:'Picanto|Rio|Ceed|ProCeed',sedan:'Cerato|K3|K4|K5|Optima|Stinger',suv:'Stonic|Seltos|Sonet|Niro|Sportage|Sorento|Telluride|EV3|EV5|EV6|EV9',van:'Carens|Carnival',pickup:'K2500|Tasman'},
  'Lifan':{hatchback:'320|330',sedan:'520|620|630',suv:'X50|X60|X70'},
  'Lada':{sedan:'Granta|Vesta',suv:'Niva|Niva Travel',hatchback:'Kalina'},
  'Lamborghini':{coupe:'Gallardo|Huracán|Aventador|Revuelto|Temerario',suv:'Urus'},
  'Lancia':{hatchback:'Ypsilon|Delta',sedan:'Thema'},
  'Land Rover':{suv:'Defender|Discovery|Discovery Sport|Range Rover|Range Rover Sport|Range Rover Evoque|Range Rover Velar|Freelander'},
  'Leapmotor':{hatchback:'T03',suv:'B10|C10|C16'},
  'Lexus':{hatchback:'CT',sedan:'IS|ES|GS|LS',suv:'LBX|UX|NX|RX|RZ|GX|LX|TX',coupe:'RC|LC',van:'LM'},
  'Lincoln':{sedan:'Continental|MKZ',suv:'Corsair|Nautilus|Aviator|Navigator'},
  'Lotus':{coupe:'Elise|Exige|Evora|Emira',suv:'Eletre',sedan:'Emeya'},
  'Maserati':{sedan:'Ghibli|Quattroporte',suv:'Grecale|Levante',coupe:'GranTurismo|MC20',convertible:'GranCabrio'},
  'Maxus':{van:'Deliver 3|Deliver 7|Deliver 9|G10|G20|Mifa 9',pickup:'T60|T90'},
  'Mazda':{hatchback:'2|3',sedan:'6',suv:'CX-3|CX-30|CX-5|CX-50|CX-60|CX-70|CX-80|CX-90|MX-30',convertible:'MX-5',pickup:'BT-50'},
  'Mercedes-Benz':{hatchback:'Classe A|Classe B',sedan:'Classe C|Classe E|Classe S|CLA|CLS|EQE|EQS',suv:'GLA|GLB|GLC|GLE|GLS|Classe G|EQA|EQB|EQC|EQE SUV|EQS SUV',van:'Classe V|Vito|Citan|Sprinter|EQV',coupe:'AMG GT',convertible:'SL|SLC'},
  'MG':{hatchback:'MG3|MG4|MG6',sedan:'MG5|MG7',suv:'ZS|HS|RX5|Marvel R|S5 EV',convertible:'Cyberster'},
  'MINI':{hatchback:'Cooper|Cooper SE|One',suv:'Countryman|Aceman',van:'Clubman',convertible:'Cabrio'},
  'Mahindra':{suv:'XUV300|XUV500|XUV700|Scorpio|Thar',pickup:'Scorpio Pik Up|Bolero'},
  'Mitsubishi':{hatchback:'Space Star|Mirage|Colt',sedan:'Lancer|Attrage',suv:'ASX|Eclipse Cross|Outlander|Pajero|Pajero Sport',pickup:'L200|Triton',van:'Xpander'},
  'Nissan':{hatchback:'Micra|Note|Tiida|Leaf',sedan:'Almera|Sunny|Sentra|Altima|Maxima',suv:'Juke|Qashqai|X-Trail|Kicks|Pathfinder|Patrol|Ariya',pickup:'Navara|NP300|Frontier',van:'NV200|Townstar|Primastar|Interstar',coupe:'370Z|Z|GT-R'},
  'Omoda':{suv:'5|E5|7|9'},
  'Opel':{hatchback:'Corsa|Astra|Adam|Karl',sedan:'Insignia|Vectra',suv:'Mokka|Crossland|Grandland|Frontera',van:'Combo|Vivaro|Movano|Zafira'},
  'Peugeot':{hatchback:'107|108|206|207|208|307|308',sedan:'301|408|508',suv:'2008|3008|5008',van:'Partner|Rifter|Expert|Traveller|Boxer',pickup:'Landtrek',coupe:'RCZ'},
  'Polestar':{sedan:'2|5',suv:'3|4',coupe:'1'},
  'Porsche':{coupe:'911|718 Cayman',convertible:'718 Boxster',sedan:'Panamera|Taycan',suv:'Macan|Cayenne'},
  'Proton':{hatchback:'Iriz',sedan:'Saga|Persona|S70',suv:'X50|X70|X90'},
  'RAM':{pickup:'1500|2500|3500',van:'ProMaster'},
  'Rolls-Royce':{sedan:'Ghost|Phantom',coupe:'Wraith|Spectre',convertible:'Dawn',suv:'Cullinan'},
  'Renault':{hatchback:'Twingo|Clio|Clio IV|Clio V|Mégane|Zoe|5 E-Tech',sedan:'Symbol|Fluence|Talisman|Logan',suv:'Captur|Kadjar|Koleos|Austral|Arkana|Rafale|Symbioz|4 E-Tech',van:'Kangoo|Express|Trafic|Master|Scénic|Espace'},
  'SEAT':{hatchback:'Ibiza|Leon|Mii',sedan:'Toledo',suv:'Arona|Ateca|Tarraco',van:'Alhambra'},
  'Škoda':{hatchback:'Fabia|Scala|Citigo',sedan:'Octavia|Superb|Rapid',suv:'Kamiq|Karoq|Kodiaq|Enyaq|Elroq'},
  'Smart':{hatchback:'Fortwo|Forfour',suv:'#1|#3|#5'},
  'SsangYong':{suv:'Tivoli|Korando|Rexton|Torres',pickup:'Musso',van:'Rodius'},
  'Subaru':{hatchback:'Impreza',sedan:'Legacy|WRX',suv:'Crosstrek|XV|Forester|Outback|Ascent|Solterra',coupe:'BRZ'},
  'Suzuki':{hatchback:'Alto|Celerio|Swift|Baleno|Ignis|S-Presso',sedan:'Ciaz|Dzire',suv:'Vitara|S-Cross|Jimny|Grand Vitara|Fronx|Across',van:'Ertiga|Carry'},
  'Tata':{hatchback:'Tiago|Altroz',sedan:'Tigor',suv:'Punch|Nexon|Harrier|Safari'},
  'Tesla':{sedan:'Model 3|Model S',suv:'Model Y|Model X',pickup:'Cybertruck'},
  'Toyota':{hatchback:'Aygo|Aygo X|Yaris|Corolla|Auris',sedan:'Corolla Sedan|Camry|Avensis|Prius|Crown',suv:'Yaris Cross|Corolla Cross|C-HR|RAV4|Highlander|Land Cruiser|Land Cruiser Prado|Fortuner|bZ4X',pickup:'Hilux|Tacoma|Tundra',van:'Proace|Proace City|Hiace|Sienna|Alphard',coupe:'GR86|GR Supra'},
  'Volkswagen':{hatchback:'up!|Polo|Golf|ID.3',sedan:'Virtus|Jetta|Passat|Arteon|ID.7',suv:'T-Cross|Taigo|T-Roc|Tiguan|Touareg|ID.4|ID.5|ID.6|Teramont',van:'Caddy|Touran|Sharan|Multivan|Transporter|Crafter|ID. Buzz',pickup:'Amarok'},
  'Volvo':{hatchback:'C30|V40',sedan:'S40|S60|S80|S90|V60|V90|ES90',suv:'XC40|XC60|XC90|EX30|EX40|EX90|EC40'},
  'Wuling':{hatchback:'Hongguang Mini EV|Bingo',suv:'Almaz|Air EV',van:'Confero'},
  'XPeng':{sedan:'P5|P7|P7i',suv:'G3|G6|G9',van:'X9'},
  'Zeekr':{hatchback:'001',sedan:'007',suv:'X|7X',van:'009'},
};
// Suggestions for mixed fleets. A model name does not establish registration or rental eligibility.
const MIXED:Record<string,Partial<Record<BodyType,string>>>={
  'Yamaha':{motorcycle:'MT-07|MT-09|Tracer 7|Ténéré 700',scooter:'NMAX|XMAX|TMAX',quad:'Grizzly|Kodiak'},
  'Honda':{motorcycle:'CB500F|CB650R|Africa Twin|Gold Wing',scooter:'PCX|Forza|SH125i'},
  'Suzuki':{motorcycle:'V-Strom 650|V-Strom 800|GSX-S750',scooter:'Burgman'},
  'BMW':{motorcycle:'G 310 GS|F 750 GS|R 1250 GS|R 1300 GS',scooter:'C 400 GT|CE 04'},
  'Kawasaki':{motorcycle:'Z650|Z900|Versys 650|Ninja 400'},
  'KTM':{motorcycle:'125 Duke|390 Duke|390 Adventure|790 Adventure'},
  'Ducati':{motorcycle:'Monster|Multistrada|Scrambler'},
  'Triumph':{motorcycle:'Tiger 900|Trident 660|Bonneville'},
  'Royal Enfield':{motorcycle:'Classic 350|Himalayan|Interceptor 650'},
  'Piaggio':{scooter:'Liberty|Beverly|MP3'},'Vespa':{scooter:'Primavera|Sprint|GTS'},
  'SYM':{scooter:'Symphony|Jet 14|Cruisym|Joymax'},'Kymco':{scooter:'Agility|Downtown|X-Town'},
  'CFMOTO':{motorcycle:'450MT|650MT',quad:'CFORCE 450|CFORCE 520|CFORCE 625'},
  'Polaris':{quad:'Sportsman 570|Sportsman 850'},'Can-Am':{quad:'Outlander|Renegade'},
  'Iveco':{truck:'Daily Fourgon|Eurocargo',flatbed:'Daily Plateau',tipper:'Daily Benne|Trakker',minibus:'Daily Minibus',bus:'Crossway'},
  'Isuzu':{truck:'N-Series|F-Series',flatbed:'N-Series Plateau',tipper:'N-Series Benne'},
  'Mercedes-Benz':{truck:'Atego|Actros',tipper:'Arocs',minibus:'Sprinter Minibus',bus:'Tourismo|Citaro'},
  'MAN':{truck:'TGL|TGM|TGX',tipper:'TGS',minibus:'TGE Minibus',bus:'Lion’s Coach|Lion’s City'},
  'Scania':{truck:'P-Series|R-Series|S-Series',bus:'Touring'},
  'Volvo':{truck:'FL|FE|FH',tipper:'FMX',bus:'9700|9900'},
  'Renault Trucks':{truck:'D|D Wide|T',tipper:'C|K'},'DAF':{truck:'LF|XD|XF'},
  'Hino':{truck:'300|500|700'},'Fuso':{truck:'Canter|Fighter'},
  'Hyundai':{truck:'HD35|HD65|HD78',minibus:'County'},
  'Toyota':{minibus:'Coaster|Hiace Minibus'},'Ford':{minibus:'Transit Minibus',truck:'Transit Châssis'},
  'Foton':{truck:'Aumark|Ollin',minibus:'View Minibus'},'Yutong':{bus:'ZK6122|C12'},
};
for(const [make,types] of Object.entries(MIXED)){const existing=SOURCE[make]||{};for(const [body,models] of Object.entries(types)){const key=body as BodyType;existing[key]=[existing[key],models].filter(Boolean).join('|');}SOURCE[make]=existing;}
export const CATALOG_SOURCE_URL='https://vpic.nhtsa.dot.gov/api/';
export const CATALOG_REVIEWED_AT='2026-11-05';
export interface CatalogModel {name:string;bodyType:BodyType;source:'local'|'vpic';}
export const normalizeCatalogName=(value:string)=>value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]/gi,'').toLowerCase();
export const LOCAL_MAKES=Object.keys(SOURCE).sort((a,b)=>a.localeCompare(b,'fr'));
export function catalogModels(make:string):CatalogModel[]{
  const key=LOCAL_MAKES.find(m=>normalizeCatalogName(m)===normalizeCatalogName(make));
  return Object.entries(key?SOURCE[key]:{}).flatMap(([bodyType,models])=>(models as string).split('|').map(name=>({name,bodyType:bodyType as BodyType,source:'local' as const}))).sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true}));
}
export function inferBodyType(make:string,model:string,category=''):BodyType {
  const exact=catalogModels(make).find(m=>normalizeCatalogName(m.name)===normalizeCatalogName(model));if(exact)return exact.bodyType;
  const text=`${model} ${category}`.toLowerCase();
  if(/scooter|cyclomoteur/.test(text))return 'scooter';
  if(/moto|motorcycle/.test(text))return 'motorcycle';
  if(/quad|atv/.test(text))return 'quad';
  if(/minibus/.test(text))return 'minibus';
  if(/autobus|autocar|coach/.test(text))return 'bus';
  if(/benne|tipper/.test(text))return 'tipper';
  if(/plateau|flatbed/.test(text))return 'flatbed';
  if(/camion|truck|poids lourd/.test(text))return 'truck';
  if(/pick.?up|pickup|hilux|navara|ranger|d.max|l200|amarok|tunland|wingle|musso/.test(text))return 'pickup';
  if(/cabrio|roadster|convertible|spider|boxster|mx-5/.test(text))return 'convertible';
  if(/utilitaire|fourgon|van|monospace|transit|sprinter|ducato|partner|berlingo|kangoo|trafic|master|hiace|dobl|jumper|jumpy/.test(text))return 'van';
  if(/suv|crossover|4x4|sportage|tucson|duster|tiggo|qashqai|rav4|touareg|tiguan/.test(text))return 'suv';
  if(/coup[eé]|mustang|camaro|corvette/.test(text))return 'coupe';
  if(/berline|sedan|saloon|octavia|camry|passat|symbol|logan|fluenc|corolla/.test(text))return 'sedan';
  return 'hatchback';
}
export function mergeMakes(remote:readonly string[]){
  const names=new Map(LOCAL_MAKES.map(name=>[normalizeCatalogName(name),name]));
  for(const raw of remote){const name=raw.trim();if(name&&name.length<=100&&!names.has(normalizeCatalogName(name)))names.set(normalizeCatalogName(name),name);}
  return [...names.values()].sort((a,b)=>a.localeCompare(b,'fr'));
}
export function mergeModels(make:string,remote:readonly string[]):CatalogModel[]{
  const models=new Map(catalogModels(make).map(model=>[normalizeCatalogName(model.name),model]));
  for(const raw of remote){const name=raw.trim();if(name&&name.length<=120&&!models.has(normalizeCatalogName(name)))models.set(normalizeCatalogName(name),{name,bodyType:inferBodyType(make,name),source:'vpic'});}
  return [...models.values()].sort((a,b)=>a.name.localeCompare(b.name,'fr',{numeric:true}));
}
