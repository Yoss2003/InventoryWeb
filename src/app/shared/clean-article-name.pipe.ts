import { Pipe, PipeTransform } from '@angular/core';

/** Oculta signos + usados como operadores en nombres históricos. */
export function cleanArticleDisplayName(value: string | null | undefined): string {
  return String(value ?? '').replace(/(^|\s)\+\s*/g,'$1').replace(/\s{2,}/g,' ').trim();
}

@Pipe({name:'cleanArticleName',standalone:true,pure:true})
export class CleanArticleNamePipe implements PipeTransform {
  transform(value: string | null | undefined): string {return cleanArticleDisplayName(value);}
}
