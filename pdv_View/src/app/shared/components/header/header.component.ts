import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './header.html',
  styleUrl: './header.scss',
})
// SEM UTILIZAR
export class HeaderComponent {
  pageTitle = '';

  get user() {
    return this.authService.getCurrentUser();
  }

  constructor(private authService: AuthService) {}
}
