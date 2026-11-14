import type { Metadata } from 'next';
import { signUpAction } from '@/app/actions/auth';
import { AuthForm } from '@/components/AuthForm';

export const metadata: Metadata = { title: 'Create your profile' };

export default function SignUpPage() {
  return <AuthForm mode="sign-up" action={signUpAction} />;
}
