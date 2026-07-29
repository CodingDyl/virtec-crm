import { AuthGuard } from '@/components/auth-guard'

/**
 * The passwords route renders the same component the dashboard mounts as a tab,
 * but it is directly addressable, so it needs the guard in its own right.
 */
export default function PasswordsLayout({ children }: { children: React.ReactNode }) {
  return <AuthGuard>{children}</AuthGuard>
}
