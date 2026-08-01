import Image from 'next/image';
import { ITEM_NAMES, ItemKey, PatchKind } from '@/lib/gameData';
import {
  FARMING_ICON,
  ITEM_ICON_SIZE,
  IconKey,
  SKILL_ICON_SIZE,
  cropIcon,
  itemIconSrc,
} from '@/lib/icons';

/**
 * A game sprite in a square box.
 *
 * The box stays square whatever the sprite's shape, so a column of icons lines
 * up and the text beside them never shifts. `unoptimized` because these are
 * already sub-kilobyte PNGs — running them through the image pipeline would
 * cost a request each and save nothing. Eager for the same reason: the whole
 * icon set is smaller than a single photo, and deferring it only buys pop-in
 * as the page scrolls.
 */
export function GameIcon({
  src,
  intrinsic,
  size = 20,
  title,
  className = '',
}: {
  src: string;
  intrinsic: { width: number; height: number };
  size?: number;
  title?: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      // Decorative: every icon here sits beside the name it illustrates, so
      // announcing it again would only add noise.
      alt=""
      title={title}
      width={intrinsic.width}
      height={intrinsic.height}
      unoptimized
      loading="eager"
      style={{ width: size, height: size }}
      className={`shrink-0 object-contain ${className}`}
    />
  );
}

export function ItemIcon({
  item,
  name,
  size,
  className,
}: {
  item: IconKey;
  /** Hover text; falls back to the item's own name where there is one. */
  name?: string;
  size?: number;
  className?: string;
}) {
  const label = name ?? ITEM_NAMES[item as ItemKey];
  return (
    <GameIcon
      src={itemIconSrc(item)}
      intrinsic={ITEM_ICON_SIZE}
      size={size}
      title={label}
      className={className}
    />
  );
}

export function FarmingIcon({ size, className }: { size?: number; className?: string }) {
  return (
    <GameIcon
      src={FARMING_ICON}
      intrinsic={SKILL_ICON_SIZE}
      size={size}
      title="Farming"
      className={className}
    />
  );
}

/** The produce icon for one crop, or nothing if the crop is unknown. */
export function CropIcon({
  kind,
  cropKey,
  name,
  size,
  className,
}: {
  kind: PatchKind;
  cropKey: string;
  name?: string;
  size?: number;
  className?: string;
}) {
  const item = cropIcon(kind, cropKey);
  if (!item) return null;
  return <ItemIcon item={item} name={name} size={size} className={className} />;
}
