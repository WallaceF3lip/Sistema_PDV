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
  template: `
    <div class="users">
      <div class="users__header">
        <div>
          <h2 class="headline-lg">Usuários</h2>
          <p class="body-md text-muted">Gerenciar equipe</p>
        </div>
        <button class="btn btn-primary" (click)="openModal()">+ Novo Usuário</button>
      </div>

      <div class="users__list">
        @for (user of users; track user.id; let i = $index) {
          <div class="user-row card animate-slide-up" [style.animation-delay]="(i * 40) + 'ms'">
            <div class="user-row__avatar">
              {{ user.name.charAt(0).toUpperCase() }}
            </div>
            <div class="user-row__info">
              <div class="title-md">{{ user.name }}</div>
              <div class="body-sm text-muted">{{ user.email }}</div>
            </div>
            <div class="user-row__role">
              <span class="badge" [class.badge--primary]="user.role === 'ADMIN'" [class.badge--muted]="user.role === 'OPERATOR'">
                {{ user.role }}
              </span>
            </div>
            <div class="user-row__status">
              <div
                class="toggle"
                [class.active]="user.is_active"
                (click)="toggleUser(user)"
              ></div>
            </div>
            <button class="btn btn-ghost" (click)="editUser(user)">Editar</button>
          </div>
        }
      </div>
    </div>

    @if (showModal) {
      <div class="glass-overlay" (click)="closeModal()">
        <div class="modal-card card animate-scale-in" (click)="$event.stopPropagation()">
          <h3 class="headline-md">{{ editingUser ? 'Editar Usuário' : 'Novo Usuário' }}</h3>

          <form class="modal-form" (ngSubmit)="saveUser()">
            <div class="form-group">
              <label class="label-sm text-muted">NOME</label>
              <input class="input-field" [(ngModel)]="form.name" name="name" required />
            </div>
            <div class="form-group">
              <label class="label-sm text-muted">E-MAIL</label>
              <input class="input-field" type="email" [(ngModel)]="form.email" name="email" required />
            </div>
            <div class="form-group">
              <label class="label-sm text-muted">SENHA {{ editingUser ? '(deixe vazio para manter)' : '' }}</label>
              <input class="input-field" type="password" [(ngModel)]="form.password" name="password" [required]="!editingUser" />
            </div>
            <div class="form-group">
              <label class="label-sm text-muted">CARGO</label>
              <select class="input-field" [(ngModel)]="form.role" name="role">
                <option value="OPERATOR">Operador</option>
                <option value="ADMIN">Administrador</option>
              </select>
            </div>
            <div class="modal-actions">
              <button type="button" class="btn btn-secondary" (click)="closeModal()">Cancelar</button>
              <button type="submit" class="btn btn-primary" [disabled]="isSaving">
                {{ isSaving ? 'Salvando...' : 'Salvar' }}
              </button>
            </div>
          </form>
        </div>
      </div>
    }
  `,
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
