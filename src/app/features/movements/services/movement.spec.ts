import { TestBed } from '@angular/core/testing';
import { Movement } from './movement';

describe('Movement', () => {
  let service: Movement;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Movement);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
