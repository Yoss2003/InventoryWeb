import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'forgot-password', loadComponent: () => import('./features/password-recovery/password-recovery').then(m => m.PasswordRecoveryComponent) },
  { path: 'reset-password', loadComponent: () => import('./features/password-recovery/password-recovery').then(m => m.PasswordRecoveryComponent) },
  { path: 'login', loadComponent: () => import('./features/auth/login/login').then(m => m.Login) },
  {
    path: 'dashboard',
    loadComponent: () => import('./core/layout/main-layout/main-layout').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'articulos', pathMatch: 'full' },
      { path: 'gestion-dev', canActivate: [permissionGuard], data: {developerOnly: true},
        loadComponent: () => import('./features/dev-management/dev-management').then(m => m.DevManagementComponent) },
      { path: 'usuarios', canActivate: [permissionGuard], data: {permission: 'MANAGE_USERS'},
        loadComponent: () => import('./features/user-management/user-management').then(m => m.UserManagementComponent) },
      { path: 'inventarios-maestros', canActivate: [permissionGuard], data: {permission: 'VIEW_MASTER_INVENTORY'},
        loadComponent: () => import('./features/master-inventories/master-inventories').then(m => m.MasterInventoriesComponent) },
      { path: 'inventarios', canActivate: [permissionGuard], data: {permission: 'CREATE_INVENTORIES'},
        loadComponent: () => import('./features/inventory-management/inventory-management').then(m => m.InventoryManagementComponent) },
      { path: 'consultas', loadComponent: () => import('./features/external-consultas/external-consultas').then(m => m.ExternalConsultasComponent) },
      { path: 'articulos', loadComponent: () => import('./features/articles/article-list/article-list').then(m => m.ArticleListComponent) },
      { path: 'categorias', loadComponent: () => import('./features/categories/category-list/category-list').then(m => m.CategoryListComponent) },
      { path: 'entradas', loadComponent: () => import('./features/movements/entradas/entradas').then(m => m.EntradasComponent) },
      { path: 'salidas', loadComponent: () => import('./features/movements/salidas/salidas').then(m => m.SalidasComponent) },
      { path: 'asignaciones', loadComponent: () => import('./features/assignment-history/assignment-history').then(m => m.AssignmentHistoryComponent) },
      { path: 'compartir-inventario', loadComponent: () => import('./features/inventory-sharing/inventory-sharing').then(m => m.InventorySharingComponent) },
      { path: 'historial-general', loadComponent: () => import('./features/master-history/master-history').then(m => m.MasterHistoryComponent) },
      { path: 'catalogo-general', loadComponent: () => import('./features/master-catalogs/master-catalogs').then(m => m.MasterCatalogsComponent) }
    ]
  }
];
