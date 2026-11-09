import { Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { PortalHeader, PortalNavLink } from '../shared/ui/portal-header';

@Component({
  selector: 'app-dept-shell',
  imports: [RouterOutlet, PortalHeader],
  templateUrl: './dept-shell.html',
  styleUrl: './dept-shell.scss',
})
export class DeptShell {
  protected readonly navLinks: PortalNavLink[] = [
    { label: 'Dashboard', path: '/dept/dashboard', icon: 'home' },
    { label: 'Search', path: '/dept/search', icon: 'search' },
    { label: 'Reports', path: '/dept/reports', icon: 'bar-chart' },
  ];
}
