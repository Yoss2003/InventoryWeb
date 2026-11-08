import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';

@Component({
  selector:'app-main-layout', standalone:true,
  imports:[CommonModule,RouterModule,MatSidenavModule,MatToolbarModule,MatListModule,MatIconModule,MatButtonModule],
  templateUrl:'./main-layout.html',styleUrl:'./main-layout.scss'
})
export class MainLayoutComponent {
  private readonly authService=inject(AuthService);
  private readonly platform=inject(PLATFORM_ID);
  get isDeveloper(): boolean { if(!isPlatformBrowser(this.platform))return false;try{return Number(JSON.parse(localStorage.getItem('userSession')||'{}').roleId)===1;}catch{return false;} }
  private readonly router=inject(Router);
  private readonly destroyRef=inject(DestroyRef);
  readonly isSidebarOpen=signal(false);
  readonly currentTitle=signal(this.resolveTitle(this.router.url));
  constructor(){
    this.router.events.pipe(filter((event):event is NavigationEnd=>event instanceof NavigationEnd),takeUntilDestroyed(this.destroyRef))
      .subscribe(event=>this.currentTitle.set(this.resolveTitle(event.urlAfterRedirects)));
  }
  private resolveTitle(url:string):string {
    const segment=url.split('?')[0].split('/').filter(Boolean).pop() ?? '';
    const titles:Record<string,string>={articulos:'Maestro de artículos',categorias:'Categorías',entradas:'Entradas de stock',salidas:'Salidas y ventas',asignaciones:'Artículos asignados','compartir-inventario':'Compartir inventario','gestion-dev':'Gestión Dev','consultas':'Consultas SUNAT y cambio'};
    return titles[segment] ?? 'Panel de gestión';
  }
  toggleSidebar():void {this.isSidebarOpen.update(open=>!open);}
  logout():void {this.authService.logout();void this.router.navigate(['/login']);}
}
