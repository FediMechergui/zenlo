/** Strict bounded CSV reader for UTF-8, comma or semicolon separated imports. */
export function parseCsv(source:string):Record<string,string>[] {
  const input=source.replace(/^\uFEFF/,'');
  if(input.length>750000)throw new Error('Le fichier dépasse 750 Ko.');
  const first=input.split(/\r?\n/,1)[0]||'';
  const separator=first.includes(';')?';':',';
  const rows:string[][]=[];let row:string[]=[];let field='';let quoted=false;let closed=false;
  for(let i=0;i<input.length;i++){
    const c=input[i];
    if(quoted){if(c==='"'){if(input[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;continue;}
    if(c==='"'){if(field||closed)throw new Error(`Guillemets inattendus à la ligne ${rows.length+1}.`);quoted=true;continue;}
    if(c===separator){row.push(field);field='';closed=false;continue;}
    if(c==='\n'||c==='\r'){if(c==='\r'&&input[i+1]==='\n')i++;row.push(field);if(row.some(x=>x.trim()))rows.push(row);row=[];field='';closed=false;if(rows.length>101)throw new Error('Import limité à 100 lignes.');continue;}
    if(closed&&c.trim())throw new Error(`Séparateur manquant à la ligne ${rows.length+1}.`);
    if(!closed)field+=c;
  }
  if(quoted)throw new Error('Un champ entre guillemets est incomplet.');
  row.push(field);if(row.some(x=>x.trim()))rows.push(row);
  if(rows.length>101)throw new Error('Import limité à 100 lignes.');
  if(rows.length<2)throw new Error('Ajoutez au moins une ligne sous les en-têtes.');
  const columns=rows.shift()!.map(x=>x.trim());
  if(new Set(columns).size!==columns.length||columns.some(x=>!x))throw new Error('Chaque colonne doit avoir un nom unique.');
  if(columns.length>30)throw new Error('Trop de colonnes dans le fichier.');
  return rows.map((r,i)=>{if(r.length!==columns.length)throw new Error(`Ligne ${i+2} : ${r.length} colonnes reçues, ${columns.length} attendues.`);return Object.fromEntries(columns.map((col,j)=>[col,r[j].trim()]));});
}
