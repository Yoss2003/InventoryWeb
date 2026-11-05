import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Salidas } from './salidas';

describe('Salidas', () => {
  let component: Salidas;
  let fixture: ComponentFixture<Salidas>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Salidas],
    }).compileComponents();

    fixture = TestBed.createComponent(Salidas);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
