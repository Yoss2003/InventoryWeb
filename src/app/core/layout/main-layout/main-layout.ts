import { Component, DestroyRef, PLATFORM_ID, inject, signal } from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { Router, RouterModule, NavigationEnd } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatSelectModule } from '@angular/material/select';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { filter } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { CompanyPublicService } from '../../services/companies';
import { CompanyThemeService } from '../../../shared/ui/v3/company-theme.service';
import { InventoryService, InventorySummary } from '../../services/inventories';
import { InventoryContextService } from '../../services/inventory-context';
import { ToastService } from '../../../shared/toast/toast.service';

interface SidebarGroup {
  id: string;
  title: string;
  icon: string;
  developerOnly?: boolean;
  items: {
    label: string;
    icon: string;
    route: string;
    adminOnly?: boolean;
  }[];
}
@Component({
  selector:'app-main-layout', standalone:true,
  imports:[CommonModule,RouterModule,MatSidenavModule,MatToolbarModule,MatListModule,MatIconModule,MatButtonModule,MatSelectModule],
  templateUrl:'./main-layout.html',styleUrl:'./main-layout.scss'
})
export class MainLayoutComponent {
  private readonly authService=inject(AuthService);
  private readonly publicCompanies=inject(CompanyPublicService);
  private readonly companyTheme=inject(CompanyThemeService);
  private readonly inventoryApi=inject(InventoryService);
  private readonly inventoryContext=inject(InventoryContextService);
  private readonly toast=inject(ToastService);
  inventories: InventorySummary[]=[];
  selectedInventoryId: number | null = null;
  loadingInventories = true;
  private readonly platform=inject(PLATFORM_ID);
  get isDeveloper(): boolean { if(!isPlatformBrowser(this.platform))return false;try{return Number(JSON.parse(localStorage.getItem('userSession')||'{}').roleId)===1;}catch{return false;} }
  get isAdmin(): boolean { if(!isPlatformBrowser(this.platform))return false;try{return [1,2].includes(Number(JSON.parse(localStorage.getItem('userSession')||'{}').roleId));}catch{return false;} }
  private readonly router=inject(Router);
  private readonly destroyRef=inject(DestroyRef);
  readonly isSidebarOpen=signal(false);

  readonly menuGroups: SidebarGroup[] = [
    {
      id: 'catalogos',
      title: 'Catálogos',
      icon: 'layers',
      items: [
        { label: 'Artículos', icon: 'inventory_2', route: '/dashboard/articulos' },
        { label: 'Categorías', icon: 'category', route: '/dashboard/categorias' },
        { label: 'Catálogo general', icon: 'collections_bookmark', route: '/dashboard/catalogo-general' }
      ]
    },
    {
      id: 'movimientos',
      title: 'Movimientos',
      icon: 'swap_horiz',
      items: [
        { label: 'Entradas', icon: 'add_circle', route: '/dashboard/entradas' },
        { label: 'Salidas', icon: 'remove_circle', route: '/dashboard/salidas' },
        { label: 'Asignados', icon: 'assignment_ind', route: '/dashboard/asignaciones' },
        { label: 'Historial general', icon: 'history', route: '/dashboard/historial-general', adminOnly: true }
      ]
    },
    {
      id: 'herramientas',
      title: 'Herramientas',
      icon: 'build',
      items: [
        { label: 'Compartir', icon: 'group_add', route: '/dashboard/compartir-inventario' },
        { label: 'Consultas', icon: 'currency_exchange', route: '/dashboard/consultas' }
      ]
    },
    {
      id: 'administracion',
      title: 'Administración',
      icon: 'admin_panel_settings',
      developerOnly: true,
      items: [
        { label: 'Gestión Dev', icon: 'admin_panel_settings', route: '/dashboard/gestion-dev' }
      ]
    }
  ];

  readonly expandedGroup = signal(this.groupForRoute(this.router.url));
  readonly activeGroup = signal(this.groupForRoute(this.router.url));

  private groupForRoute(url: string): string {
    const path = url.split('?')[0].split('#')[0];
    return this.menuGroups.find(group =>
      group.items.some(item => item.route === path)
    )?.id ?? 'catalogos';
  }

  toggleGroup(id: string): void {
    if (!this.isSidebarOpen()) {
      this.isSidebarOpen.set(true);
      this.expandedGroup.set(id);
      return;
    }

    this.expandedGroup.update(current => current === id ? '' : id);
  }

  readonly currentTitle=signal(this.resolveTitle(this.router.url));
  constructor(){
    this.router.events.pipe(filter((event):event is NavigationEnd=>event instanceof NavigationEnd),takeUntilDestroyed(this.destroyRef))
    .subscribe(event => {
      this.currentTitle.set(this.resolveTitle(event.urlAfterRedirects));

      const group = this.groupForRoute(event.urlAfterRedirects);
      this.activeGroup.set(group);
      this.expandedGroup.set(group);
    });
  }
  ngOnInit():void {
    const session = isPlatformBrowser(this.platform) ? JSON.parse(localStorage.getItem('userSession') || '{}') : {};
    this.companyTheme.reset();
    this.publicCompanies.getActiveCompanies().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: companies => {
        const company = companies.find(c => Number(c.id) === Number(session.companyId));
        this.companyTheme.apply(company?.primaryColorHex);
      },
      error: () => this.companyTheme.reset()
    });
    this.inventoryApi.getInventories().pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: rows => {
        this.inventoryContext.initialize(rows, Number(session.id) || 0);
        this.inventories = this.inventoryContext.options;
        this.selectedInventoryId = this.inventoryContext.activeInventoryId;
        this.loadingInventories = false;
      },
      error: () => {
        this.loadingInventories = false;
        this.toast.error('No se pudieron cargar los inventarios.');
      }
    });
  }
  selectInventoryById(value: number | string | null):void {
    const id = Number(value);
    if (!Number.isInteger(id) || id <= 0) return;
    if (id === this.selectedInventoryId || !this.inventoryContext.select(id)) return;
    // Evita presentar datos en caché del inventario anterior al cambiar de contexto.
    if (isPlatformBrowser(this.platform)) window.location.reload();
  }
  private resolveTitle(url:string):string {
    const segment=url.split('?')[0].split('/').filter(Boolean).pop() ?? '';
    const titles:Record<string,string>={articulos:'Maestro de artículos',categorias:'Categorías',entradas:'Entradas de stock',salidas:'Salidas y ventas',asignaciones:'Artículos asignados','compartir-inventario':'Compartir inventario','gestion-dev':'Gestión Dev','consultas':'Consultas SUNAT y cambio','historial-general':'Historial general','catalogo-general':'Catálogo general'};
    return titles[segment] ?? 'Panel de gestión';
  }
  toggleSidebar():void {this.isSidebarOpen.update(open=>!open);}
  logout():void {this.companyTheme.reset();this.authService.logout();void this.router.navigate(['/login']);}
}
