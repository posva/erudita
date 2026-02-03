# Erudita

[![CI](https://github.com/posva/erudita/actions/workflows/ci.yml/badge.svg)](https://github.com/posva/erudita/actions/workflows/ci.yml)
[![npm version](https://badgen.net/npm/v/erudita)](https://www.npmjs.com/package/erudita)
[![codecov](https://codecov.io/gh/posva/erudita/graph/badge.svg)](https://codecov.io/gh/posva/erudita)

CLI for downloading and caching documentation from `llms.txt`.

## Installation

```bash
pnpm add -g erudita
```

## Usage

```bash
# Download docs for a package
erudita fetch vue

# List cached documentation
erudita list
```

## Development

To test the CLI locally during development:

```bash
pnpm build
pnpm link --global
erudita --help
```

To unlink: `pnpm unlink --global erudita`

## License

MIT
