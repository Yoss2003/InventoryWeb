import { CommonModule } from '@angular/common';
import { Component, inject } from '@angular/core';
import { ToastService, ToastType } from './toast.service';

@Component({
  selector: 'app-toast-container',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './toast-container.html',
  styleUrl: './toast-container.scss'
})
export class ToastContainerComponent {
  readonly alerts = inject(ToastService);

  icon(type: ToastType): string {
    return type === 'success' ? '✓' : type === 'error' ? '!' : type === 'warning' ? '!' : 'i';
  }
}
