import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-login',
  imports: [FormsModule, RouterLink],
  templateUrl: './login.html',
  styleUrl: './login.scss',
})
export class Login {
  private readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly username = signal('');
  protected readonly password = signal('');
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);

  protected readonly demoAccounts = [
    { label: 'Citizen (builder)', username: 'citizen1' },
    { label: 'Citizen 2', username: 'citizen2' },
    { label: 'Dept — DG', username: 'dg.officer' },
    { label: 'Dept — DFS', username: 'dfs.officer' },
    { label: 'Dept — Section (HQ)', username: 'section.hq' },
    { label: 'Dept — RFO (Eastern)', username: 'rfo.officer' },
    { label: 'Dept — DFO Visakhapatnam', username: 'dfo.visakhapatnam' },
    { label: 'Dept — SFO Visakhapatnam', username: 'sfo.officer' },
    { label: 'Dept — Monitoring', username: 'monitor.hq' },
    { label: 'Admin', username: 'admin' },
  ];

  protected fillDemo(username: string): void {
    this.username.set(username);
    this.password.set('demo');
  }

  protected submit(): void {
    if (!this.username().trim() || !this.password().trim()) {
      this.errorMessage.set('Please enter both a username and a password.');
      return;
    }
    this.isSubmitting.set(true);
    this.errorMessage.set(null);
    this.auth.login(this.username(), this.password()).subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        if (result.success && result.landing) {
          this.router.navigateByUrl(result.landing);
        } else {
          this.errorMessage.set(result.error ?? 'Login failed.');
        }
      },
      error: () => {
        this.isSubmitting.set(false);
        this.errorMessage.set('Login failed. Please try again.');
      },
    });
  }
}
