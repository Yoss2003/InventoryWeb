import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/toast/toast-container';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  styleUrl: './app.scss',
  templateUrl: './app.html'
})
export class App {
  protected readonly title = signal('control-inventario-web');
}
