// WebInventory - pulido visual y custodia, instalador v3 tolerante a CRLF y diferencias de formato.
// Instalación autocontenida y aditiva. No crea respaldos, no modifica Git ni ejecuta Actions.
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const checkOnly = process.argv.includes('--check');
if (!fs.existsSync(path.join(root, 'angular.json'))) {
  throw new Error('Ejecuta desde la carpeta WebInventory que contiene angular.json.');
}
const plans = [];
const staged = new Map();
const marker = (id) => `/* ${id} */`;
function patch(file, fn) {
  const abs = path.join(root, file);
  if (!fs.existsSync(abs)) throw new Error(`No encuentro ${file}. No se modificó nada.`);
  const existing = staged.get(file);
  const original = existing ? existing.original : fs.readFileSync(abs, 'utf8');
  const current = existing ? existing.changed : original;
  // Analizar siempre con LF: Windows usa CRLF y los anclajes multilínea de la
  // versión anterior fallaban aun cuando el código era exactamente el mismo.
  const lineEnding = current.includes('\r\n') ? '\r\n' : '\n';
  const canonical = current.replace(/\r\n?/g, '\n');
  const updated = fn(canonical, file);
  if (typeof updated !== 'string') throw new Error(`Corrección inválida: ${file}`);
  const changed = lineEnding === '\r\n' ? updated.replace(/\r?\n/g, '\r\n') : updated;
  if (existing) existing.changed = changed;
  else { const item = {file, abs, original, changed}; staged.set(file, item); plans.push(item); }
}
function addFile(file, contents) {
  const abs = path.join(root,file);
  const original=fs.existsSync(abs)?fs.readFileSync(abs,'utf8'):'';
  if(original && original!==contents && !original.includes('cleanArticleDisplayName')) {
    throw new Error(`Hay otro archivo con el nombre ${file}. No se escribió nada.`);
  }
  const changed=original||contents;
  plans.push({file,abs,original,changed});
}
function installPipe(componentPath) {
  const rel = componentPath.includes('/movements/') ? '../../../shared/clean-article-name.pipe' : '../../shared/clean-article-name.pipe';
  patch(componentPath,(s,f)=>{
    if(s.includes('CleanArticleNamePipe')) return s;
    const m=s.match(/imports\s*:\s*\[([^\]]+)\]/);
    if(!m)throw new Error(`${f}: no encontré las importaciones del componente`);
    s=s.replace(m[0],m[0].replace('[','[CleanArticleNamePipe, '));
    return `import { CleanArticleNamePipe } from '${rel}';\n`+s;
  });
}
function replaceOnce(source, from, to, file) {
  if (source.includes(to)) return source;
  const pos = source.indexOf(from);
  if (pos !== -1) return source.slice(0,pos)+to+source.slice(pos+from.length);
  // Alternativa cuando Prettier, VS Code u otro editor cambió sangrías/saltos:
  // conserva el contenido y solo permite diferencias en espacios en blanco.
  const escapeRegex = text => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = from.trim().split(/\s+/).map(escapeRegex).join('\\s+');
  const match = new RegExp(pattern, 'm').exec(source);
  if (match) return source.slice(0, match.index) + to + source.slice(match.index + match[0].length);
  throw new Error(`${file}: el código es diferente al esperado cerca de: ${from.trim().slice(0,90)}. No se modificó ningún archivo.`);
}
function appendOnce(source,id,styles) {
  if (source.includes(marker(id))) return source;
  return source.trimEnd() + '\n\n' + marker(id) + '\n' + styles.trim() + '\n';
}

// 1) Custodias: cargar evidencia aunque un registro histórico no marque hasEvidence.
//    Forzar la detección de cambios y mostrar cuando el archivo ya no existe.
patch('src/app/features/assignment-history-dialog/assignment-history-dialog.ts', (s,f)=> {
  if (s.includes('UX_FINAL_EVIDENCIA_CUSTODIA')) return s;
  if (!s.includes('ChangeDetectorRef')) {
    s=replaceOnce(s,'Component, OnDestroy, OnInit, ViewEncapsulation, inject','ChangeDetectorRef, Component, OnDestroy, OnInit, ViewEncapsulation, inject',f);
  }
  if (!/\b(?:private\s+)?readonly\s+cdr\s*=\s*inject\(ChangeDetectorRef\)/.test(s)) {
    const m = s.match(/^\s*private readonly serialsApi = inject\(SerialUnitsService\);/m);
    if (!m) throw new Error(`${f}: no encontré serialsApi`);
    s=s.replace(m[0],m[0]+'\n  private readonly cdr = inject(ChangeDetectorRef);');
  }
  if (!s.includes('evidenceStatus =')) {
    s=replaceOnce(s,'evidenceUrl: string | null = null;',"evidenceUrl: string | null = null;\n  evidenceStatus = '';",f);
  }
  // La forma anterior suponía una secuencia exacta de líneas y saltos LF;
  // falla con CRLF o cuando v2 añadió otras declaraciones entre métodos.
  // Ahora aislamos únicamente la llamada subscribe() equilibrando paréntesis.
  const callToken = 'this.api.getEvidence(this.data.id).subscribe(';
  const call = s.indexOf(callToken);
  if (call < 0) throw new Error(`${f}: no encontré la consulta de evidencia; no se modificó nada.`);
  const lineStart = s.lastIndexOf('\n', call) + 1;
  const beforeCall = s.slice(lineStart, call).trim();
  if (beforeCall && !/^if\s*\(\s*this\.data\.hasEvidence\s*\)$/.test(beforeCall))
    throw new Error(`${f}: la consulta de evidencia tiene una condición distinta; no se modificó nada.`);
  const open = call + callToken.length - 1;
  let depth = 0;
  let quote = '';
  let escaped = false;
  let close = -1;
  for (let i = open; i < s.length; i++) {
    const ch = s[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === quote) quote = '';
      continue;
    }
    if (ch === "'" || ch === '"' || ch === '`') { quote = ch; continue; }
    if (ch === '(') depth++;
    else if (ch === ')') {
      if (--depth === 0) { close = i; break; }
    }
  }
  if (close < 0) throw new Error(`${f}: no se pudo interpretar el subscribe de evidencia; no se modificó nada.`);
  const lineEnd = s[close + 1] === ';' ? close + 2 : close + 1;
  const eol = s.includes('\r\n') ? '\r\n' : '\n';
  const replacement=[
    '    // UX_FINAL_EVIDENCIA_CUSTODIA: consultar incluso custodias históricas.',
    '    this.api.getEvidence(this.data.id).subscribe({',
    '      next: file => {',
    '        if (this.evidenceUrl) URL.revokeObjectURL(this.evidenceUrl);',
    '        this.evidenceUrl = URL.createObjectURL(file);',
    "        this.evidenceStatus = '';",
    '        this.cdr.markForCheck();',
    '      },',
    '      error: err => {',
    '        this.evidenceStatus = err?.status === 404',
    "          ? 'No se encontró una fotografía guardada para esta custodia.'",
    "          : 'No se pudo cargar la fotografía de esta custodia.';",
    '        this.cdr.markForCheck();',
    '      }',
    '    });'
  ].join(eol);
  return s.slice(0,lineStart)+replacement+s.slice(lineEnd);

});
patch('src/app/features/assignment-history-dialog/assignment-history-dialog.html',(s,f)=> {
  if (s.includes('class="evidence-status"')) return s;
  const target='<img *ngIf="evidenceUrl"';
  if (!s.includes(target)) throw new Error(`${f}: no encontré la imagen de evidencia`);
  const end=s.indexOf(' />',s.indexOf(target));
  if(end<0)throw new Error(`${f}: formato inesperado de imagen`);
  return s.slice(0,end+3)+'\n      <p *ngIf="evidenceStatus" class="evidence-status" role="status">{{evidenceStatus}}</p>'+s.slice(end+3);
});
patch('src/app/features/assignment-history-dialog/assignment-history-dialog.scss',(s)=>appendOnce(s,'UX_FINAL_CUSTODIA_EVIDENCIA',`
.assignment-dialog .evidence-status {font-size:12px;color:#aebfd0;background:#172734;border:1px dashed #42576a;padding:10px 12px;border-radius:8px;margin-top:10px}
`));

// 2) Etapa 2 de categorías: campos en dos columnas coherentes, sin columna desocupada
//    cuando sólo está visible la fórmula personalizada.
patch('src/app/features/categories/category-child-form/category-child-form.scss',(s)=>appendOnce(s,'UX_FINAL_REGLAS_CATEGORIA',`
@media (min-width: 761px) {
  .category-stepper .rules-grid {grid-template-columns:repeat(2,minmax(0,1fr)) !important; gap:14px 16px;align-items:stretch;}
  .category-stepper .rules-grid>.category-field,.category-stepper .rules-grid>.toggle-tile{min-width:0;align-self:stretch;}
  .category-stepper .rules-grid .toggle-tile{min-height:66px;padding:12px 14px;}
  .category-stepper .naming-config{grid-column:1/-1;display:grid;grid-template-columns:repeat(2,minmax(0,1fr)) !important;gap:14px 16px;align-items:stretch;}
  .category-stepper .naming-config:has(>.naming-toggle:only-child){grid-template-columns:minmax(0,1fr) !important;}
  .category-stepper .naming-config>.naming-toggle{height:auto;min-height:66px;}
  .category-stepper .rules-grid .toggle-tile small{white-space:normal;}
}
@media (max-width:760px){.category-stepper .rules-grid,.category-stepper .naming-config{grid-template-columns:minmax(0,1fr) !important;}}
`));

// 3) Tipo de cambio: nueva presentación compacta, sin alterar el cálculo o las fuentes.
patch('src/app/features/external-consultas/external-consultas.html',(s,f)=> {
  if(s.includes('class="fx-dashboard"')) return s;
  const needle='<section><h2>Tipo de cambio referencial</h2>';
  const start=s.indexOf(needle);
  if(start<0)throw new Error(`${f}: no encuentro la sección de tipo de cambio`);
  const end=s.indexOf('</section>', start);
  if(end<0)throw new Error(`${f}: no localicé cierre de tipo de cambio`);
  const replacement=`<section class="fx-dashboard" aria-labelledby="fx-heading">
  <div class="fx-heading"><div><h2 id="fx-heading">Tipo de cambio referencial</h2><p>Comparación de compra y venta frente al sol peruano</p></div>
    <button type="button" class="fx-refresh" (click)="loadRates()" [disabled]="loadingRates"><app-loading-indicator *ngIf="loadingRates; else fxLabel" [compact]="true" message="Consultando..."/><ng-template #fxLabel>Actualizar cotizaciones</ng-template></button>
  </div>
  <div class="fx-grid" *ngIf="usd || eur; else fxEmpty">
    <article class="fx-card" *ngIf="usd">
      <header class="fx-card-heading"><div class="fx-symbol">US$</div><div class="fx-title"><strong>Dólar estadounidense</strong><small>USD / PEN</small></div></header>
      <span class="fx-status" [class.fx-historical]="usdStatus !== 'Actual según fecha de API'">{{usdStatus}}</span>
      <div class="fx-prices"><div><span>Compra</span><strong>S/ {{usd.buyPrice | number:'1.3-3'}}</strong></div><div><span>Venta</span><strong>S/ {{usd.sellPrice | number:'1.3-3'}}</strong></div></div>
      <footer class="fx-date">Fecha informada: {{usd.date.slice(0,10) | date:'dd/MM/yyyy':'UTC'}}</footer>
    </article>
    <article class="fx-card" *ngIf="eur">
      <header class="fx-card-heading"><div class="fx-symbol fx-euro">€</div><div class="fx-title"><strong>Euro</strong><small>EUR / PEN</small></div></header>
      <span class="fx-status" [class.fx-historical]="eurStatus !== 'Actual según fecha de API'">{{eurStatus}}</span>
      <div class="fx-prices"><div><span>Compra</span><strong>S/ {{eur.buyPrice | number:'1.3-3'}}</strong></div><div><span>Venta</span><strong>S/ {{eur.sellPrice | number:'1.3-3'}}</strong></div></div>
      <footer class="fx-date">Fecha informada: {{eur.date.slice(0,10) | date:'dd/MM/yyyy':'UTC'}}</footer>
    </article>
  </div>
  <ng-template #fxEmpty><div class="fx-empty">Utiliza «Actualizar cotizaciones» para consultar los valores disponibles.</div></ng-template>
  <p class="fx-disclaimer">Valores referenciales. La fecha comunicada por la API puede diferir de la fecha original del proveedor.</p>
</section>`;
  return s.slice(0,start)+replacement+s.slice(end+'</section>'.length);
});
patch('src/app/features/external-consultas/external-consultas.scss',(s)=>appendOnce(s,'UX_FINAL_TIPO_CAMBIO',`
.fx-dashboard{padding:21px 24px;background:#15232e;border:1px solid #4a6273;border-radius:14px;}
.fx-heading{display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap;margin-bottom:15px}
.fx-heading h2{font-size:18px;margin:0 0 4px;color:#f1f6fa}
.fx-heading p{font-size:12px;margin:0;color:#adbfcc}
.fx-refresh{background:#83aa2d;border:1px solid #a3cb4a;color:#13200b;padding:11px 16px;border-radius:9px;white-space:nowrap}
.fx-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:15px;align-items:start;}
.fx-card{background:linear-gradient(145deg,#1d303d,#162530);border:1px solid #526879;border-radius:13px;padding:17px;min-width:0;display:grid;gap:14px}
.fx-card-heading{display:flex;align-items:center;gap:12px;border:0;background:transparent;padding:0}
.fx-symbol{display:grid;place-items:center;flex:0 0 47px;width:47px;height:47px;background:#2e432c;border:1px solid #566c43;color:#e5f8c8;font-weight:800;font-size:17px;border-radius:11px}
.fx-symbol.fx-euro{background:#27404a;border-color:#4b7280;color:#c4e9f0;font-size:24px}
.fx-title{min-width:0;display:grid;gap:4px}
.fx-title strong{font-size:14px;color:#f0f6fa}
.fx-title small{font-size:11px;color:#a4bdcf}
.fx-status{justify-self:start;background:#2b432a;border:1px solid #507347;color:#d0f3b6;border-radius:20px;padding:5px 10px;font-size:11px;font-weight:700}
.fx-status.fx-historical{background:#433a29;border-color:#796343;color:#f4d3a0}
.fx-prices{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.fx-prices>div{background:#111f2b;border:1px solid #394f60;padding:12px 13px;border-radius:9px;min-width:0}
.fx-prices span{display:block;font-size:11px;color:#a2b7c7;margin-bottom:7px}
.fx-prices strong{display:block;color:#e9f3fc;font-size:clamp(17px,2vw,24px);font-variant-numeric:tabular-nums;white-space:nowrap}
.fx-date{padding-top:12px;border-top:1px solid #3a5161;color:#aebfca;font-size:11px;background:transparent}
.fx-empty{padding:22px;border:1px dashed #526879;border-radius:10px;color:#afc4d2;font-size:12px}
.fx-disclaimer{font-size:11px;line-height:1.5;margin:14px 0 0;color:#9fb1c0}
@media(max-width:760px){.fx-grid{grid-template-columns:1fr}.fx-dashboard{padding:15px}.fx-heading{align-items:stretch}.fx-refresh{width:100%}.fx-prices strong{font-size:20px}}
`));
// Mensajes de la vista de consultas al toast global (el puente MatSnackBar ya existe en app.config).
patch('src/app/features/external-consultas/external-consultas.ts',(s,f)=>{
  if(s.includes('// UX_FINAL_TOAST_CONSULTAS'))return s;
  s=replaceOnce(s,"import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';", "import { LoadingIndicatorComponent } from '../../shared/loading/loading-indicator';\nimport { ToastService } from '../../shared/toast/toast.service';",f);
  s=replaceOnce(s,'  private readonly cdr=inject(ChangeDetectorRef);','  private readonly cdr=inject(ChangeDetectorRef);\n  private readonly toast=inject(ToastService); // UX_FINAL_TOAST_CONSULTAS',f);
  s=replaceOnce(s,"if(!/^\\d{11}$/.test(this.ruc)){this.error='RUC inválido (11 dígitos).';return;}","if(!/^\\d{11}$/.test(this.ruc)){this.error='RUC inválido (11 dígitos).';this.toast.warning(this.error);return;}",f);
  s=replaceOnce(s,"this.error='No se pudo consultar el RUC. Revisa el token SUNAT en la API.';","this.error='No se pudo consultar el RUC. Verifica el servicio de consulta en la API.';this.toast.error(this.error);",f);
  // Diferencias de sangría, saltos de línea o formato entre editores.
  // Solo notificar el error; no cambiar la consulta ni la tasa.
  if (!/this\.toast\.error\(\s*currency\s*===\s*[\'"]USD[\'"]\s*\?\s*this\.usdError\s*:\s*this\.eurError\s*\)/.test(s)) {
    const rateError = /(if\s*\(\s*currency\s*===\s*[\'"]USD[\'"]\s*\)\s*this\.usdError\s*=\s*[^;]+;\s*else\s+this\.eurError\s*=\s*[^;]+;)/m;
    const match = rateError.exec(s);
    if (!match) throw new Error(`${f}: no encontré la asignación de errores USD/EUR; no se modificó nada.`);
    s = s.slice(0, match.index) + match[0] + "\n        this.toast.error(currency===\'USD\'?this.usdError:this.eurError);" + s.slice(match.index + match[0].length);
  }
  return s;
});
patch('src/app/features/external-consultas/external-consultas.html',(s)=>{
  // Esos errores ya se presentan mediante ToastService, sin duplicados en línea.
  s=s.replace('<p class="error" *ngIf="error" role="alert">{{error}}</p>','');
  return s;
});

// 4) Barra lateral: centra los iconos reales del menú plegado y separa el botón
//    de expansión del borde de la barra.
patch('src/app/core/layout/main-layout/main-layout.scss',(s)=>appendOnce(s,'UX_FINAL_SIDEBAR',`
:host ::ng-deep .sidenav.collapsed .mat-mdc-list-item{width:48px!important;min-width:48px;height:48px!important;margin:5px auto!important;padding:0!important;display:flex!important;align-items:center!important;justify-content:center!important}
:host ::ng-deep .sidenav.collapsed .mat-mdc-list-item .mdc-list-item__start{margin:0!important;display:grid!important;place-items:center!important;flex:0 0 24px!important}
:host ::ng-deep .sidenav.collapsed .mat-mdc-list-item mat-icon[matlistitemicon]{width:24px;height:24px;margin:0!important;text-align:center;flex:none}
:host ::ng-deep .sidenav.collapsed .mat-mdc-list-item .mdc-list-item__content{display:none!important}
.top-toolbar{padding-left:22px!important;gap:17px}
.top-toolbar .menu-trigger{margin-right:4px;border:1px solid #657d8f;background:#20323e;box-shadow:0 0 0 3px #14212b}
.top-toolbar .menu-trigger:hover{border-color:#a8d73d;background:#293d49}
@media(max-width:700px){:host ::ng-deep .sidenav.collapsed .mat-mdc-list-item{width:44px!important;min-width:44px}.top-toolbar{padding-left:14px!important;gap:10px}}
`));

// 5) Select nativos: paleta coherente sin sustituir controles ni alterar el valor.
patch('src/styles.scss',(s)=>appendOnce(s,'UX_FINAL_SELECTS_NATIVOS',`
select:not([multiple]){color-scheme:dark;accent-color:#a8d73d}
select:not([multiple]) option{background:#21313f;color:#eaf3fa}
select:not([multiple]):focus-visible{outline:2px solid #a8d73d;outline-offset:2px}
#active-inventory-select,.master-history .filters select{background-color:#1b2c39;border-color:#687e90;color:#edf5fa;border-radius:9px;cursor:pointer;transition:border-color .15s,box-shadow .15s}
#active-inventory-select:hover,.master-history .filters select:hover{border-color:#94bd57}
#active-inventory-select:focus,.master-history .filters select:focus{box-shadow:0 0 0 2px rgba(168,215,61,.18);outline:none}
`));

// 6) Historial: la columna del tipo debe distinguir custodias de salidas.
patch('src/app/features/master-history/master-history.html',(s,f)=>{
  if(s.includes('value="3">Custodias')) return s;
  s=replaceOnce(s,'<option value="2">Salidas</option>','<option value="2">Salidas</option><option value="3">Custodias</option>',f);
  s=replaceOnce(s,`[class.out]="row.actionId===2">{{row.actionId===1?'Entrada':'Salida'}}`,`[class.out]="row.actionId===2" [class.custody]="row.actionId===3">{{row.actionId===1?'Entrada':row.actionId===2?'Salida':'Custodia'}}`,f);
  return s;
});
patch('src/app/features/master-history/master-history.scss',(s)=>appendOnce(s,'UX_FINAL_CUSTODIAS_HISTORIAL',`
.master-history .type.custody{background:#244b50;border:1px solid #437c7b;color:#c6f0ed}
`));

// 7) Nombres visibles de artículos creados antes de la normalización de fórmulas.
//    Esto NO cambia la cadena guardada en PostgreSQL; sólo elimina operadores +
//    introducidos como concatenadores antes de un token o atributo.
addFile('src/app/shared/clean-article-name.pipe.ts',String.raw`import { Pipe, PipeTransform } from '@angular/core';

/** Oculta signos + usados como operadores en nombres históricos. */
export function cleanArticleDisplayName(value: string | null | undefined): string {
  return String(value ?? '').replace(/(^|\s)\+\s*/g,'$1').replace(/\s{2,}/g,' ').trim();
}

@Pipe({name:'cleanArticleName',standalone:true,pure:true})
export class CleanArticleNamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {return cleanArticleDisplayName(value);}
}
`);
installPipe('src/app/features/assignment-history-dialog/assignment-history-dialog.ts');
patch('src/app/features/assignment-history-dialog/assignment-history-dialog.html',(s)=>s.replaceAll('{{data.articleName}}','{{data.articleName | cleanArticleName}}'));
installPipe('src/app/features/master-history/master-history.ts');
patch('src/app/features/master-history/master-history.html',(s)=>s.replaceAll('{{row.articleName}}','{{row.articleName | cleanArticleName}}'));
installPipe('src/app/features/assignment-history/assignment-history.ts');
patch('src/app/features/assignment-history/assignment-history.html',(s)=>s.replaceAll('{{row.articleName}}','{{row.articleName | cleanArticleName}}'));
installPipe('src/app/features/movements/movement-detail-dialog/movement-detail-dialog.ts');
patch('src/app/features/movements/movement-detail-dialog/movement-detail-dialog.html',(s)=>s.replaceAll('{{data.articleName}}','{{data.articleName | cleanArticleName}}'));
installPipe('src/app/features/movements/traspaso-form/traspaso-form.ts');
patch('src/app/features/movements/traspaso-form/traspaso-form.html',(s)=>s.replaceAll('{{a.name}}','{{a.name | cleanArticleName}}').replaceAll("{{selectedArticle?.name || '—'}}","{{(selectedArticle?.name || '—') | cleanArticleName}}"));
for(const file of ['src/app/features/movements/entradas/entradas.ts','src/app/features/movements/salidas/salidas.ts']){
  patch(file,(s,f)=>{
    if(s.includes('cleanArticleDisplayName')) return s;
    const importPath="../../../shared/clean-article-name.pipe";
    const original=/articleName\(id\s*:\s*number\)\s*:\s*string\s*\{\s*return\s+this\.(articleMap|articles)\.get\(id\)\?\.name\s*(?:\?\?|\|\|)\s*`Artículo #\$\{id\}`;\s*\}/;
    const found=s.match(original);
    if(!found)throw new Error(`${f}: no localicé el formateo del nombre del artículo`);
    s=s.replace(original,`articleName(id:number):string{return cleanArticleDisplayName(this.${found[1]}.get(id)?.name ?? \`Artículo #\${id}\`);}`);
    return `import { cleanArticleDisplayName } from '${importPath}';\n`+s;
  });
}

const modified = plans.filter(x=>x.original!==x.changed);
console.log(`WebInventory: ${modified.length} archivos con cambios; ${plans.length-modified.length} ya actualizados.`);
for(const p of plans)console.log(` ${p.original!==p.changed?'•':'✓'} ${p.file}`);
if(checkOnly){console.log('Verificación completada. No se modificó ningún archivo.');process.exit(0);}
// Garantizar que todos los cambios se calcularon antes de realizar la primera escritura.
for(const p of modified){fs.mkdirSync(path.dirname(p.abs),{recursive:true});fs.writeFileSync(p.abs,p.changed,'utf8');}
console.log('Cambios aplicados. No se generaron respaldos, no se ejecutó Git ni GitHub Actions.');
