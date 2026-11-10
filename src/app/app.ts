import { Component, signal, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ToastContainerComponent } from './shared/toast/toast-container';
import { TableOverlayScrollbarService } from './shared/ui/table-overlay-scrollbar.service';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [RouterOutlet, ToastContainerComponent],
  styleUrl: './app.scss',
  templateUrl: './app.html'
})
export class App {
  private readonly floatingTableScroll = inject(TableOverlayScrollbarService);

  ngAfterViewInit(): void {
    this.floatingTableScroll.start();
  }

  protected readonly title = signal('control-inventario-web');
}
