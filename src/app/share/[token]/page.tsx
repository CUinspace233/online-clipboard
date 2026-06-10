import { notFound } from 'next/navigation';
import { SharedItemView } from '@/components/clipboard/SharedItemView';
import { getClipboardItemByShareToken, initSchema } from '@/lib/db/clipboard';

interface SharePageProps {
  params: Promise<{ token: string }>;
}

export default async function SharePage({ params }: SharePageProps) {
  await initSchema();

  const { token } = await params;
  const item = await getClipboardItemByShareToken(token);

  if (!item) {
    notFound();
  }

  return <SharedItemView item={item} />;
}
