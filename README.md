# SbcPowerButton

A Duet Web Control (DWC) 3.7 plugin that adds a power button to the top app bar for rebooting or shutting down the single-board computer (Raspberry Pi) that runs Duet Software Framework.

It reuses what DWC already does under **Settings → About**: it sends `M999 B-1` (reboot) or `M999 B-1 P"OFF"` (shutdown), which the DuetPi Management Plugin turns into a reboot or power-off. Every action asks for confirmation, and the button is disabled while printing, while the UI is busy, or when the DuetPi Management Plugin is not running.

**Status:** research done, plugin not built yet. See [docs/RESEARCH.md](docs/RESEARCH.md).

## Requirements

- DuetWebControl 3.7.0 on DSF 3.7.0 (SBC mode).
- The DuetPi Management Plugin installed and running.

## Building

1. Check out DuetWebControl at the matching tag and install its dependencies:
   ```bash
   git clone --branch v3.7.0 --depth 1 https://github.com/Duet3D/DuetWebControl.git
   cd DuetWebControl
   npm install
   ```
2. From inside that checkout, build this plugin:
   ```bash
   node scripts/build-plugin-pkg.js /path/to/SbcPowerButton
   ```
3. Install `SbcPowerButton-<version>.zip` in DWC under **Settings → Plugins**, start it, and enable auto-start.

## License

GPL-3.0-or-later, the same license as DuetWebControl.
