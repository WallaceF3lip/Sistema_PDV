"""
Script para criar o primeiro usuário ADMIN.
Execute uma única vez antes de usar a API.

Uso:
    python seed_admin.py
    python seed_admin.py --email admin@loja.com --password minhasenha --name "Maria"
"""
import argparse
import sys
import os

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from app.core.database import SessionLocal, engine, Base
from app.core.security import hash_password
from app.models.user import User, RoleEnum

# Garante que as tabelas existem
Base.metadata.create_all(bind=engine)


def create_admin(name: str, email: str, password: str):
    db = SessionLocal()
    try:
        existing = db.query(User).filter(User.email == email).first()
        if existing:
            print(f"⚠️  Usuário '{email}' já existe.")
            return

        admin = User(
            name=name,
            email=email,
            password_hash=hash_password(password),
            role=RoleEnum.ADMIN,
            is_active=True,
        )
        db.add(admin)
        db.commit()
        print(f"✅ Admin criado com sucesso!")
        print(f"   Nome:  {name}")
        print(f"   Email: {email}")
        print(f"   Role:  ADMIN")
        print()
        print("Agora faça login em POST /auth/token com essas credenciais.")

    finally:
        db.close()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Cria o primeiro usuário ADMIN")
    parser.add_argument("--name",     default="admin")
    parser.add_argument("--email",    default="admin@gmail.com")
    parser.add_argument("--password", default="admin123")
    args = parser.parse_args()

    create_admin(args.name, args.email, args.password)
