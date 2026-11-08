import { TestBed } from '@angular/core/testing';
import { TestbedHarnessEnvironment } from '@angular/cdk/testing/testbed';
import { MatSelectHarness } from '@angular/material/select/testing';
import { CompanySelectorComponent } from './company-selector';

describe('Company selector', () => {
  it('distinguishes duplicate names and emits the selected company ID', async () => {
    await TestBed.configureTestingModule({imports:[CompanySelectorComponent]}).compileComponents();
    const fixture=TestBed.createComponent(CompanySelectorComponent);
    fixture.componentRef.setInput('companies',[{id:1,businessName:'Central'},{id:2,businessName:'Central'}]);
    let selected:number|null=null;
    fixture.componentInstance.valueChange.subscribe(id=>selected=id);
    await fixture.whenStable();
    const select=await TestbedHarnessEnvironment.loader(fixture).getHarness(MatSelectHarness);
    await select.open();
    const options=await select.getOptions();
    expect(await options[1].getText()).toContain('ID 2');
    await options[1].click();
    expect(selected).toBe(2);
    fixture.componentRef.setInput('loading',true);
    await fixture.whenStable();
    expect(await select.isDisabled()).toBe(true);
  });
});
