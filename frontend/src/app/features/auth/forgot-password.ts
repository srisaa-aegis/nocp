import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { AuthService } from '../../core/auth/auth.service';

@Component({
  selector: 'app-forgot-password',
  imports: [FormsModule, RouterLink],
  templateUrl: './forgot-password.html',
  styleUrl: './forgot-password.scss',
})
export class ForgotPassword {
  private readonly auth = inject(AuthService);

  protected readonly email = signal('');
  protected readonly message = signal<{ kind: 'success' | 'error'; text: string } | null>(null);

  protected submit(): void {
    this.auth.forgotPassword(this.email()).subscribe((result) => {
      this.message.set(
        result.success
          ? { kind: 'success', text: 'Password reset instructions have been sent to your registered mobile number.' }
          : { kind: 'error', text: result.error ?? 'Could not process request.' },
      );
    });
  }
}
