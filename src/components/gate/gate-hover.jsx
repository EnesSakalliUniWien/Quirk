import { PreviewCard } from "@base-ui/react/preview-card";

import { GateDetails } from "./gate-details.jsx";

/**
 * One card, every tile. Base UI's preview card takes a handle so many triggers can drive a single
 * popup, which is what the palette needs: there are hundreds of tiles and only ever one card.
 *
 * The handle also carries the payload, so a tile says which gate it is by handing the gate over
 * rather than by the card reaching back into the palette for it.
 */
const gateHoverHandle = PreviewCard.createHandle();

/**
 * The hover window: a gate's own documentation, positioned against the tile the pointer is on.
 *
 * It replaces a canvas the toolbox positioned by hand. Base UI owns the delay, the placement, the
 * flipping when there is no room, and the accessibility; this file owns what the card says.
 *
 * @param {!{latestTime: !function(): !number}} props latestTime is read when the card opens, so a
 *     time-dependent gate describes itself at the animation's current phase.
 */
function GateHoverCard({ latestTime }) {
  return (
    <PreviewCard.Root handle={gateHoverHandle}>
      {({ payload }) => (
        <PreviewCard.Portal>
          <PreviewCard.Positioner
            className="gate-hover-positioner"
            side="right"
            align="start"
            sideOffset={10}
            collisionPadding={12}
          >
            <PreviewCard.Popup className="gate-hover">
              <GateDetails gate={payload} time={latestTime()} />
            </PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      )}
    </PreviewCard.Root>
  );
}

export { GateHoverCard, gateHoverHandle };
