export const COLLECTIBLE_DRAG_MIME = "application/x-dsh-slot-collectible";

let activeCollectibleId: string | null = null;

export function beginCollectibleDrag(dataTransfer: DataTransfer, itemId: string): void {
  activeCollectibleId = itemId;
  dataTransfer.effectAllowed = "move";
  dataTransfer.setData(COLLECTIBLE_DRAG_MIME, itemId);
  dataTransfer.setData("text/plain", itemId);
}

export function draggedCollectibleId(dataTransfer?: Pick<DataTransfer, "getData"> | null): string | null {
  const transferred = dataTransfer?.getData(COLLECTIBLE_DRAG_MIME) ||
    dataTransfer?.getData("text/plain") || "";
  return transferred || activeCollectibleId;
}

export function endCollectibleDrag(): void {
  activeCollectibleId = null;
}
