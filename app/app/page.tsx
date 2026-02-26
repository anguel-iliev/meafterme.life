import { redirect } from 'next/navigation';
import { getSessionUser } from '@/lib/session';
import AppDashboard from './AppDashboard';

export default async function AppPage() {
  const user = await getSessionUser();
  if (!user) {
    redirect('/login');
  }
  if (user.status !== 'ACTIVE') {
    if (user.status === 'PENDING_APPROVAL') redirect('/pending');
    if (user.status === 'WAITLISTED') redirect('/waitlist');
    redirect('/login');
  }
  return <AppDashboard user={user} />;
}
