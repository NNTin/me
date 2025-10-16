# Badge Generator Cookiecutter Template

This template generates SVG badges with customizable colors and text.

## Usage

From the `tools/` directory, run:

```bash
# First time
cookiecutter cookiecutter/cookiecutter-badges

# Subsequent times (to allow overwriting the output directory)
cookiecutter cookiecutter/cookiecutter-badges --overwrite-if-exists
```

## Parameters

- `directory`: Name of the output directory
- `filename`: Name of the output SVG file (without extension)
- `left_text`: Text to display on the left side of the badge
- `right_text`: Text to display on the right side of the badge
- `left_color`: Background color for the left side (hex code, e.g., "#555555")
- `right_color`: Background color for the right side (hex code, e.g., "#4c1")
- `text_color`: Color of the text (hex code, e.g., "#ffffff")

## Example

Input:

- directory: "out"
- filename: "build-status"
- left_text: "build"
- right_text: "passing"
- left_color: "#555555"
- right_color: "#4c1"
- text_color: "#ffffff"

Output: `build-status.svg` - A badge showing "build | passing" with gray and green background.

## Common Colors

- Gray: `#555555`
- Green (success): `#4c1`, `#97ca00`
- Red (error): `#e05d44`
- Yellow (warning): `#dfb317`
- Blue (info): `#007ec6`
- Orange: `#fe7d37`
