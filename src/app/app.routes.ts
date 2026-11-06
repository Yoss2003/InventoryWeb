import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', loadComponent: () => import('./features/auth/login/login').then(m => m.Login) },
  {
    path: 'dashboard',
    loadComponent: () => import('./core/layout/main-layout/main-layout').then(m => m.MainLayoutComponent),
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'articulos', pathMatch: 'full' },
      { path: 'articulos', loadComponent: () => import('./features/articles/article-list/article-list').then(m => m.ArticleListComponent) },
      { path: 'categorias', loadComponent: () => import('./features/categories/category-list/category-list').then(m => m.CategoryListComponent) },
      { path: 'entradas', loadComponent: () => import('./features/movements/entradas/entradas').then(m => m.EntradasComponent) },
      { path: 'salidas', loadComponent: () => import('./features/movements/salidas/salidas').then(m => m.SalidasComponent) },
      { path: 'asignaciones', loadComponent: () => import('./features/assignment-history/assignment-history').then(m => m.AssignmentHistoryComponent) },
      { path: 'compartir-inventario', loadComponent: () => import('./features/inventory-sharing/inventory-sharing').then(m => m.InventorySharingComponent) }
    ]
  }
];
