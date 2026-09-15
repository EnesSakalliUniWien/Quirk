import { useState } from "react";
import { PreviewCard } from "@base-ui/react/preview-card";
import { Popover } from "@base-ui/react/popover";
import { XIcon } from "lucide-react";

import { Button } from "../ui/button.jsx";
import { GateDetails } from "./gate-details.jsx";

// Each family of toolbox triggers shares one window and passes its gate as the payload.
const gateHoverHandle = PreviewCard.createHandle();
const gateDetailsHandle = Popover.createHandle();

function GateHoverCard({ latestTime }) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [time, setTime] = useState(0);
  return (
    <>
      <PreviewCard.Root
        handle={gateHoverHandle}
        open={hoverOpen && !detailsOpen}
        onOpenChange={setHoverOpen}
      >
        {({ payload }) => (
          <PreviewCard.Portal>
            <PreviewCard.Positioner className="gate-hover-positioner" side="right" sideOffset={10} collisionPadding={12}>
              <PreviewCard.Popup className="gate-hover">
                <div className="gate-details-header">
                  <h2 className="gate-details-title">{payload?.name}</h2>
                  <p className="gate-details-blurb">{payload?.blurb}</p>
                  <p className="gate-details-note">Use the gate’s details button for matrices and diagrams.</p>
                </div>
              </PreviewCard.Popup>
            </PreviewCard.Positioner>
          </PreviewCard.Portal>
        )}
      </PreviewCard.Root>
      <Popover.Root
        handle={gateDetailsHandle}
        onOpenChange={(open) => {
          setDetailsOpen(open);
          setHoverOpen(false);
          if (open) setTime(latestTime());
        }}
      >
        {({ payload }) => (
          <Popover.Portal>
            <Popover.Positioner
              className="gate-details-positioner"
              side="right"
              align="start"
              sideOffset={10}
              collisionPadding={12}
              collisionAvoidance={{ side: "shift", align: "shift" }}
            >
              <Popover.Popup className="gate-details-popup">
                <div className="gate-details-toolbar">
                  <Popover.Title className="gate-details-title">{payload?.name}</Popover.Title>
                  <Popover.Close render={<Button size="icon" />} aria-label="Close gate details">
                    <XIcon aria-hidden="true" />
                  </Popover.Close>
                </div>
                <GateDetails key={payload?.serializedId} gate={payload} time={time} title={null} />
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        )}
      </Popover.Root>
    </>
  );
}

export { GateHoverCard, gateHoverHandle, gateDetailsHandle };
