'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ReviewScreen } from '@/app/app/p/[projectId]/components/ReviewScreen';

export default function ReviewPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const router = useRouter();
  const commit = useSearchParams().get('commit');

  return (
    <ReviewScreen
      projectId={projectId}
      commit={commit}
      path={null}
      onBack={() =>
        router.replace(
          `/app/p/${projectId}?tab=${commit === null ? 'changes' : 'commit'}`
        )
      }
    />
  );
}
