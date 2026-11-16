import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Suspense } from 'react';
import { ProfileView } from '@/components/ProfileView';
import { parseYear } from '@/components/YearList';
import { currentUser } from '@/server/auth';
import { loadPublicProfile } from '@/server/profile';
import * as repo from '@/server/repo';

export async function generateMetadata({ params }: PageProps<'/u/[handle]'>): Promise<Metadata> {
  const { handle } = await params;
  const u = repo.getUserByHandle(handle);
  if (!u?.profilePublic || u.suspendedAt) return { title: 'Profile' };
  return { title: `${u.name} (@${u.handle})`, description: u.bio ?? `${u.name}'s posting activity on Tally.` };
}

export default function ProfilePage({ params, searchParams }: PageProps<'/u/[handle]'>) {
  return (
    <Suspense fallback={<ProfileSkeleton />}>
      <Profile params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Profile({ params, searchParams }: { params: Promise<{ handle: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const { handle } = await params;
  const { year } = await searchParams;
  const viewer = await currentUser();
  const profile = loadPublicProfile(decodeURIComponent(handle), viewer, new Date(), parseYear(year));
  if (!profile) notFound();
  return <ProfileView p={profile} signedIn={!!viewer} />;
}

function ProfileSkeleton() {
  return (
    <div className="profile" aria-busy="true" aria-label="Loading">
      <div className="profile-side">
        <span className="skeleton profile-avatar" style={{ width: 112, height: 112, borderRadius: '50%' }} />
        <span className="skeleton" style={{ height: 24, width: 160, borderRadius: 6 }} />
        <span className="skeleton" style={{ height: 36, borderRadius: 8 }} />
      </div>
      <div className="profile-main">
        <span className="skeleton" style={{ height: 84 }} />
        <span className="skeleton" style={{ height: 140 }} />
        <span className="skeleton" style={{ height: 260 }} />
      </div>
    </div>
  );
}
