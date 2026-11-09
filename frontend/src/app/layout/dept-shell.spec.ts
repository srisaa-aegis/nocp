import { HttpClientTestingModule } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { DeptShell } from './dept-shell';

describe('DeptShell', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [DeptShell, HttpClientTestingModule],
      providers: [provideRouter([])],
    }).compileComponents();
  });

  it('renders the department portal header', () => {
    const fixture = TestBed.createComponent(DeptShell);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Department Workbench');
  });
});
