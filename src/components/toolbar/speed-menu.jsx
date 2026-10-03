import styles from "./speed-menu.module.css";
import { Menu } from "@base-ui/react/menu";
import { GaugeIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Animation } from "../../config/Animation.js";

/**
 * @param {!number} seconds
 * @returns {!string} At most two decimals, none trailing: 2.4 s, 0.15 s, 8 s.
 */
const secondsText = (seconds) => `${Number(seconds.toFixed(2))} s`;

/** What each lane's speed does, said once in its menu items and its button's tooltip. */
const PACES = Object.freeze({
  steps: Object.freeze({
    name: "Step speed",
    pace: (speed) => `a step every ${secondsText(Animation.PLAYHEAD_STEP_DURATION_MS / 1000 / speed)}`,
  }),
  time: Object.freeze({
    name: "t speed",
    pace: (speed) => `t cycles in ${secondsText(Animation.CYCLE_DURATION_MS / 1000 / speed)}`,
  }),
});

/**
 * One lane's speed, chosen from Animation.SPEEDS: the Steps lane's paces Play, the Time lane's
 * paces t's cycle. The button names the multiple; each item says the pace it makes, so the choice
 * is read as time rather than as a bare number.
 *
 * @param {!{lane: ("steps"|"time"), value: !number, onChange: (undefined|!function(!number): void)}} props
 */
function SpeedMenu({ lane, value, onChange }) {
  if (onChange === undefined) {
    return null;
  }
  const { name, pace } = PACES[lane];
  return (
    <Menu.Root>
      <Menu.Trigger
        render={
          <Button id={`${lane}-speed-button`} aria-label={`${name}, ${value}×`} title={`${name}: ${pace(value)}`} />
        }
      >
        <GaugeIcon data-icon="inline-start" aria-hidden="true" />
        <span className={styles.value}>{value}×</span>
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner className="app-menu-positioner" side="bottom" align="end" sideOffset={4}>
          <Menu.Popup className="app-menu" aria-label={name}>
            <Menu.Group>
              <Menu.GroupLabel className="app-menu-label">{name}</Menu.GroupLabel>
              <Menu.RadioGroup value={value} onValueChange={(speed) => onChange(speed)}>
                {Animation.SPEEDS.map((option) => (
                  // A speed is chosen once; the menu gets out of the way of the lane it paces.
                  <Menu.RadioItem key={option} className="app-menu-item" value={option} closeOnClick>
                    <span className={styles.item}>
                      <span className={styles.value}>{option}×</span>
                      <span className={styles.paces}>{pace(option)}</span>
                    </span>
                  </Menu.RadioItem>
                ))}
              </Menu.RadioGroup>
            </Menu.Group>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}

export { SpeedMenu };
