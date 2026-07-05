import { AuthForm } from '@/components/AuthForm';

export default function RegisterPage() {
  return (
    <main className="auth-wrap">
      <AuthForm mode="register" />
    </main>
  );
}
