import { PageHeader, EmptyState } from '../components/ui';
import { IconLayers } from '../components/Icons';

// Modules not yet rebuilt. Kept honest: these are stubs, not half-built screens.
export default function Placeholder({ title, subtitle, note }) {
  return (
    <>
      <PageHeader title={title} subtitle={subtitle} />
      <div className="card">
        <EmptyState
          icon={<IconLayers width={24} height={24} />}
          title="Not built yet"
          text={note || 'This module is queued — we’re building one at a time.'}
        />
      </div>
    </>
  );
}
