import type { Metadata } from 'next';
import { signInAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Sign in' };

export default function SignInPage() {
  return <AuthForm mode="sign-in" action={signInAction} />;
}
