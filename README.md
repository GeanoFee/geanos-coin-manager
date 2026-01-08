# Geano's DnD Coin Manager

A helper module for the dnd5e system that streamlines currency management. It allows for mathematical input in currency fields and automatically consolidates coins into higher denominations.

## Features

- **Math Operations**: You can input values like `+50` or `-10` directly into currency fields. The module will calculate the new total.
- **Auto-Conversion**: Automatically converts lower denominations to higher ones (e.g., 100 CP -> 1 GP). It always keeps your coin weight optimized.
- **Electrum Toggle**: A world setting allows you to choose whether to include Electrum (EP) in the conversion or skip it (converting directly from Silver to Gold).

## Usage

1. Open a Character Sheet.
2. In the Currency section, try typing `+10` in the Gold field.
3. The module will add 10 Gold and then immediately optimize the total currency across all denominations.

## Settings

- **Electrum (EP) berücksichtigen?**: If enabled, Electrum will be used in the auto-conversion. If disabled, Electrum is ignored/skipped.

## Installation

- **Manifest URL**: `https://github.com/GeanoFee/geanos-coin-manager/releases/latest/download/module.json`
