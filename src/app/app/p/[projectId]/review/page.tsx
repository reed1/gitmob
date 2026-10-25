'use client';

import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ReviewScreen } from '@/app/app/p/[projectId]/components/ReviewScreen';
import { projectPagePath } from '@/lib/project-paths';

export default function ReviewPage() {
  const projectId = decodeURIComponent(
    useParams<{ projectId: string }>().projectId
  );
  const router = useRouter();
  const commit = useSearchParams().get('commit');

  return (
    <ReviewScreen
      projectId={projectId}
      commit={commit}
      path={null}
      onBack={() =>
        router.replace(
          `${projectPagePath(projectId)}?tab=${commit === null ? 'changes' : 'commit'}`
        )
      }
    />
  );
}
