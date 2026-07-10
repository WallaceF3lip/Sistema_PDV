import { Component, OnInit, ChangeDetectorRef, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { ToastService } from '../../core/services/toast.service';
import { User, UserCreate, RoleEnum } from '../../core/models';
import { DataTableComponent, DtCellDirective, TableColumn } from '../../shared/components/data-table/data-table.component';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule, DataTableComponent, DtCellDirective],
  templateUrl: './user.html',
  styleUrl: './users.scss',
})
export class UsersComponent implements OnInit {
  users = signal<User[]>([]);
  isLoading = signal<boolean>(false);
  showModal = false;
  isSaving = false;
  editingUser: User | null = null;
  form: any = { name: '', email: '', password: '', role: 'OPERATOR' };

  columns: TableColumn[] = [
    { key: 'avatar',label: '',align: 'center'},
    { key: 'info',label: 'Usuário'},
    { key: 'email',label: 'E-mail'},
    { key: 'role',label: 'Cargo',align: 'center'},
    { key: 'is_active', label: 'Ativo',align: 'center',width: '120px'},
    { key: 'actions',label: '',align: 'right', width: '180px'},
  ];

  constructor(
    private userService: UserService,
    private toastService: ToastService,
    private cdr: ChangeDetectorRef
  ) {}

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    this.isLoading.set(true);
    this.userService.list().subscribe((list) => {
      this.users.set(list);
      this.isLoading.set(false);
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
        // Força atualização do signal
        this.users.update(list => list.map(u => u.id === user.id ? { ...u, is_active: updated.is_active } : u));
        this.toastService.success(user.is_active ? 'Usuário ativado' : 'Usuário desativado');
      },
    });
  }
}
