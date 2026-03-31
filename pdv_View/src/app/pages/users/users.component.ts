import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { User, UserCreate, RoleEnum } from '../../core/models';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './user.html',
  styleUrl: './users.scss',
})
export class UsersComponent implements OnInit {
  users: User[] = [];
  showModal = false;
  isSaving = false;
  editingUser: User | null = null;
  form: any = { name: '', email: '', password: '', role: 'OPERATOR' };

  constructor(
    private userService: UserService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.userService.list().subscribe((users) => {
      this.users = users;
      this.cdr.detectChanges();
    });
  }

  openModal(): void {
    this.editingUser = null;
    this.form = { name: '', email: '', password: '', role: 'OPERATOR' };
    this.showModal = true;
  }

  editUser(user: User): void {
    this.editingUser = user;
    this.form = { name: user.name, email: user.email, password: '', role: user.role };
    this.showModal = true;
  }

  closeModal(): void {
    this.showModal = false;
    this.editingUser = null;
  }

  saveUser(): void {
    this.isSaving = true;
    if (this.editingUser) {
      const payload: any = { name: this.form.name, email: this.form.email, role: this.form.role };
      if (this.form.password) payload.password = this.form.password;
      this.userService.update(this.editingUser.id, payload).subscribe({
        next: () => {
          this.toastService.success('Usuário atualizado!');
          this.closeModal();
          this.loadUsers();
          this.isSaving = false;
        },
        error: () => (this.isSaving = false),
      });
    } else {
      this.userService.create(this.form).subscribe({
        next: () => {
          this.toastService.success('Usuário criado!');
          this.closeModal();
          this.loadUsers();
          this.isSaving = false;
        },
        error: () => (this.isSaving = false),
      });
    }
  }

  toggleUser(user: User): void {
    this.userService.toggleActive(user.id).subscribe({
      next: (updated) => {
        user.is_active = updated.is_active;
        this.toastService.success(user.is_active ? 'Usuário ativado' : 'Usuário desativado');
      },
    });
  }
}
