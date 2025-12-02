import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgMtcaptcha } from './ng-mtcaptcha';

describe('NgMtcaptcha', () => {
  let component: NgMtcaptcha;
  let fixture: ComponentFixture<NgMtcaptcha>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [NgMtcaptcha]
    })
    .compileComponents();

    fixture = TestBed.createComponent(NgMtcaptcha);
    component = fixture.componentInstance;
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
