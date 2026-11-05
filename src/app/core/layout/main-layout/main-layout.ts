import { Component, inject, signal } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-main-layout',
  standalone: true,
  imports: [RouterModule, MatSidenavModule, MatToolbarModule, MatListModule, MatIconModule, MatButtonModule],
  templateUrl: './main-layout.html',
  styleUrl: './main-layout.scss'
})
export class MainLayoutComponent {
  private authService = inject(AuthService);
  private router = inject(Router);
  isSidebarOpen = signal(false);

  toggleSidebar() {
    this.isSidebarOpen.update(val => !val);
  }

  logout() {
    this.authService.logout();
    this.router.navigate(['/login']);
  }
}