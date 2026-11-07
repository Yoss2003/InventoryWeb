import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { MainLayoutComponent } from './main-layout';
import { AuthService } from '../../services/auth.service';

describe('MainLayoutComponent', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MainLayoutComponent],
      providers: [provideRouter([]), { provide: AuthService, useValue: { logout: () => {} } }],
    }).compileComponents();
  });

  it('keeps navigation available when expanding and collapsing the menu', async () => {
    const fixture = TestBed.createComponent(MainLayoutComponent);
    await fixture.whenStable();
    const element = fixture.nativeElement as HTMLElement;
    const trigger = element.querySelector<HTMLButtonElement>('.menu-trigger')!;
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
    trigger.click();
    await fixture.whenStable();
    expect(trigger.getAttribute('aria-expanded')).toBe('true');
    expect(element.querySelector('.sidenav.expanded')).toBeTruthy();
    expect(element.querySelectorAll('mat-nav-list a').length).toBeGreaterThanOrEqual(7);
    trigger.click();
    await fixture.whenStable();
    expect(element.querySelector('.sidenav.collapsed')).toBeTruthy();
    expect(trigger.getAttribute('aria-expanded')).toBe('false');
  });
});
