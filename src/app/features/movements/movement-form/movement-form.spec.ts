import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MovementForm } from './movement-form';

describe('MovementForm', () => {
  let component: MovementForm;
  let fixture: ComponentFixture<MovementForm>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [MovementForm],
    }).compileComponents();

    fixture = TestBed.createComponent(MovementForm);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
