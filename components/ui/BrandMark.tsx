import Link from 'next/link';

export function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <Link className={`brandMark${compact ? ' brandMark--compact' : ''}`} href="/" aria-label="Neramit หน้าแรก">
      <span className="brandMark__symbol" aria-hidden="true">N</span>
      <span className="brandMark__text"><strong>Neramit</strong><small>เนรมิต</small></span>
    </Link>
  );
}
