import { Menu } from "@base-ui/react/menu";
import { PaletteIcon } from "lucide-react";
import { useCallback, useState } from "react";

import { Button } from "@/components/ui/button";
import { readColourSchemePreference, writeColourSchemePreference } from "../../browser/colourSchemePreference.js";

const SCHEMES = [
    { value: "dark", label: "Dark" },
    { value: "light", label: "Light" },
    { value: "system", label: "System" },
];

function ColourSchemeMenu() {
    const [active, setActive] = useState(() => readColourSchemePreference());

    const onSelect = useCallback((scheme) => {
        writeColourSchemePreference(scheme);
        setActive(scheme);
        location.reload();
    }, []);

    return (
        <Menu.Root>
            <Menu.Trigger
                render={
                    <Button
                        id="colour-scheme-button"
                        size="icon"
                        aria-label={`Colour scheme: ${active}. Open menu to change.`}
                        title={`Colour scheme: ${active}`}
                    />
                }
            >
                <PaletteIcon aria-hidden="true" />
            </Menu.Trigger>
            <Menu.Portal>
                <Menu.Positioner className="app-menu-positioner" side="bottom" align="start" sideOffset={4}>
                    <Menu.Popup className="app-menu" aria-label="Colour scheme">
                        <Menu.RadioGroup value={active}>
                            {SCHEMES.map(({ value, label }) => (
                                <Menu.RadioItem
                                    key={value}
                                    className="app-menu-item"
                                    value={value}
                                    onClick={() => onSelect(value)}
                                >
                                    <Menu.RadioItemIndicator className="app-menu-item-indicator" />
                                    {label}
                                </Menu.RadioItem>
                            ))}
                        </Menu.RadioGroup>
                    </Menu.Popup>
                </Menu.Positioner>
            </Menu.Portal>
        </Menu.Root>
    );
}

export { ColourSchemeMenu };