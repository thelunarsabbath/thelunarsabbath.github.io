# Hebcal library (vendored)

We use **@hebcal/core** for the optional "Rabbinic (Hebcal)" calendar profile. There is no npm dependency; the bundle is downloaded and committed here. The bundle exposes a global `hebcal`; `hebcal-loader.js` normalizes it to `window.Hebcal` for the app’s adapter.

## Fetching the bundle

From the project root, run:

```bash
./scripts/fetch-hebcal.sh
```

Or manually:

```bash
curl -L -o lib/hebcal/hebcal-core.min.js \
  "https://unpkg.com/@hebcal/core@6.0.8/dist/bundle.min.js"
```

## Files

- **hebcal-core.min.js** — Browser bundle from @hebcal/core (add it via the script above).
- **hebcal-loader.js** — Normalizes the bundle’s global to `window.Hebcal` so the app’s Hebcal adapter can use it.

## License

@hebcal/core is GPL-2.0. See the [Hebcal repository](https://github.com/hebcal/hebcal-es6).
